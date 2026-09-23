import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type Role } from '@prisma/client';
import {
  COMPANY_ADMIN_ROLES,
  ROLE_ORDER,
  ROLE_SIDE,
  isValidCnpj,
  normalizeForSearch,
  onlyDigits,
  type CompanyActions,
  type CompanyDetail,
  type CompanyGroupOption,
  type CompanyListItem,
  type CompanyListQuery,
  type CompanyMetrics,
  type CompanyProfile,
  type CompanyStatus,
  type CompanyUpsertRequest,
  type CompanyView,
} from '@normatiza/shared';

import { AuditAction, AuditService } from '../audit/audit.service';
import { PermissionService, SessionScope } from '../authorization/permission.service';
import { PrismaService } from '../prisma/prisma.service';
import { FilesService } from '../storage/files.service';
import { responsáveisTécnicos } from '../team/team.service';
import { COM_GESTORES, gestoresDaEmpresa, statusDaEmpresa } from './company-status';
import { CompanyWriteGuard } from './company-write-guard.service';

/** O que a lista, o detalhe e o formulário precisam trazer de uma empresa. */
const COMPLETA = {
  ...COM_GESTORES,
  group: { select: { id: true, name: true } },
  logo: { select: { storageKey: true } },
} satisfies Prisma.CompanyInclude;

type EmpresaCompleta = Prisma.CompanyGetPayload<{ include: typeof COMPLETA }>;

/**
 * O cadastro de empresas — Contexto 1, e o diálogo de dados do Contexto 2.
 *
 * Regras: docs/produto/01 §4 e §5, 03 §3.2 e §4.0, 04 §2.
 */
@Injectable()
export class CompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionService,
    private readonly writeGuard: CompanyWriteGuard,
    private readonly files: FilesService,
    private readonly audit: AuditService,
  ) {}

  // ── Leitura ────────────────────────────────────────────────────────────────

  /**
   * A carteira de quem pergunta. É a carteira **da consultoria**: quem só tem
   * papel do lado cliente recebe lista vazia — ele não tem camada acima da
   * empresa dele, e nunca chega nesta tela.
   *
   * Busca e filtro rodam em memória sobre a carteira já recortada (D6): são
   * centenas de linhas, e o mesmo `normalizeForSearch` do shared decide o que é
   * igual a quê.
   */
  async list(actor: SessionScope, query: CompanyListQuery = {}): Promise<CompanyListItem[]> {
    const ids = this.carteiraDaConsultoria(actor);
    if (ids.length === 0) return [];

    const empresas = await this.prisma.company.findMany({
      where: { accountId: actor.accountId, id: { in: ids } },
      include: COMPLETA,
    });

    const agora = new Date();
    const status = query.status;

    return empresas
      .map((empresa) => ({ empresa, status: statusDaEmpresa(empresa, agora) }))
      .filter((e) =>
        status === 'ALL' ? true : status ? e.status === status : e.status !== 'INACTIVE',
      )
      .filter((e) => !query.q || corresponde(e.empresa, query.q))
      .sort((a, b) => a.empresa.tradeName.localeCompare(b.empresa.tradeName, 'pt-BR'))
      .map(({ empresa, status }) => ({
        id: empresa.id,
        tradeName: empresa.tradeName,
        corporateName: empresa.corporateName,
        document: empresa.document,
        city: empresa.city,
        state: empresa.state,
        status,
        managers: gestoresDaEmpresa(empresa).map((g) => ({
          id: g.id,
          name: g.name,
          pending: g.status !== 'ACTIVE',
        })),
        ...métricasDaEmpresa(),
        actions: this.açõesSobre(actor, empresa.id, status),
      }));
  }

  /**
   * Uma empresa — em uma de duas formas, e quem escolhe é o servidor (D14). Da
   * consultoria, o cadastro inteiro; do cliente, sem o que a consultoria anota
   * sobre ele.
   */
  async get(actor: SessionScope, companyId: string): Promise<CompanyView> {
    // O Executor tem vínculo, mas o escopo dele são as tarefas: para ele, a
    // empresa como um todo não é algo que exista.
    if (!this.permissions.canReadCompanyData(actor, companyId)) {
      throw new NotFoundException();
    }

    return this.projetar(actor, companyId, this.permissions.effectiveRoles(actor, companyId));
  }

  async listGroups(actor: SessionScope, q?: string): Promise<CompanyGroupOption[]> {
    const ids = this.carteiraDaConsultoria(actor);
    if (ids.length === 0) return [];

    const grupos = await this.prisma.companyGroup.findMany({
      where: { accountId: actor.accountId, companies: { some: { id: { in: ids } } } },
      select: { id: true, name: true, normalizedName: true },
      orderBy: { name: 'asc' },
    });

    const termo = q ? normalizeForSearch(q) : '';
    return grupos
      .filter((g) => g.normalizedName.includes(termo))
      .map(({ id, name }) => ({ id, name }));
  }

  // ── Cadastro ───────────────────────────────────────────────────────────────

  /**
   * Cria a empresa **e** os vínculos que a tornam visível: o de quem cadastrou
   * e o de cada Engenheiro Responsável da conta (invariante 6 de
   * docs/produto/04 §1). Sem eles a empresa nasceria invisível — inclusive
   * para o dono da conta, cujo escopo também é feito de vínculos.
   */
  async create(actor: SessionScope, dto: CompanyUpsertRequest): Promise<CompanyDetail> {
    const conta = await this.prisma.account.findUniqueOrThrow({
      where: { id: actor.accountId },
      select: { ownerUserId: true },
    });

    const papelDeQuemCria = this.papelParaCadastrar(actor, conta.ownerUserId);
    if (!papelDeQuemCria) {
      throw new ForbiddenException('Só o Engenheiro Responsável e o Engenheiro da Consultoria cadastram empresas.');
    }

    const dados = this.dadosDoCadastro(dto);
    await this.assertCnpjLivre(actor.accountId, dados.document);

    const engenheirosResponsáveis = await this.engenheirosResponsáveis(actor.accountId, conta.ownerUserId);

    const papéis = new Map<string, Role>(engenheirosResponsáveis.map((id) => [id, 'LEAD_ENGINEER']));
    papéis.set(actor.userId, papelDeQuemCria);

    const empresa = await this.gravar(() =>
      this.prisma.$transaction(async (tx) => {
        const groupId = await resolverGrupo(tx, actor, dto.groupName);

        const criada = await tx.company.create({
          data: { accountId: actor.accountId, createdByUserId: actor.userId, groupId, ...dados },
        });

        await tx.membership.createMany({
          data: [...papéis].map(([userId, papel]) => ({
            accountId: actor.accountId,
            userId,
            companyId: criada.id,
            roles: [papel],
            createdByUserId: actor.userId,
          })),
        });

        return criada;
      }),
    );

    await this.audit.record({
      action: AuditAction.COMPANY_CREATED,
      entityType: 'Company',
      entityId: empresa.id,
      accountId: actor.accountId,
      actorUserId: actor.userId,
      after: { ...dados, groupName: dto.groupName ?? null },
    });

    return this.projetar(actor, empresa.id, [papelDeQuemCria]) as Promise<CompanyDetail>;
  }

  async update(
    actor: SessionScope,
    companyId: string,
    dto: CompanyUpsertRequest,
  ): Promise<CompanyDetail> {
    const antes = await this.carregarParaAdministrar(actor, companyId);
    await this.writeGuard.assertWritable(actor.accountId, [companyId]);

    const dados = this.dadosDoCadastro(dto);
    await this.assertCnpjLivre(actor.accountId, dados.document, companyId);

    await this.gravar(() =>
      this.prisma.$transaction(async (tx) => {
        const groupId = await resolverGrupo(tx, actor, dto.groupName);
        await tx.company.update({ where: { id: companyId }, data: { ...dados, groupId } });
      }),
    );

    await this.audit.record({
      action: AuditAction.COMPANY_UPDATED,
      entityType: 'Company',
      entityId: companyId,
      accountId: actor.accountId,
      actorUserId: actor.userId,
      before: retratoDoCadastro(antes),
      after: { ...dados, groupName: dto.groupName ?? null },
    });

    return this.projetar(actor, companyId, this.permissions.effectiveRoles(actor, companyId)) as Promise<CompanyDetail>;
  }

  /** Inativa é modo leitura, não despejo: ninguém perde acesso (docs/produto/01 §5). */
  async deactivate(actor: SessionScope, companyId: string): Promise<void> {
    const empresa = await this.carregarParaAdministrar(actor, companyId);
    if (empresa.deactivatedAt) throw new ConflictException('A empresa já está inativa.');

    await this.prisma.company.update({
      where: { id: companyId },
      data: { deactivatedAt: new Date(), deactivatedByUserId: actor.userId },
    });

    await this.audit.record({
      action: AuditAction.COMPANY_DEACTIVATED,
      entityType: 'Company',
      entityId: companyId,
      accountId: actor.accountId,
      actorUserId: actor.userId,
    });
  }

  /** Volta a ativa ou a em implantação — decide o Gestor, não quem reativa. */
  async reactivate(actor: SessionScope, companyId: string): Promise<void> {
    const empresa = await this.carregarParaAdministrar(actor, companyId);
    if (!empresa.deactivatedAt) throw new ConflictException('A empresa não está inativa.');

    await this.prisma.company.update({
      where: { id: companyId },
      data: { deactivatedAt: null, deactivatedByUserId: null },
    });

    await this.audit.record({
      action: AuditAction.COMPANY_REACTIVATED,
      entityType: 'Company',
      entityId: companyId,
      accountId: actor.accountId,
      actorUserId: actor.userId,
      before: { deactivatedAt: empresa.deactivatedAt, deactivatedByUserId: empresa.deactivatedByUserId },
    });
  }

  // ── Logo ───────────────────────────────────────────────────────────────────

  /**
   * Troca o logo. O arquivo anterior **fica**: o laudo emitido no ano passado
   * continua apontando para ele.
   */
  async setLogo(actor: SessionScope, companyId: string, bytes: Buffer): Promise<{ logoUrl: string | null }> {
    const empresa = await this.carregarParaAdministrar(actor, companyId);
    await this.writeGuard.assertWritable(actor.accountId, [companyId]);

    const arquivo = await this.files.uploadCompanyLogo({
      accountId: actor.accountId,
      companyId,
      actorUserId: actor.userId,
      bytes,
    });

    await this.prisma.company.update({ where: { id: companyId }, data: { logoFileId: arquivo.id } });

    await this.audit.record({
      action: AuditAction.COMPANY_LOGO_CHANGED,
      entityType: 'Company',
      entityId: companyId,
      accountId: actor.accountId,
      actorUserId: actor.userId,
      before: { logoFileId: empresa.logoFileId },
      after: { logoFileId: arquivo.id },
    });

    return { logoUrl: await this.files.readUrl(arquivo) };
  }

  async removeLogo(actor: SessionScope, companyId: string): Promise<void> {
    const empresa = await this.carregarParaAdministrar(actor, companyId);
    await this.writeGuard.assertWritable(actor.accountId, [companyId]);
    if (!empresa.logoFileId) return;

    await this.prisma.company.update({ where: { id: companyId }, data: { logoFileId: null } });

    await this.audit.record({
      action: AuditAction.COMPANY_LOGO_CHANGED,
      entityType: 'Company',
      entityId: companyId,
      accountId: actor.accountId,
      actorUserId: actor.userId,
      before: { logoFileId: empresa.logoFileId },
      after: { logoFileId: null },
    });
  }

  // ── Alçada ─────────────────────────────────────────────────────────────────

  /** Empresas em que quem pergunta tem papel **de consultoria**. */
  private carteiraDaConsultoria(actor: SessionScope): string[] {
    return this.permissions
      .companiesInScope(actor)
      .filter((id) => this.permissions.effectiveRoles(actor, id).some((p) => ROLE_SIDE[p] === 'CONSULTANCY'));
  }

  private administra(actor: SessionScope, companyId: string): boolean {
    return this.permissions.effectiveRoles(actor, companyId).some((p) => COMPANY_ADMIN_ROLES.includes(p));
  }

  private açõesSobre(actor: SessionScope, companyId: string, status: CompanyStatus): CompanyActions {
    const administra = this.administra(actor, companyId);
    const inativa = status === 'INACTIVE';
    return { edit: administra && !inativa, deactivate: administra && !inativa, reactivate: administra && inativa };
  }

  /**
   * Com que papel quem cadastra entra na empresa nova — ou `null` se não pode
   * cadastrar. O titular da conta sempre pode, e entra como Engenheiro
   * Responsável: numa conta recém-aberta ele ainda não tem vínculo nenhum, e
   * sem isto não haveria como cadastrar a primeira empresa.
   */
  private papelParaCadastrar(actor: SessionScope, ownerUserId: string | null): Role | null {
    if (actor.userId === ownerUserId) return 'LEAD_ENGINEER';

    const papéis = new Set(actor.memberships.filter((v) => v.isActive).flatMap((v) => v.roles));
    return ROLE_ORDER.find((p) => COMPANY_ADMIN_ROLES.includes(p) && papéis.has(p)) ?? null;
  }

  /**
   * Todo Engenheiro Responsável da conta que não foi desligado — inclusive quem
   * ainda não aceitou o convite: quando aceitar, a empresa tem de estar lá. O
   * titular entra sempre, mesmo sem vínculo.
   */
  private async engenheirosResponsáveis(accountId: string, ownerUserId: string | null): Promise<string[]> {
    const vínculos = await this.prisma.membership.findMany({
      where: { accountId, isActive: true, roles: { has: 'LEAD_ENGINEER' }, user: { status: { not: 'DISABLED' } } },
      select: { userId: true },
      distinct: ['userId'],
    });

    const ids = new Set(vínculos.map((v) => v.userId));
    if (ownerUserId) ids.add(ownerUserId);
    return [...ids];
  }

  /**
   * A empresa, para quem vai mexer nela. Fora do escopo é 404, e não 403: um
   * 403 contaria à Carla que existe uma empresa ali (D13). Dentro do escopo e
   * sem alçada, aí sim é 403.
   */
  private async carregarParaAdministrar(actor: SessionScope, companyId: string) {
    if (!this.permissions.canAccessCompany(actor, companyId)) throw new NotFoundException();

    const empresa = await this.prisma.company.findFirst({
      where: { id: companyId, accountId: actor.accountId },
      include: COMPLETA,
    });
    if (!empresa) throw new NotFoundException();

    if (!this.administra(actor, companyId)) {
      throw new ForbiddenException('Só o Engenheiro Responsável e o Engenheiro da Consultoria administram o cadastro da empresa.');
    }

    return empresa;
  }

  // ── Validação que depende do banco ─────────────────────────────────────────

  /** O formato foi conferido no DTO; aqui se normaliza e se confere de novo, porque o serviço não confia em quem o chama. */
  private dadosDoCadastro(dto: CompanyUpsertRequest) {
    const document = onlyDigits(dto.document);
    if (!isValidCnpj(document)) {
      throw new BadRequestException({ message: 'CNPJ inválido.', field: 'document', statusCode: 400 });
    }

    return {
      corporateName: dto.corporateName.trim(),
      tradeName: dto.tradeName.trim(),
      document,
      stateRegistration: vazioComoNulo(dto.stateRegistration),
      contactName: dto.contact.name.trim(),
      contactRole: vazioComoNulo(dto.contact.role),
      contactEmail: dto.contact.email.trim().toLowerCase(),
      contactPhone: vazioComoNulo(dto.contact.phone),
      contactMobile: vazioComoNulo(dto.contact.mobile),
      zipCode: onlyDigits(dto.address.zipCode),
      street: dto.address.street.trim(),
      addressNumber: dto.address.number.trim(),
      complement: vazioComoNulo(dto.address.complement),
      district: dto.address.district.trim(),
      city: dto.address.city.trim(),
      state: dto.address.state.trim().toUpperCase(),
      externalCode: vazioComoNulo(dto.externalCode),
      notes: vazioComoNulo(dto.notes),
    };
  }

  /**
   * CNPJ é único **na conta**. A mesma indústria pode ser cliente de duas
   * consultorias — cada uma com o seu cadastro.
   */
  private async assertCnpjLivre(accountId: string, document: string, exceto?: string): Promise<void> {
    const outra = await this.prisma.company.findFirst({
      where: { accountId, document, ...(exceto ? { id: { not: exceto } } : {}) },
      select: { id: true },
    });
    if (outra) throw cnpjRepetido();
  }

  /** A checagem acima perde para duas gravações simultâneas; o índice do banco não perde. */
  private async gravar<T>(operação: () => Promise<T>): Promise<T> {
    try {
      return await operação();
    } catch (erro) {
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002') {
        const alvo = String(erro.meta?.target ?? '');
        if (alvo.includes('document')) throw cnpjRepetido();
      }
      throw erro;
    }
  }

  // ── Projeção ───────────────────────────────────────────────────────────────

  private async projetar(actor: SessionScope, companyId: string, papéis: Role[]): Promise<CompanyView> {
    const [empresa, conta, vínculos] = await Promise.all([
      this.prisma.company.findFirst({ where: { id: companyId, accountId: actor.accountId }, include: COMPLETA }),
      this.prisma.account.findUniqueOrThrow({ where: { id: actor.accountId }, select: { name: true } }),
      this.prisma.membership.findMany({
        where: { companyId, accountId: actor.accountId, isActive: true },
        include: { user: { select: { name: true, registryType: true, registryNumber: true } } },
        orderBy: { user: { name: 'asc' } },
      }),
    ]);
    if (!empresa) throw new NotFoundException();

    const status = statusDaEmpresa(empresa);
    const logoUrl = empresa.logo ? ((await this.files.readUrl(empresa.logo)) ?? undefined) : undefined;

    // Explícito, campo a campo: é isto que impede um campo novo do banco de
    // chegar ao cliente por descuido de serialização.
    const perfil: CompanyProfile = {
      view: 'CLIENT',
      id: empresa.id,
      tradeName: empresa.tradeName,
      corporateName: empresa.corporateName,
      document: empresa.document,
      stateRegistration: empresa.stateRegistration ?? undefined,
      contact: {
        name: empresa.contactName,
        role: empresa.contactRole ?? undefined,
        email: empresa.contactEmail,
        phone: empresa.contactPhone ?? undefined,
        mobile: empresa.contactMobile ?? undefined,
      },
      address: {
        zipCode: empresa.zipCode,
        street: empresa.street,
        number: empresa.addressNumber,
        complement: empresa.complement ?? undefined,
        district: empresa.district,
        city: empresa.city,
        state: empresa.state,
      },
      status,
      logoUrl,
      accountName: conta.name,
      technicalResponsibles: responsáveisTécnicos(vínculos),
    };

    const olhaDaConsultoria = papéis.some((p) => ROLE_SIDE[p] === 'CONSULTANCY');
    if (!olhaDaConsultoria) return perfil;

    const administra = papéis.some((p) => COMPANY_ADMIN_ROLES.includes(p));
    const inativa = status === 'INACTIVE';

    return {
      ...perfil,
      view: 'CONSULTANCY',
      group: empresa.group ?? undefined,
      externalCode: empresa.externalCode ?? undefined,
      notes: empresa.notes ?? undefined,
      managers: gestoresDaEmpresa(empresa).map((g) => ({
        id: g.id,
        name: g.name,
        pending: g.status !== 'ACTIVE',
        email: g.email,
        phone: g.phone ?? undefined,
        jobTitle: g.jobTitle ?? undefined,
      })),
      actions: { edit: administra && !inativa, deactivate: administra && !inativa, reactivate: administra && inativa },
    };
  }
}

// ── Funções puras ────────────────────────────────────────────────────────────

/**
 * Os números da operação. **O único ponto a trocar** quando equipamentos e
 * análises existirem (D5): até lá, zero equipamento é verdade, e adequação sem
 * análise não tem medida — por isso ela não vem.
 */
function métricasDaEmpresa(): CompanyMetrics {
  return { equipmentsCount: 0, openPointsCount: 0 };
}

/**
 * A busca olha tudo que foi cadastrado, **menos observações** (docs/produto/03
 * §3.2). CNPJ e CEP também são comparados só por dígitos, para que a máscara
 * — ou a falta dela — não decida o resultado.
 */
function corresponde(empresa: EmpresaCompleta, q: string): boolean {
  const termo = normalizeForSearch(q);
  const texto = normalizeForSearch(
    [
      empresa.corporateName,
      empresa.tradeName,
      empresa.document,
      empresa.stateRegistration,
      empresa.contactName,
      empresa.contactRole,
      empresa.contactEmail,
      empresa.zipCode,
      empresa.street,
      empresa.addressNumber,
      empresa.complement,
      empresa.district,
      empresa.city,
      empresa.state,
      empresa.externalCode,
      empresa.group?.name,
      ...gestoresDaEmpresa(empresa).map((g) => g.name),
    ]
      .filter(Boolean)
      .join(' \u0000 '),
  );

  if (termo && texto.includes(termo)) return true;

  const dígitos = onlyDigits(q);
  return dígitos.length >= 3 && `${empresa.document} ${empresa.zipCode}`.includes(dígitos);
}

/**
 * O grupo pelo nome: reaproveita o que já existe na conta, ou cria. Reaproveita
 * **mesmo fora da carteira** de quem cadastra, e sem contar isso a ninguém
 * (D21) — duplicar seria pior, e a tela nunca soube o id.
 */
async function resolverGrupo(
  tx: Prisma.TransactionClient,
  actor: SessionScope,
  nome: string | null | undefined,
): Promise<string | null> {
  const limpo = (nome ?? '').replace(/\s+/g, ' ').trim();
  if (!limpo) return null;

  const normalizedName = normalizeForSearch(limpo);
  const grupo = await tx.companyGroup.upsert({
    where: { accountId_normalizedName: { accountId: actor.accountId, normalizedName } },
    update: {},
    create: { accountId: actor.accountId, name: limpo, normalizedName, createdByUserId: actor.userId },
  });
  return grupo.id;
}

function vazioComoNulo(valor: string | null | undefined): string | null {
  const limpo = valor?.trim();
  return limpo ? limpo : null;
}

function cnpjRepetido(): ConflictException {
  return new ConflictException({
    statusCode: 409,
    message: 'Já existe uma empresa com este CNPJ nesta conta.',
    field: 'document',
  });
}

function retratoDoCadastro(empresa: EmpresaCompleta) {
  const { memberships: _m, logo: _l, group, ...campos } = empresa;
  return { ...campos, groupName: group?.name ?? null };
}
