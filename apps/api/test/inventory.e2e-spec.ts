import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { EquipmentUpsertRequest } from '@normatiza/shared';

import { sharp } from '../src/storage/sharp';
import { CompaniesService } from '../src/companies/companies.service';
import { EquipmentsService } from '../src/inventory/equipments.service';
import { MachineTypesService } from '../src/inventory/machine-types.service';
import { SectorsService } from '../src/inventory/sectors.service';
import { Elenco, escopoDe, montarConsultoriaRival, montarElenco } from './helpers/elenco';
import { TestApp, createTestApp } from './helpers/test-app';

/**
 * O inventário da planta ([03 §4.2 e §4.3](../../../docs/produto/03_navegacao_e_telas.md)).
 *
 * Contra o banco de verdade: o código sequencial, a TAG única na empresa e o
 * setor único por nome normalizado são garantias do banco.
 */
describe('Inventário da planta (e2e)', () => {
  let ctx: TestApp;
  let equipments: EquipmentsService;
  let sectors: SectorsService;
  let machineTypes: MachineTypesService;
  let companies: CompaniesService;
  let elenco: Elenco;

  beforeAll(async () => {
    ctx = await createTestApp();
    equipments = ctx.app.get(EquipmentsService);
    sectors = ctx.app.get(SectorsService);
    machineTypes = ctx.app.get(MachineTypesService);
    companies = ctx.app.get(CompaniesService);
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(async () => {
    elenco = await montarElenco(ctx.prisma);
    // A limpeza entre testes trunca tudo, inclusive o catálogo global que a
    // migração semeia. Dois tipos bastam para os testes.
    await ctx.prisma.machineType.createMany({
      data: [
        { id: 'mt-prensa-hidraulica', name: 'Prensa hidráulica', normalizedName: 'prensa hidraulica' },
        { id: 'mt-esteira-transportadora', name: 'Esteira transportadora', normalizedName: 'esteira transportadora' },
      ],
    });
  });

  const escopo = (userId: string) => escopoDe(ctx.prisma, userId);
  const máquina = (over: Partial<EquipmentUpsertRequest> = {}): EquipmentUpsertRequest => ({
    name: 'Prensa excêntrica 60t',
    ...over,
  });

  // ───────────────────────────────────────────────────────────────────────────
  describe('cadastrar', () => {
    it('deve cadastrar só com o nome, e dar o código sequencial da empresa', async () => {
      const fernando = await escopo(elenco.fernando.id);

      const primeira = await equipments.create(fernando, elenco.brf.id, máquina());
      const segunda = await equipments.create(fernando, elenco.brf.id, máquina({ name: 'Injetora' }));

      expect(primeira.code).toBe('EQ-0001');
      expect(segunda.code).toBe('EQ-0002');
      expect(primeira).toMatchObject({ status: 'ACTIVE', complianceStatus: 'NOT_ASSESSED', openPointsCount: 0 });
      expect(primeira.worstCurrentHrn).toBeUndefined();
    });

    it('deve contar por empresa: a Seara começa do EQ-0001 também', async () => {
      const josué = await escopo(elenco.josué.id);
      await equipments.create(josué, elenco.brf.id, máquina());

      const daSeara = await equipments.create(josué, elenco.seara.id, máquina());

      expect(daSeara.code).toBe('EQ-0001');
    });

    it('não deve reaproveitar o código de um equipamento excluído', async () => {
      const josué = await escopo(elenco.josué.id);
      const errada = await equipments.create(josué, elenco.brf.id, máquina());
      await equipments.remove(josué, elenco.brf.id, errada.code);

      const nova = await equipments.create(josué, elenco.brf.id, máquina());

      expect(nova.code).toBe('EQ-0002');
    });

    it('deve deixar o Gestor e o Engenheiro do Cliente cadastrarem na empresa deles', async () => {
      for (const pessoa of [elenco.marcos, elenco.antonio]) {
        const criada = await equipments.create(await escopo(pessoa.id), elenco.brf.id, máquina());
        expect(criada.code).toMatch(/^EQ-/);
      }
    });

    it('não deve deixar a Diretora cadastrar, e esconder o inventário do Executor', async () => {
      await expect(
        equipments.create(await escopo(elenco.débora.id), elenco.brf.id, máquina()),
      ).rejects.toThrow(ForbiddenException);

      await expect(equipments.list(await escopo(elenco.rafael.id), elenco.brf.id)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('não deve revelar empresa fora do escopo', async () => {
      // Fernando é Técnico só na BRF.
      await expect(
        equipments.create(await escopo(elenco.fernando.id), elenco.seara.id, máquina()),
      ).rejects.toThrow(NotFoundException);
    });

    it('deve recusar a TAG que outra máquina da empresa já usa, nomeando qual', async () => {
      const josué = await escopo(elenco.josué.id);
      await equipments.create(josué, elenco.brf.id, máquina({ name: 'Prensa 1', tag: 'PR-01' }));

      const repetida = equipments.create(josué, elenco.brf.id, máquina({ name: 'Prensa 2', tag: ' pr-01 ' }));

      await expect(repetida).rejects.toThrow(ConflictException);
      await expect(repetida).rejects.toMatchObject({
        response: { field: 'tag', message: expect.stringContaining('Prensa 1') },
      });
    });

    it('deve aceitar a mesma TAG em empresas diferentes, e várias máquinas sem TAG', async () => {
      const josué = await escopo(elenco.josué.id);
      await equipments.create(josué, elenco.brf.id, máquina({ tag: 'PR-01' }));
      await equipments.create(josué, elenco.brf.id, máquina());
      await equipments.create(josué, elenco.brf.id, máquina());

      await expect(equipments.create(josué, elenco.seara.id, máquina({ tag: 'PR-01' }))).resolves.toBeTruthy();
    });

    it('deve recusar setor e tipo de máquina que não são desta empresa nem desta conta', async () => {
      const josué = await escopo(elenco.josué.id);
      const daSeara = await sectors.create(josué, elenco.seara.id, { name: 'Abate' });
      const rival = await montarConsultoriaRival(ctx.prisma);
      const tipoDaRival = await ctx.prisma.machineType.create({
        data: { accountId: rival.conta.id, name: 'Secreto', normalizedName: 'secreto' },
      });

      await expect(
        equipments.create(josué, elenco.brf.id, máquina({ sectorId: daSeara.id })),
      ).rejects.toThrow(BadRequestException);
      await expect(
        equipments.create(josué, elenco.brf.id, máquina({ machineTypeId: tipoDaRival.id })),
      ).rejects.toThrow(BadRequestException);
    });

    it('deve recusar o nome vazio, no campo do nome', async () => {
      await expect(
        equipments.create(await escopo(elenco.josué.id), elenco.brf.id, máquina({ name: '   ' })),
      ).rejects.toMatchObject({ response: { field: 'name' } });
    });

    it('não deve cadastrar em empresa inativa', async () => {
      const josué = await escopo(elenco.josué.id);
      await companies.deactivate(josué, elenco.seara.id);

      await expect(equipments.create(josué, elenco.seara.id, máquina())).rejects.toThrow(ForbiddenException);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  describe('a lista', () => {
    it('deve trazer só os ativos por padrão, e os desativados quando pedidos', async () => {
      const josué = await escopo(elenco.josué.id);
      await equipments.create(josué, elenco.brf.id, máquina({ name: 'Ativa' }));
      const velha = await equipments.create(josué, elenco.brf.id, máquina({ name: 'Velha' }));
      await equipments.deactivate(josué, elenco.brf.id, velha.code);

      const padrão = await equipments.list(josué, elenco.brf.id);
      const todas = await equipments.list(josué, elenco.brf.id, { status: 'ALL' });

      expect(padrão.map((e) => e.name)).toEqual(['Ativa']);
      expect(todas.map((e) => e.name).sort()).toEqual(['Ativa', 'Velha']);
    });

    it('deve buscar sem ligar para acento e caixa, por nome, código, TAG, série, modelo e fabricante', async () => {
      const josué = await escopo(elenco.josué.id);
      await equipments.create(
        josué,
        elenco.brf.id,
        máquina({ name: 'Máquina de lavar caixas', tag: 'LV-9', serialNumber: 'SN-777', manufacturerName: 'Metalúrgica Sul' }),
      );
      await equipments.create(josué, elenco.brf.id, máquina({ name: 'Outra' }));

      for (const termo of ['MAQUINA de lavar', 'lv-9', 'sn-777', 'metalurgica', 'eq-0001']) {
        const achadas = await equipments.list(josué, elenco.brf.id, { q: termo });
        expect(achadas.map((e) => e.name)).toEqual(['Máquina de lavar caixas']);
      }
    });

    it('deve filtrar por setor', async () => {
      const josué = await escopo(elenco.josué.id);
      const usinagem = await sectors.create(josué, elenco.brf.id, { name: 'Usinagem' });
      await equipments.create(josué, elenco.brf.id, máquina({ name: 'Torno', sectorId: usinagem.id }));
      await equipments.create(josué, elenco.brf.id, máquina({ name: 'Esteira' }));

      const doSetor = await equipments.list(josué, elenco.brf.id, { sectorId: usinagem.id });

      expect(doSetor.map((e) => e.name)).toEqual(['Torno']);
      expect(doSetor[0].sector).toEqual({ id: usinagem.id, name: 'Usinagem' });
    });

    it('deve oferecer por linha só as ações que o servidor aceita', async () => {
      const josué = await escopo(elenco.josué.id);
      const ativa = await equipments.create(josué, elenco.brf.id, máquina());

      const [paraJosué] = await equipments.list(josué, elenco.brf.id);
      const [paraDébora] = await equipments.list(await escopo(elenco.débora.id), elenco.brf.id);

      expect(paraJosué.actions).toEqual({ edit: true, deactivate: true, reactivate: false, delete: true });
      expect(paraDébora.actions).toEqual({ edit: false, deactivate: false, reactivate: false, delete: false });
      expect(ativa.code).toBe(paraJosué.code);
    });

    it('deve contar os equipamentos ativos na lista de empresas', async () => {
      const josué = await escopo(elenco.josué.id);
      await equipments.create(josué, elenco.brf.id, máquina());
      const segunda = await equipments.create(josué, elenco.brf.id, máquina());
      await equipments.create(josué, elenco.brf.id, máquina());
      await equipments.deactivate(josué, elenco.brf.id, segunda.code);

      const carteira = await companies.list(josué);

      expect(carteira.find((e) => e.id === elenco.brf.id)?.equipmentsCount).toBe(2);
      expect(carteira.find((e) => e.id === elenco.seara.id)?.equipmentsCount).toBe(0);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  describe('abrir, editar, desativar, excluir', () => {
    it('deve abrir pelo código, em qualquer caixa, como a URL o traz', async () => {
      const josué = await escopo(elenco.josué.id);
      const criada = await equipments.create(josué, elenco.brf.id, máquina({ manufactureYear: 2012 }));

      const aberta = await equipments.get(josué, elenco.brf.id, 'eq-0001');

      expect(aberta).toMatchObject({ id: criada.id, code: 'EQ-0001', manufactureYear: 2012 });
    });

    it('deve responder 404 para código que não existe ou de outra empresa', async () => {
      const josué = await escopo(elenco.josué.id);
      await equipments.create(josué, elenco.seara.id, máquina());

      await expect(equipments.get(josué, elenco.brf.id, 'EQ-0001')).rejects.toThrow(NotFoundException);
      await expect(equipments.get(josué, elenco.brf.id, 'qualquer')).rejects.toThrow(NotFoundException);
    });

    it('deve editar a identidade e limpar o que vier vazio', async () => {
      const antonio = await escopo(elenco.antonio.id);
      const criada = await equipments.create(antonio, elenco.brf.id, máquina({ model: 'X1', tag: 'A' }));

      const editada = await equipments.update(antonio, elenco.brf.id, criada.code, máquina({ name: 'Prensa 60t', model: '' }));

      expect(editada).toMatchObject({ name: 'Prensa 60t', code: criada.code });
      expect(editada.model).toBeUndefined();
      expect(editada.tag).toBeUndefined();
    });

    it('deve deixar o desativado em modo leitura, até ser reativado', async () => {
      const josué = await escopo(elenco.josué.id);
      const criada = await equipments.create(josué, elenco.brf.id, máquina());
      await equipments.deactivate(josué, elenco.brf.id, criada.code);

      await expect(equipments.update(josué, elenco.brf.id, criada.code, máquina())).rejects.toThrow(
        ConflictException,
      );
      const [linha] = await equipments.list(josué, elenco.brf.id, { status: 'ALL' });
      expect(linha.actions).toEqual({ edit: false, deactivate: false, reactivate: true, delete: true });

      await equipments.reactivate(josué, elenco.brf.id, criada.code);
      await expect(equipments.update(josué, elenco.brf.id, criada.code, máquina())).resolves.toBeTruthy();
    });

    it('deve excluir de verdade o equipamento sem análise, com a foto junto', async () => {
      const josué = await escopo(elenco.josué.id);
      const criada = await equipments.create(josué, elenco.brf.id, máquina());
      await equipments.setPhoto(josué, elenco.brf.id, criada.code, await foto());

      await equipments.remove(josué, elenco.brf.id, criada.code);

      expect(await ctx.prisma.equipment.count()).toBe(0);
      expect(await ctx.prisma.fileAsset.count()).toBe(0);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  describe('a ficha do ativo', () => {
    const ficha = {
      purpose: 'Transporte de ração',
      productiveCapacity: '10 t/h',
      powerKw: 0.55,
      controlStations: 2,
      exposedOperators: 3,
      energySources: ['ELECTRIC', 'PNEUMATIC'] as const,
      processDescription: 'Recebe a ração do silo e leva à ensacadeira.',
      commonInterventions: 'Limpeza da correia',
      otherInfo: 'Instalada em 2019',
      dimensions: { heightMm: 1200, widthMm: 800, depthMm: 5400, weightKg: 450.5 },
      manufacturer: {
        document: '11.222.333/0001-81',
        registry: 'CREA-SC 12345',
        address: 'Rua das Máquinas, 10',
        city: 'Joinville',
        zipCode: '89201-000',
      },
    };

    it('deve guardar a ficha no equipamento e devolvê-la no detalhe', async () => {
      const fernando = await escopo(elenco.fernando.id);

      const criada = await equipments.create(fernando, elenco.brf.id, máquina({ sheet: { ...ficha, energySources: [...ficha.energySources] } }));
      const aberta = await equipments.get(fernando, elenco.brf.id, criada.code);

      expect(aberta.sheet).toEqual({
        ...ficha,
        energySources: ['ELECTRIC', 'PNEUMATIC'],
        manufacturer: { ...ficha.manufacturer, document: '11222333000181', zipCode: '89201000' },
      });
    });

    it('deve devolver a ficha vazia, e não ausente, para a máquina cadastrada só com o nome', async () => {
      const criada = await equipments.create(await escopo(elenco.josué.id), elenco.brf.id, máquina());

      expect(criada.sheet).toEqual({ energySources: [], dimensions: {}, manufacturer: {} });
    });

    it('deve limpar na edição o que vier vazio, como a identidade', async () => {
      const josué = await escopo(elenco.josué.id);
      const criada = await equipments.create(josué, elenco.brf.id, máquina({ sheet: { ...ficha, energySources: ['ELECTRIC'] } }));

      const editada = await equipments.update(josué, elenco.brf.id, criada.code, máquina({ sheet: { purpose: 'Outra', energySources: [] } }));

      expect(editada.sheet).toEqual({ purpose: 'Outra', energySources: [], dimensions: {}, manufacturer: {} });
    });

    it('deve recusar o CNPJ do fabricante que não é CNPJ, no campo dele', async () => {
      await expect(
        equipments.create(
          await escopo(elenco.josué.id),
          elenco.brf.id,
          máquina({ sheet: { energySources: [], manufacturer: { document: '11.222.333/0001-82' } } }),
        ),
      ).rejects.toMatchObject({ response: { field: 'sheet.manufacturer.document' } });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  describe('a foto', () => {
    it('deve devolver a miniatura na lista e o original no detalhe', async () => {
      const fernando = await escopo(elenco.fernando.id);
      const criada = await equipments.create(fernando, elenco.brf.id, máquina());

      const { photoUrl, thumbnailUrl } = await equipments.setPhoto(fernando, elenco.brf.id, criada.code, await foto());

      expect(photoUrl).toBeTruthy();
      expect(thumbnailUrl).toBeTruthy();
      expect(thumbnailUrl).not.toBe(photoUrl);
      const [linha] = await equipments.list(fernando, elenco.brf.id);
      expect(linha.thumbnailUrl).toBe(thumbnailUrl);
      expect((await equipments.get(fernando, elenco.brf.id, criada.code)).photoUrl).toBe(photoUrl);
    });

    it('deve preservar a foto antiga ao trocar, como o logo: o laudo aponta para a da época', async () => {
      const josué = await escopo(elenco.josué.id);
      const criada = await equipments.create(josué, elenco.brf.id, máquina());
      await equipments.setPhoto(josué, elenco.brf.id, criada.code, await foto());
      await equipments.setPhoto(josué, elenco.brf.id, criada.code, await foto());
      await equipments.removePhoto(josué, elenco.brf.id, criada.code);

      expect(await ctx.prisma.fileAsset.count({ where: { equipmentId: criada.id } })).toBe(2);
      expect((await equipments.get(josué, elenco.brf.id, criada.code)).photoUrl).toBeUndefined();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  describe('série e patrimônio repetidos', () => {
    it('deve apontar quem já usa, sem recusar o cadastro', async () => {
      const josué = await escopo(elenco.josué.id);
      const primeira = await equipments.create(
        josué,
        elenco.brf.id,
        máquina({ name: 'Esteira 1', serialNumber: '871639', patrimonyCode: 'P-1' }),
      );
      await expect(
        equipments.create(josué, elenco.brf.id, máquina({ name: 'Esteira 2', serialNumber: '871639' })),
      ).resolves.toBeTruthy();

      const aviso = await equipments.duplicates(josué, elenco.brf.id, {
        serialNumber: ' 871639 ',
        patrimonyCode: 'p-1',
        except: primeira.code,
      });

      expect(aviso.serialNumber.map((e) => e.name)).toEqual(['Esteira 2']);
      expect(aviso.patrimonyCode).toEqual([]);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  describe('setores', () => {
    it('deve devolver o setor que já existe quando o nome é o mesmo sem acento e caixa', async () => {
      const marcos = await escopo(elenco.marcos.id);
      const primeiro = await sectors.create(marcos, elenco.brf.id, { name: 'Usinagem' });

      const denovo = await sectors.create(marcos, elenco.brf.id, { name: '  usinágem ' });

      expect(primeiro.existing).toBe(false);
      expect(denovo).toMatchObject({ id: primeiro.id, name: 'Usinagem', existing: true });
    });

    it('deve listar com a contagem de equipamentos, e o setor só vale na empresa dele', async () => {
      const josué = await escopo(elenco.josué.id);
      const usinagem = await sectors.create(josué, elenco.brf.id, { name: 'Usinagem' });
      await equipments.create(josué, elenco.brf.id, máquina({ sectorId: usinagem.id }));
      await sectors.create(josué, elenco.seara.id, { name: 'Usinagem' });

      const daBrf = await sectors.list(josué, elenco.brf.id);

      expect(daBrf).toHaveLength(1);
      expect(daBrf[0]).toMatchObject({ name: 'Usinagem', equipmentsCount: 1 });
      expect(daBrf[0].actions).toEqual({ edit: true, merge: true, delete: false });
    });

    it('deve renomear, e recusar o nome de outro setor apontando a mesclagem', async () => {
      const josué = await escopo(elenco.josué.id);
      const a = await sectors.create(josué, elenco.brf.id, { name: 'Usinagem' });
      await sectors.create(josué, elenco.brf.id, { name: 'Caldeiraria' });

      const renomeado = await sectors.update(josué, elenco.brf.id, a.id, { name: 'Usinagem pesada' });
      expect(renomeado.name).toBe('Usinagem pesada');

      await expect(sectors.update(josué, elenco.brf.id, a.id, { name: 'caldeiraria' })).rejects.toMatchObject({
        response: { field: 'name', message: expect.stringContaining('Mesclar') },
      });
    });

    it('deve mesclar: os equipamentos passam para o setor que fica, e o outro some', async () => {
      const josué = await escopo(elenco.josué.id);
      const certo = await sectors.create(josué, elenco.brf.id, { name: 'Usinagem' });
      const errado = await sectors.create(josué, elenco.brf.id, { name: 'Usinagen' });
      const torno = await equipments.create(josué, elenco.brf.id, máquina({ sectorId: errado.id }));

      await sectors.merge(josué, elenco.brf.id, errado.id, { intoSectorId: certo.id });

      expect((await equipments.get(josué, elenco.brf.id, torno.code)).sector?.id).toBe(certo.id);
      expect((await sectors.list(josué, elenco.brf.id)).map((s) => s.name)).toEqual(['Usinagem']);
    });

    it('deve excluir só o setor sem equipamento', async () => {
      const josué = await escopo(elenco.josué.id);
      const vazio = await sectors.create(josué, elenco.brf.id, { name: 'Vazio' });
      const ocupado = await sectors.create(josué, elenco.brf.id, { name: 'Ocupado' });
      await equipments.create(josué, elenco.brf.id, máquina({ sectorId: ocupado.id }));

      await sectors.remove(josué, elenco.brf.id, vazio.id);
      await expect(sectors.remove(josué, elenco.brf.id, ocupado.id)).rejects.toThrow(ConflictException);

      expect((await sectors.list(josué, elenco.brf.id)).map((s) => s.name)).toEqual(['Ocupado']);
    });

    it('não deve deixar a Diretora criar setor', async () => {
      await expect(sectors.create(await escopo(elenco.débora.id), elenco.brf.id, { name: 'X' })).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  describe('tipos de máquina', () => {
    it('deve oferecer o catálogo global e o da consultoria, sem o de outra conta', async () => {
      const josué = await escopo(elenco.josué.id);
      await machineTypes.create(josué, { name: 'Tombador de caixas' });
      const rival = await montarConsultoriaRival(ctx.prisma);
      await ctx.prisma.machineType.create({ data: { accountId: rival.conta.id, name: 'Secreto', normalizedName: 'secreto' } });

      const catálogo = await machineTypes.list(josué);

      expect(catálogo.map((t) => t.name)).toEqual(['Esteira transportadora', 'Prensa hidráulica', 'Tombador de caixas']);
      expect(catálogo.find((t) => t.name === 'Tombador de caixas')?.global).toBe(false);
    });

    it('deve buscar sem ligar para acento e caixa', async () => {
      const achados = await machineTypes.list(await escopo(elenco.josué.id), 'PRENSA hidraulica');

      expect(achados.map((t) => t.name)).toEqual(['Prensa hidráulica']);
    });

    it('deve devolver o tipo que já existe, global ou da conta, em vez de criar outro', async () => {
      const josué = await escopo(elenco.josué.id);

      const global = await machineTypes.create(josué, { name: ' prensa HIDRÁULICA ' });
      const primeira = await machineTypes.create(josué, { name: 'Tombador' });
      const denovo = await machineTypes.create(josué, { name: 'tombador' });

      expect(global.id).toBe('mt-prensa-hidraulica');
      expect(denovo.id).toBe(primeira.id);
    });

    it('deve deixar só a consultoria acrescentar tipo ao catálogo', async () => {
      await expect(machineTypes.create(await escopo(elenco.fernando.id), { name: 'Novo' })).resolves.toBeTruthy();

      await expect(machineTypes.create(await escopo(elenco.marcos.id), { name: 'Do cliente' })).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});

/** Uma foto de verdade: o servidor decodifica para gerar a miniatura. */
function foto() {
  return sharp({ create: { width: 1200, height: 900, channels: 3, background: '#468' } }).jpeg().toBuffer();
}
