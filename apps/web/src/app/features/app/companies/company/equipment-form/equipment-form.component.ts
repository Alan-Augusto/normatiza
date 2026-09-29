import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormsModule,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideBox, lucideCamera, lucideCheck, lucideCog, lucideMapPin, lucideRuler } from '@ng-icons/lucide';
import { AutoComplete, type AutoCompleteCompleteEvent } from 'primeng/autocomplete';
import { Button, ButtonDirective, ButtonLabel } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { Textarea } from 'primeng/textarea';
import { Step, StepList, Stepper } from 'primeng/stepper';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Observable, TimeoutError, catchError, map, of, switchMap, timeout } from 'rxjs';

import {
  ENERGY_SOURCES,
  ENERGY_SOURCE_LABEL,
  MACHINE_TYPE_CREATOR_ROLES,
  equipmentCodeForUrl,
  isValidCnpj,
  normalizeForSearch,
  type EnergySource,
  type EquipmentSheet,
  type EquipmentDetail,
  type EquipmentRef,
  type EquipmentUpsertRequest,
  type MachineTypeOption,
  type SectorListItem,
} from '@normatiza/shared';

import { AuthService } from '../../../../../core/auth/auth.service';
import { CampoComponent } from '../../../../../shared/components/form/campo.component';
import { MascaraDirective } from '../../../../../shared/components/form/mascara.directive';
import { NumeroComponent } from '../../../../../shared/components/form/numero.component';
import { FormularioComAlteracoes } from '../../../../../core/guards/unsaved-changes.guard';
import { mensagemDoServidor } from '../../../../../core/http/mensagem-de-erro';
import { empresaDaRota } from '../../../../../core/routing/empresa-da-rota';
import { ROTAS } from '../../../../../core/routing/rotas';
import { InventoryService } from '../../../../../core/services/inventory.service';

/** A foto de celular com folga — o mesmo teto do servidor. */
const FOTO_MAX_BYTES = 10 * 1024 * 1024;
const FOTO_TIPOS = ['image/png', 'image/jpeg', 'image/webp'];

/** Quanto cada etapa do salvar espera o servidor — a mesma regra do cadastro de empresa. */
const LIMITE_DE_ESPERA_MS = 20_000;

type Campo = keyof EquipmentFormComponent['form']['controls'];

interface Etapa {
  valor: number;
  chave: 'identificacao' | 'planta' | 'operacao' | 'porte' | 'foto';
  titulo: string;
  icone: string;
  /** Os campos que esta etapa confere antes de deixar avançar. */
  campos: Campo[];
}

/**
 * As cinco etapas, na ordem em que a pessoa tem a informação diante da máquina:
 * o que ela é (a plaqueta), onde está e como a planta a chama, como ela
 * trabalha, o porte e quem a fabricou, e por fim a foto — a última coisa que se
 * faz, com o celular na mão. Da terceira em diante, a ficha do ativo
 * (docs/produto/03 §4.2): tudo opcional.
 */
const ETAPAS: readonly Etapa[] = [
  { valor: 1, chave: 'identificacao', titulo: 'Identificação', icone: 'lucideBox', campos: ['nome', 'tipo', 'modelo', 'fabricante', 'ano', 'serie'] },
  { valor: 2, chave: 'planta', titulo: 'Na planta', icone: 'lucideMapPin', campos: ['setor', 'tag', 'patrimonio'] },
  {
    valor: 3,
    chave: 'operacao',
    titulo: 'Operação',
    icone: 'lucideCog',
    campos: ['utilizacao', 'capacidade', 'potencia', 'postos', 'operadores', 'energias', 'processo', 'intervencoes', 'outras'],
  },
  {
    valor: 4,
    chave: 'porte',
    titulo: 'Dimensões e fabricante',
    icone: 'lucideRuler',
    campos: ['altura', 'largura', 'profundidade', 'peso', 'fabricanteCnpj', 'fabricanteCrea', 'fabricanteEndereco', 'fabricanteCidade', 'fabricanteCep'],
  },
  { valor: 5, chave: 'foto', titulo: 'Foto', icone: 'lucideCamera', campos: [] },
];

/** A máscara guarda só dígitos: o CNPJ se confere direto, e vazio vale (é opcional). */
const cnpjValido = (c: AbstractControl<string>): ValidationErrors | null =>
  !c.value || isValidCnpj(c.value) ? null : { cnpj: true };

/** CEP incompleto — a máscara aceita até 8 dígitos, mas não obriga a chegar lá. */
const cepCompleto = (c: AbstractControl<string>): ValidationErrors | null =>
  !c.value || c.value.length === 8 ? null : { cep: true };

const PRIMEIRO_ANO = 1900;
const ÚLTIMO_ANO = new Date().getFullYear() + 1;

/** O que o campo numérico guarda vira o que a API espera: ausente, não `null`. */
const ouAusente = (n: number | null): number | undefined => n ?? undefined;

/**
 * Cadastro e edição do equipamento — Contexto 2 (docs/produto/03 §4.2).
 *
 * **Só o nome é obrigatório.** A ficha técnica densa se preenche na análise, e
 * um cadastro que exige o que ninguém tem em mãos no chão da fábrica não é
 * feito. Página própria, e não diálogo, pelo mesmo motivo do cadastro de
 * empresa: foto e buscas rolam por dentro e se perderiam num ESC.
 *
 * Setor e tipo são digitados livremente e resolvidos ao salvar: o que já existe
 * — sem acento nem caixa — é reaproveitado; o setor novo é criado por quem
 * cadastra; o tipo novo, só pela consultoria, dona do catálogo.
 */
@Component({
  selector: 'app-equipment-form',
  standalone: true,
  imports: [
    CampoComponent,
    NumeroComponent,
    MascaraDirective,
    FormsModule,
    Checkbox,
    Textarea,
    ReactiveFormsModule,
    RouterLink,
    NgIconComponent,
    AutoComplete,
    Button,
    ButtonDirective,
    ButtonLabel,
    InputText,
    Message,
    Stepper,
    StepList,
    Step,
  ],
  providers: [provideIcons({ lucideBox, lucideMapPin, lucideCog, lucideRuler, lucideCamera, lucideCheck })],
  templateUrl: './equipment-form.component.html',
  styleUrls: ['../../../../../shared/styles/cadastro-em-etapas.css', './equipment-form.component.css'],
})
export class EquipmentFormComponent implements OnInit, FormularioComAlteracoes {
  private readonly inventory = inject(InventoryService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);

  private readonly empresa = empresaDaRota();

  readonly sobreOQue = 'neste equipamento';

  readonly form = this.fb.group({
    nome: this.fb.control('', [Validators.required, Validators.maxLength(160)]),
    tipo: this.fb.control(''),
    modelo: this.fb.control(''),
    fabricante: this.fb.control(''),
    serie: this.fb.control(''),
    ano: this.fb.control<number | null>(null, [Validators.min(PRIMEIRO_ANO), Validators.max(ÚLTIMO_ANO)]),
    tag: this.fb.control(''),
    patrimonio: this.fb.control(''),
    setor: this.fb.control(''),

    // Ficha do ativo
    utilizacao: this.fb.control(''),
    capacidade: this.fb.control(''),
    potencia: this.fb.control<number | null>(null),
    postos: this.fb.control<number | null>(null),
    operadores: this.fb.control<number | null>(null),
    energias: this.fb.control<EnergySource[]>([]),
    processo: this.fb.control(''),
    intervencoes: this.fb.control(''),
    outras: this.fb.control(''),
    altura: this.fb.control<number | null>(null),
    largura: this.fb.control<number | null>(null),
    profundidade: this.fb.control<number | null>(null),
    peso: this.fb.control<number | null>(null),
    fabricanteCnpj: this.fb.control('', cnpjValido),
    fabricanteCrea: this.fb.control(''),
    fabricanteEndereco: this.fb.control(''),
    fabricanteCidade: this.fb.control(''),
    fabricanteCep: this.fb.control('', cepCompleto),
  });

  readonly fontesDeEnergia = ENERGY_SOURCES.map((valor) => ({ valor, rotulo: ENERGY_SOURCE_LABEL[valor] }));

  private readonly valores = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  readonly setores = signal<SectorListItem[]>([]);
  readonly tipos = signal<MachineTypeOption[]>([]);
  readonly setoresSugeridos = signal<string[]>([]);
  readonly tiposSugeridos = signal<string[]>([]);

  /** O código do equipamento em edição; nulo no cadastro. */
  readonly code = signal<string | null>(null);
  readonly original = signal<EquipmentDetail | null>(null);
  readonly carregando = signal(false);
  readonly salvando = signal(false);
  readonly erro = signal<string | null>(null);
  readonly erros = signal<Partial<Record<Campo, string>>>({});

  readonly repetidosNaSerie = signal<EquipmentRef[]>([]);
  readonly repetidosNoPatrimonio = signal<EquipmentRef[]>([]);

  readonly fotoEscolhida = signal<File | null>(null);
  readonly fotoPrevia = signal<string | null>(null);
  readonly fotoRemovida = signal(false);
  readonly erroDaFoto = signal<string | null>(null);

  readonly etapas = ETAPAS;
  readonly passo = signal(1);
  readonly alcancado = signal(1);
  readonly etapaAtual = computed(() => ETAPAS[this.passo() - 1]);
  readonly ultimaEtapa = computed(() => this.passo() === ETAPAS.length);

  readonly editando = computed(() => this.code() !== null);
  readonly bloqueado = computed(() => this.original()?.actions.edit === false);

  /** A consultoria acrescenta tipo ao catálogo; o cliente escolhe da lista. */
  readonly criaTipo = computed(() => {
    const empresa = this.empresa();
    return !!empresa && this.auth.rolesInCompany(empresa.id).some((p) => MACHINE_TYPE_CREATOR_ROLES.includes(p));
  });

  readonly setorNovo = computed(() => {
    const nome = normalizeForSearch(this.valores().setor ?? '');
    return !!nome && !this.setores().some((s) => normalizeForSearch(s.name) === nome);
  });

  readonly tipoForaDoCatalogo = computed(() => {
    const nome = normalizeForSearch(this.valores().tipo ?? '');
    const atual = this.original()?.machineType?.name;
    if (atual && normalizeForSearch(atual) === nome) return false;
    return !!nome && !this.tipos().some((t) => normalizeForSearch(t.name) === nome);
  });

  readonly rotaDeVolta = computed(() => {
    const rotas = ROTAS.empresa(this.empresa()?.slug ?? '');
    const code = this.code();
    return code ? rotas.equipamento(code).painel : rotas.equipamentos;
  });

  ngOnInit(): void {
    const empresa = this.empresa();
    if (!empresa) return;

    this.inventory.listSectors(empresa.id).subscribe({
      next: (setores) => this.setores.set(setores),
      error: () => this.setores.set([]),
    });
    this.inventory.listMachineTypes().subscribe({
      next: (tipos) => this.tipos.set(tipos),
      error: () => this.tipos.set([]),
    });

    const code = this.route.snapshot.paramMap.get('equipmentCode');
    if (code) this.carregar(empresa.id, code);
  }

  private carregar(companyId: string, code: string): void {
    this.carregando.set(true);
    this.inventory.getEquipment(companyId, code).subscribe({
      next: (equipamento) => {
        this.carregando.set(false);
        this.code.set(equipamento.code);
        this.original.set(equipamento);
        this.form.setValue({
          nome: equipamento.name,
          tipo: equipamento.machineType?.name ?? '',
          modelo: equipamento.model ?? '',
          fabricante: equipamento.manufacturerName ?? '',
          serie: equipamento.serialNumber ?? '',
          ano: equipamento.manufactureYear ?? null,
          tag: equipamento.tag ?? '',
          patrimonio: equipamento.patrimonyCode ?? '',
          setor: equipamento.sector?.name ?? '',
          ...this.camposDaFicha(equipamento.sheet),
        });
        this.fotoPrevia.set(equipamento.photoUrl ?? null);
        // Na edição o cadastro já está completo: qualquer etapa é um clique.
        this.alcancado.set(ETAPAS.length);
        this.form.markAsPristine();
        if (this.bloqueado()) {
          this.erro.set('Este equipamento está desativado ou fora da sua alçada: aqui ele só é lido.');
          this.form.disable();
        }
      },
      error: (erro) => {
        this.carregando.set(false);
        this.erro.set(mensagemDoServidor(erro, 'Não foi possível carregar o equipamento.'));
      },
    });
  }

  // ── Sugestões ────────────────────────────────────────────────────────────

  filtrarSetores(evento: AutoCompleteCompleteEvent): void {
    this.setoresSugeridos.set(filtrar(this.setores().map((s) => s.name), evento.query));
  }

  filtrarTipos(evento: AutoCompleteCompleteEvent): void {
    this.tiposSugeridos.set(filtrar(this.tipos().map((t) => t.name), evento.query));
  }

  // ── Avisos de repetição ──────────────────────────────────────────────────

  /** Série e patrimônio repetidos não impedem: pode ser engano, pode ser máquina idêntica. */
  conferirRepetidos(campo: 'serie' | 'patrimonio'): void {
    const empresa = this.empresa();
    const valor = this.form.controls[campo].value.trim();
    const alvo = campo === 'serie' ? this.repetidosNaSerie : this.repetidosNoPatrimonio;
    if (!empresa || !valor) {
      alvo.set([]);
      return;
    }

    this.inventory
      .duplicates(empresa.id, {
        ...(campo === 'serie' ? { serialNumber: valor } : { patrimonyCode: valor }),
        ...(this.code() ? { except: this.code()! } : {}),
      })
      .subscribe({
        next: (achados) => alvo.set(campo === 'serie' ? achados.serialNumber : achados.patrimonyCode),
        error: () => alvo.set([]),
      });
  }

  descreverRepetidos(lista: EquipmentRef[]): string {
    return lista.map((e) => `${e.code} · ${e.name}`).join(', ');
  }

  // ── Foto ─────────────────────────────────────────────────────────────────

  aoEscolherFoto(evento: Event): void {
    const arquivo = (evento.target as HTMLInputElement).files?.[0];
    this.erroDaFoto.set(null);
    if (!arquivo) return;

    if (!FOTO_TIPOS.includes(arquivo.type)) {
      this.erroDaFoto.set('A foto precisa ser PNG, JPG ou WebP.');
      return;
    }
    if (arquivo.size > FOTO_MAX_BYTES) {
      this.erroDaFoto.set('A foto pode ter no máximo 10 MB.');
      return;
    }

    this.fotoEscolhida.set(arquivo);
    this.fotoRemovida.set(false);
    this.fotoPrevia.set(typeof URL.createObjectURL === 'function' ? URL.createObjectURL(arquivo) : null);
    this.form.markAsDirty();
  }

  removerFoto(): void {
    this.fotoEscolhida.set(null);
    this.fotoPrevia.set(null);
    this.fotoRemovida.set(true);
    this.form.markAsDirty();
  }

  // ── Etapas ───────────────────────────────────────────────────────────────

  /** Avança só com a etapa em ordem: o erro aparece agora, no campo, e não duas telas depois. */
  avancar(): void {
    const etapa = this.etapaAtual();
    if (etapa.campos.some((nome) => this.form.controls[nome].invalid)) {
      for (const nome of etapa.campos) this.form.controls[nome].markAsTouched();
      return;
    }
    const proximo = Math.min(this.passo() + 1, ETAPAS.length);
    this.alcancado.update((atual) => Math.max(atual, proximo));
    this.passo.set(proximo);
  }

  voltar(): void {
    this.passo.update((atual) => Math.max(1, atual - 1));
  }

  irPara(valor: number | undefined): void {
    if (valor && valor <= this.alcancado()) this.passo.set(valor);
  }

  /**
   * Enter num campo **não** salva nem avança: salvar é um clique, nunca um
   * Enter esbarrado no meio do caminho — a mesma regra do cadastro de empresa.
   */
  semEnter(evento: Event): void {
    if ((evento.target as HTMLElement).tagName !== 'TEXTAREA') evento.preventDefault();
  }

  /** Leva à etapa do campo com problema — o erro que ninguém vê não existe. */
  private irParaACampo(campo: Campo): void {
    const etapa = ETAPAS.find((e) => e.campos.includes(campo));
    if (etapa) this.passo.set(etapa.valor);
  }

  // ── Salvar ───────────────────────────────────────────────────────────────

  erroDe(campo: Campo): string | null {
    const doServidor = this.erros()[campo];
    if (doServidor) return doServidor;
    const controle = this.form.controls[campo];
    if (!controle.touched || controle.valid) return null;
    switch (campo) {
      case 'nome':
        return 'Informe o nome do equipamento.';
      case 'ano':
        return `O ano de fabricação precisa estar entre ${PRIMEIRO_ANO} e ${ÚLTIMO_ANO}.`;
      case 'fabricanteCnpj':
        return 'Esse CNPJ não é válido. Confira os dígitos, ou deixe em branco.';
      case 'fabricanteCep':
        return 'O CEP tem 8 dígitos.';
      default:
        return null;
    }
  }

  alternarEnergia(fonte: EnergySource, marcada: boolean): void {
    const atuais = this.form.controls.energias.value;
    this.form.controls.energias.setValue(marcada ? [...atuais, fonte] : atuais.filter((f) => f !== fonte));
    this.form.markAsDirty();
  }

  temEnergia(fonte: EnergySource): boolean {
    return this.form.controls.energias.value.includes(fonte);
  }

  temAlteracoesNaoSalvas(): boolean {
    return this.form.dirty && !this.salvando();
  }

  salvar(): void {
    this.erros.set({});
    const empresa = this.empresa();
    if (!empresa || this.bloqueado()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      const primeiro = (Object.keys(this.form.controls) as Campo[]).find((c) => this.form.controls[c].invalid);
      if (primeiro) this.irParaACampo(primeiro);
      return;
    }

    this.salvando.set(true);
    this.erro.set(null);

    const code = this.code();
    this.resolverSetor(empresa.id)
      .pipe(
        switchMap((sectorId) => this.resolverTipo().pipe(map((machineTypeId) => this.corpo(sectorId, machineTypeId)))),
        switchMap((corpo) =>
          (code
            ? this.inventory.updateEquipment(empresa.id, code, corpo)
            : this.inventory.createEquipment(empresa.id, corpo)
          ).pipe(timeout(LIMITE_DE_ESPERA_MS)),
        ),
        switchMap((equipamento) => this.aplicarFoto(empresa.id, equipamento)),
      )
      .subscribe({
        next: (equipamento) => {
          this.salvando.set(false);
          this.form.markAsPristine();
          const rotas = ROTAS.empresa(this.empresa()?.slug ?? '');
          if (code) {
            void this.router.navigateByUrl(rotas.equipamento(equipamento.code).painel);
          } else {
            void this.router.navigate([rotas.equipamentos], {
              queryParams: { cadastrado: equipmentCodeForUrl(equipamento.code) },
            });
          }
        },
        error: (erro) => {
          this.salvando.set(false);
          this.recusado(erro);
        },
      });
  }

  /** O setor digitado vira id: o existente, sem acento nem caixa, ou um criado agora. */
  private resolverSetor(companyId: string): Observable<string | null> {
    const nome = this.form.controls.setor.value.trim();
    if (!nome) return of(null);
    const existente = this.setores().find((s) => normalizeForSearch(s.name) === normalizeForSearch(nome));
    if (existente) return of(existente.id);
    return this.inventory.createSector(companyId, { name: nome }).pipe(
      timeout(LIMITE_DE_ESPERA_MS),
      map((setor) => setor.id),
    );
  }

  /**
   * O tipo digitado vira id. Fora do catálogo, a consultoria o acrescenta; o
   * cliente deixa em branco — o hint na tela já disse que a consultoria
   * classifica depois.
   */
  private resolverTipo(): Observable<string | null> {
    const nome = this.form.controls.tipo.value.trim();
    if (!nome) return of(null);
    // O tipo que a máquina já tem conta como conhecido mesmo que a lista não o
    // traga — ela pode ter falhado ao carregar, e recriá-lo seria duplicar.
    const conhecidos = [...this.tipos(), ...(this.original()?.machineType ? [this.original()!.machineType!] : [])];
    const existente = conhecidos.find((t) => normalizeForSearch(t.name) === normalizeForSearch(nome));
    if (existente) return of(existente.id);
    if (!this.criaTipo()) return of(null);
    return this.inventory.createMachineType(nome).pipe(
      timeout(LIMITE_DE_ESPERA_MS),
      map((tipo) => tipo.id),
    );
  }

  private corpo(sectorId: string | null, machineTypeId: string | null): EquipmentUpsertRequest {
    const v = this.form.getRawValue();
    return {
      name: v.nome.trim(),
      machineTypeId,
      model: v.modelo,
      manufacturerName: v.fabricante,
      serialNumber: v.serie,
      manufactureYear: v.ano,
      tag: v.tag,
      patrimonyCode: v.patrimonio,
      sectorId,
      sheet: {
        purpose: v.utilizacao.trim() || undefined,
        productiveCapacity: v.capacidade.trim() || undefined,
        powerKw: ouAusente(v.potencia),
        controlStations: ouAusente(v.postos),
        exposedOperators: ouAusente(v.operadores),
        energySources: ENERGY_SOURCES.filter((f) => v.energias.includes(f)),
        processDescription: v.processo.trim() || undefined,
        commonInterventions: v.intervencoes.trim() || undefined,
        otherInfo: v.outras.trim() || undefined,
        dimensions: {
          heightMm: ouAusente(v.altura),
          widthMm: ouAusente(v.largura),
          depthMm: ouAusente(v.profundidade),
          weightKg: ouAusente(v.peso),
        },
        manufacturer: {
          document: v.fabricanteCnpj || undefined,
          registry: v.fabricanteCrea.trim() || undefined,
          address: v.fabricanteEndereco.trim() || undefined,
          city: v.fabricanteCidade.trim() || undefined,
          zipCode: v.fabricanteCep || undefined,
        },
      },
    };
  }

  private camposDaFicha(ficha: EquipmentSheet) {
    return {
      utilizacao: ficha.purpose ?? '',
      capacidade: ficha.productiveCapacity ?? '',
      potencia: ficha.powerKw ?? null,
      postos: ficha.controlStations ?? null,
      operadores: ficha.exposedOperators ?? null,
      energias: [...ficha.energySources],
      processo: ficha.processDescription ?? '',
      intervencoes: ficha.commonInterventions ?? '',
      outras: ficha.otherInfo ?? '',
      altura: ficha.dimensions.heightMm ?? null,
      largura: ficha.dimensions.widthMm ?? null,
      profundidade: ficha.dimensions.depthMm ?? null,
      peso: ficha.dimensions.weightKg ?? null,
      fabricanteCnpj: ficha.manufacturer.document ?? '',
      fabricanteCrea: ficha.manufacturer.registry ?? '',
      fabricanteEndereco: ficha.manufacturer.address ?? '',
      fabricanteCidade: ficha.manufacturer.city ?? '',
      fabricanteCep: ficha.manufacturer.zipCode ?? '',
    };
  }

  /** Falha da foto não desfaz o cadastro: a máquina existe, e a foto se envia de novo pela edição. */
  private aplicarFoto(companyId: string, equipamento: EquipmentDetail): Observable<EquipmentDetail> {
    const arquivo = this.fotoEscolhida();
    const operação: Observable<unknown> | null = arquivo
      ? this.inventory.setPhoto(companyId, equipamento.code, arquivo)
      : this.fotoRemovida() && this.original()?.photoUrl
        ? this.inventory.removePhoto(companyId, equipamento.code)
        : null;
    if (!operação) return of(equipamento);

    return operação.pipe(
      timeout(LIMITE_DE_ESPERA_MS),
      map(() => equipamento),
      catchError(() => of(equipamento)),
    );
  }

  private recusado(erro: unknown): void {
    if (erro instanceof TimeoutError) {
      this.erro.set(
        `O servidor não respondeu em ${LIMITE_DE_ESPERA_MS / 1000} segundos. O que você preencheu ` +
          'continua aqui: tente de novo. Se o equipamento já aparecer no inventário, o cadastro tinha chegado.',
      );
      return;
    }
    const campo = erro instanceof HttpErrorResponse ? (erro.error as { field?: string })?.field : undefined;
    const mensagem = mensagemDoServidor(erro, 'Não foi possível salvar o equipamento.');
    const doCampo = {
      name: 'nome',
      tag: 'tag',
      manufactureYear: 'ano',
      'sheet.manufacturer.document': 'fabricanteCnpj',
    } as const;
    const alvo = campo ? doCampo[campo as keyof typeof doCampo] : undefined;
    if (alvo) {
      this.erros.set({ [alvo]: mensagem });
      this.irParaACampo(alvo);
    } else {
      this.erro.set(mensagem);
    }
  }
}

/** Sugere o que contém o digitado, sem acento nem caixa; campo vazio mostra tudo. */
function filtrar(nomes: string[], consulta: string): string[] {
  const termo = normalizeForSearch(consulta ?? '');
  return termo ? nomes.filter((n) => normalizeForSearch(n).includes(termo)) : nomes;
}
