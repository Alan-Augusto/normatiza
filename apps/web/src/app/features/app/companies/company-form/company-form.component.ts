import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucideBuilding2,
  lucideCheck,
  lucideFolderLock,
  lucideLoaderCircle,
  lucideMapPin,
  lucideUserRound,
} from '@ng-icons/lucide';
import { Button, ButtonDirective, ButtonLabel } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { Step, StepList, Stepper } from 'primeng/stepper';
import { Textarea } from 'primeng/textarea';
import { Observable, Subject, catchError, debounceTime, map, of, switchMap } from 'rxjs';

import {
  BRAZIL_STATES,
  formatCep,
  formatCnpj,
  isValidCep,
  isValidCnpj,
  normalizeForSearch,
  onlyDigits,
  type CompanyDetail,
  type CompanyManagerContact,
  type CompanyUpsertRequest,
} from '@normatiza/shared';

import { AuthService } from '../../../../core/auth/auth.service';
import { aparaEmail } from '../../../../core/forms/email';
import { mensagemDoServidor } from '../../../../core/http/mensagem-de-erro';
import { CompaniesService } from '../../../../core/services/companies.service';
import { CepLookupService } from '../../../../core/services/external/cep-lookup.service';
import {
  CnpjLookupResult,
  CnpjLookupService,
} from '../../../../core/services/external/cnpj-lookup.service';

/** O mesmo teto do servidor — conferido aqui para a pessoa não esperar um upload ser recusado. */
const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const LOGO_TIPOS = ['image/png', 'image/jpeg', 'image/webp'];

const cnpjValido = (c: AbstractControl<string>): ValidationErrors | null =>
  !c.value || isValidCnpj(c.value) ? null : { cnpj: true };

const cepValido = (c: AbstractControl<string>): ValidationErrors | null =>
  !c.value || isValidCep(c.value) ? null : { cep: true };

type Campo =
  | 'razao'
  | 'fantasia'
  | 'cnpj'
  | 'contatoNome'
  | 'contatoEmail'
  | 'cep'
  | 'logradouro'
  | 'numero'
  | 'bairro'
  | 'cidade'
  | 'uf';

/** A frase de cada campo obrigatório que falta — dita no campo, não no rodapé. */
const FALTA: Record<Campo, string> = {
  razao: 'Informe a razão social.',
  fantasia: 'Informe o nome fantasia.',
  cnpj: 'Informe o CNPJ.',
  contatoNome: 'Informe quem é o contato técnico.',
  contatoEmail: 'Informe o e-mail do contato.',
  cep: 'Informe o CEP.',
  logradouro: 'Informe o logradouro.',
  numero: 'Informe o número — use "s/n" se não houver.',
  bairro: 'Informe o bairro.',
  cidade: 'Informe a cidade.',
  uf: 'Escolha a UF.',
};

type FormControlName = keyof CompanyFormComponent['form']['controls'];

interface Etapa {
  valor: number;
  chave: 'identificacao' | 'endereco' | 'contato' | 'organizacao';
  titulo: string;
  icone: string;
  /** Os campos que esta etapa confere antes de deixar avançar. */
  campos: FormControlName[];
}

/**
 * As quatro etapas, na ordem em que a pessoa tem a informação na mão: primeiro
 * quem é a empresa (e o CNPJ já traz boa parte do resto), depois onde ela fica,
 * com quem falar, e por fim o que é só da consultoria.
 */
const ETAPAS: readonly Etapa[] = [
  { valor: 1, chave: 'identificacao', titulo: 'Identificação', icone: 'lucideBuilding2', campos: ['cnpj', 'ie', 'razao', 'fantasia'] },
  {
    valor: 2,
    chave: 'endereco',
    titulo: 'Endereço',
    icone: 'lucideMapPin',
    campos: ['cep', 'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'uf'],
  },
  {
    valor: 3,
    chave: 'contato',
    titulo: 'Contato',
    icone: 'lucideUserRound',
    campos: ['contatoNome', 'contatoCargo', 'contatoEmail', 'contatoTelefone', 'contatoCelular'],
  },
  { valor: 4, chave: 'organizacao', titulo: 'Organização interna', icone: 'lucideFolderLock', campos: ['grupo', 'codigo', 'observacoes'] },
];

/**
 * O formulário de empresa — um componente, dois modos: `/app/companies/new` e
 * `/app/companies/edit/:companyId` (D2). Página, e não diálogo: são cinco
 * seções, upload e buscas automáticas, e um formulário desse tamanho num
 * diálogo rola por dentro e se perde num clique fora.
 *
 * As buscas de CNPJ e CEP **ajudam e nunca mandam**: só ocupam campo vazio, e
 * se o serviço externo não responder o formulário segue aberto (D25).
 */
@Component({
  selector: 'app-company-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    NgIconComponent,
    Stepper,
    StepList,
    Step,
    Button,
    ButtonDirective,
    ButtonLabel,
    InputText,
    Message,
    Select,
    Textarea,
  ],
  providers: [
    provideIcons({
      lucideBuilding2,
      lucideMapPin,
      lucideUserRound,
      lucideFolderLock,
      lucideCheck,
      lucideLoaderCircle,
    }),
  ],
  templateUrl: './company-form.component.html',
  styleUrl: './company-form.component.css',
})
export class CompanyFormComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly companies = inject(CompaniesService);
  private readonly cnpjLookup = inject(CnpjLookupService);
  private readonly cepLookup = inject(CepLookupService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  readonly form = this.fb.group({
    razao: this.fb.control('', Validators.required),
    fantasia: this.fb.control('', Validators.required),
    cnpj: this.fb.control('', [Validators.required, cnpjValido]),
    ie: this.fb.control(''),
    contatoNome: this.fb.control('', Validators.required),
    contatoCargo: this.fb.control(''),
    contatoEmail: this.fb.control('', [Validators.required, Validators.email]),
    contatoTelefone: this.fb.control(''),
    contatoCelular: this.fb.control(''),
    cep: this.fb.control('', [Validators.required, cepValido]),
    logradouro: this.fb.control('', Validators.required),
    numero: this.fb.control('', Validators.required),
    complemento: this.fb.control(''),
    bairro: this.fb.control('', Validators.required),
    cidade: this.fb.control('', Validators.required),
    uf: this.fb.control('', Validators.required),
    grupo: this.fb.control(''),
    codigo: this.fb.control(''),
    observacoes: this.fb.control(''),
  });

  readonly ufs = BRAZIL_STATES.map((uf) => ({ label: uf, value: uf }));

  /** `null` no cadastro; o id da empresa na edição. */
  readonly companyId = signal<string | null>(null);
  readonly original = signal<CompanyDetail | null>(null);
  readonly carregando = signal(false);
  readonly salvando = signal(false);
  readonly erro = signal<string | null>(null);
  /** Cada busca avisa na etapa dela: o do CNPJ na identificação, o do CEP no endereço. */
  readonly avisoDoCnpj = signal<string | null>(null);
  readonly avisoDoCep = signal<string | null>(null);

  /**
   * A recusa do servidor ao CNPJ, presa **ao número recusado**. Não vai em
   * `setErrors`: trocar de etapa reconecta o campo, a revalidação apaga erro
   * posto à mão, e a pessoa voltaria à identificação sem ver o motivo. Assim,
   * o aviso some sozinho quando ela muda o número — e só então.
   */
  private readonly cnpjRecusado = signal<{ digitos: string; mensagem: string } | null>(null);
  readonly buscandoCnpj = signal(false);
  readonly buscandoCep = signal(false);

  /**
   * O último CEP consultado — ou carregado, na edição. Sair do campo sem mudar
   * o CEP não consulta de novo: seria sobrescrever, sem motivo, uma correção
   * que a pessoa fez à mão no logradouro.
   */
  private cepConsultado = '';

  readonly etapas = ETAPAS;
  readonly passo = signal(1);
  /** Até onde se pode ir clicando no cabeçalho. No cadastro, só até onde já se chegou. */
  readonly alcancado = signal(1);
  readonly etapaAtual = computed(() => ETAPAS[this.passo() - 1]);
  readonly ultimaEtapa = computed(() => this.passo() === ETAPAS.length);

  /** A empresa recém-cadastrada — a tela de próximos passos. */
  readonly criada = signal<CompanyDetail | null>(null);
  readonly avisoDoLogo = signal<string | null>(null);

  readonly gruposSugeridos = signal<string[]>([]);
  private readonly grupoDigitado = new Subject<string>();

  // O logo é enviado **depois** de a empresa existir: no cadastro ela ainda
  // não tem id, e o arquivo precisa de uma empresa a que pertencer.
  readonly logoEscolhido = signal<File | null>(null);
  readonly logoPrevia = signal<string | null>(null);
  readonly logoRemovido = signal(false);
  readonly erroDoLogo = signal<string | null>(null);

  private readonly valores = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  readonly editando = computed(() => this.companyId() !== null);

  /** Inativa é modo leitura — o servidor recusaria, então a tela nem oferece. */
  readonly bloqueada = computed(() => this.original()?.actions.edit === false);

  /** "Usar dados do Gestor" só existe quando existe Gestor. */
  readonly gestor = computed<CompanyManagerContact | null>(() => this.original()?.managers[0] ?? null);

  /** O nome digitado cria um grupo novo ao salvar — dito antes, não descoberto depois. */
  readonly grupoNovo = computed(() => {
    const nome = normalizeForSearch(this.valores().grupo ?? '');
    if (!nome) return false;
    const conhecidos = [...this.gruposSugeridos(), this.original()?.group?.name ?? ''].map(normalizeForSearch);
    return !conhecidos.includes(nome);
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('companyId');
    if (id) {
      this.companyId.set(id);
      // Na edição o cadastro já está completo: qualquer etapa é um clique.
      this.alcancado.set(ETAPAS.length);
      this.carregar(id);
    }

    this.grupoDigitado
      .pipe(
        debounceTime(300),
        switchMap((q) => this.companies.listGroups(q).pipe(catchError(() => of([])))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((grupos) => this.gruposSugeridos.set(grupos.map((g) => g.name)));
  }

  private carregar(id: string): void {
    this.carregando.set(true);
    this.companies.get(id).subscribe({
      next: (empresa) => {
        this.carregando.set(false);
        if (empresa.view !== 'CONSULTANCY') {
          this.erro.set('Você não administra o cadastro desta empresa.');
          return;
        }
        this.original.set(empresa);
        this.preencher(empresa);
      },
      error: (erro) => {
        this.carregando.set(false);
        this.erro.set(mensagemDoServidor(erro, 'Não foi possível carregar a empresa.'));
      },
    });
  }

  private preencher(e: CompanyDetail): void {
    this.form.setValue({
      razao: e.corporateName,
      fantasia: e.tradeName,
      cnpj: formatCnpj(e.document),
      ie: e.stateRegistration ?? '',
      contatoNome: e.contact.name,
      contatoCargo: e.contact.role ?? '',
      contatoEmail: e.contact.email,
      contatoTelefone: e.contact.phone ?? '',
      contatoCelular: e.contact.mobile ?? '',
      cep: formatCep(e.address.zipCode),
      logradouro: e.address.street,
      numero: e.address.number,
      complemento: e.address.complement ?? '',
      bairro: e.address.district,
      cidade: e.address.city,
      uf: e.address.state,
      grupo: e.group?.name ?? '',
      codigo: e.externalCode ?? '',
      observacoes: e.notes ?? '',
    });
    this.logoPrevia.set(e.logoUrl ?? null);
    this.cepConsultado = e.address.zipCode;
    this.form.markAsPristine();
    if (e.actions.edit === false) this.form.disable();
  }

  // ── Erros ao lado do campo ────────────────────────────────────────────────

  /** Erro só depois de a pessoa ter passado pelo campo — nunca ao abrir. */
  erroDe(campo: Campo): string | null {
    const controle = this.form.controls[campo];

    const recusado = this.cnpjRecusado();
    if (campo === 'cnpj' && recusado && onlyDigits(controle.value) === recusado.digitos) {
      return recusado.mensagem;
    }

    if (!controle.touched || controle.valid) return null;

    if (controle.hasError('required')) return FALTA[campo];
    if (controle.hasError('cnpj')) return 'Este CNPJ não confere — verifique os dígitos.';
    if (controle.hasError('cep')) return 'O CEP tem 8 dígitos.';
    if (controle.hasError('email')) return 'Esse e-mail não parece válido.';
    return null;
  }

  // ── Buscas automáticas ────────────────────────────────────────────────────

  aoSairDoCnpj(): void {
    const controle = this.form.controls.cnpj;
    if (!isValidCnpj(controle.value)) return;
    controle.setValue(formatCnpj(controle.value));

    // Na edição o cadastro já existe: consultar a Receita de novo só serviria
    // para, no máximo, não sobrescrever nada.
    if (this.editando()) return;

    this.buscandoCnpj.set(true);
    this.avisoDoCnpj.set(null);
    this.cnpjLookup.lookup(controle.value).subscribe((dados) => {
      this.buscandoCnpj.set(false);
      if (!dados) {
        this.avisoDoCnpj.set('Não conseguimos consultar este CNPJ agora. Preencha os dados manualmente.');
        return;
      }
      this.preencherVazios(dados);
      // O CEP que veio da Receita já trouxe o endereço dele: sair do campo sem
      // mexer não precisa consultar de novo.
      this.cepConsultado = onlyDigits(this.form.controls.cep.value);
    });
  }

  /**
   * **O endereço é do CEP.** Trocar o CEP troca logradouro, bairro, cidade e
   * UF — inclusive esvaziando o que o CEP novo não informa, porque a rua do CEP
   * antigo não pertence ao novo. Número e complemento o CEP não sabe: ficam com
   * quem digitou.
   *
   * É o contrário da busca por CNPJ, que só ocupa campo vazio: o cadastro na
   * Receita envelhece, e o que a pessoa digitou costuma estar mais certo.
   */
  aoSairDoCep(): void {
    const controle = this.form.controls.cep;
    if (!isValidCep(controle.value)) return;
    controle.setValue(formatCep(controle.value));

    const digitos = onlyDigits(controle.value);
    if (digitos === this.cepConsultado) return;
    this.cepConsultado = digitos;

    this.buscandoCep.set(true);
    this.avisoDoCep.set(null);
    this.cepLookup.lookup(digitos).subscribe((dados) => {
      this.buscandoCep.set(false);
      if (!dados) {
        this.avisoDoCep.set('Não encontramos este CEP. Preencha o endereço manualmente.');
        return;
      }
      this.form.patchValue({
        logradouro: dados.street ?? '',
        bairro: dados.district ?? '',
        cidade: dados.city ?? '',
        uf: dados.state?.toUpperCase() ?? '',
      });
    });
  }

  aoSairDoEmail(): void {
    aparaEmail(this.form.controls.contatoEmail);
  }

  /** Só ocupa campo vazio: o que a pessoa já digitou nunca é trocado pelo que veio de fora. */
  private preencherVazios(dados: CnpjLookupResult): void {
    const destino: [keyof CnpjLookupResult, keyof typeof this.form.controls, (v: string) => string][] = [
      ['corporateName', 'razao', (v) => v],
      ['tradeName', 'fantasia', (v) => v],
      ['zipCode', 'cep', formatCep],
      ['street', 'logradouro', (v) => v],
      ['number', 'numero', (v) => v],
      ['complement', 'complemento', (v) => v],
      ['district', 'bairro', (v) => v],
      ['city', 'cidade', (v) => v],
      ['state', 'uf', (v) => v.toUpperCase()],
    ];

    for (const [origem, campo, formatar] of destino) {
      const valor = dados[origem];
      const controle = this.form.controls[campo];
      if (valor && !controle.value.trim()) controle.setValue(formatar(valor));
    }
  }

  aoDigitarGrupo(valor: string): void {
    this.grupoDigitado.next(valor);
  }

  usarDadosDoGestor(): void {
    const g = this.gestor();
    if (!g) return;
    this.form.patchValue({
      contatoNome: g.name,
      contatoEmail: g.email,
      contatoTelefone: g.phone ?? '',
      contatoCargo: g.jobTitle ?? '',
    });
    this.form.markAsDirty();
  }

  // ── Etapas ────────────────────────────────────────────────────────────────

  /** Avança só com a etapa em ordem: o erro aparece agora, no campo, e não três telas depois. */
  avancar(): void {
    const etapa = this.etapaAtual();
    const invalidos = etapa.campos.filter((nome) => this.form.controls[nome].invalid);
    if (invalidos.length > 0) {
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
   * Enter num campo **não** salva nem avança. Com vinte campos, um Enter
   * esbarrado no meio do caminho mandaria um cadastro pela metade — ou pior,
   * salvaria uma edição que a pessoa ainda estava revisando. Salvar é um
   * clique. Na área de texto o Enter é quebra de linha, e segue sendo.
   */
  semEnter(evento: Event): void {
    if ((evento.target as HTMLElement).tagName !== 'TEXTAREA') evento.preventDefault();
  }

  /** Leva à etapa do primeiro campo com problema — o erro que ninguém vê não existe. */
  private irParaOPrimeiroErro(): void {
    const etapa = ETAPAS.find((e) => e.campos.some((nome) => this.form.controls[nome].invalid));
    if (etapa) this.passo.set(etapa.valor);
  }

  // ── Logo ──────────────────────────────────────────────────────────────────

  aoEscolherLogo(evento: Event): void {
    const arquivo = (evento.target as HTMLInputElement).files?.[0];
    this.erroDoLogo.set(null);
    if (!arquivo) return;

    if (!LOGO_TIPOS.includes(arquivo.type)) {
      this.erroDoLogo.set('O logo precisa ser PNG, JPG ou WebP.');
      return;
    }
    if (arquivo.size > LOGO_MAX_BYTES) {
      this.erroDoLogo.set('O logo pode ter no máximo 2 MB.');
      return;
    }

    this.logoEscolhido.set(arquivo);
    this.logoRemovido.set(false);
    this.logoPrevia.set(typeof URL.createObjectURL === 'function' ? URL.createObjectURL(arquivo) : null);
    this.form.markAsDirty();
  }

  removerLogo(): void {
    this.logoEscolhido.set(null);
    this.logoPrevia.set(null);
    this.logoRemovido.set(true);
    this.form.markAsDirty();
  }

  // ── Salvar ────────────────────────────────────────────────────────────────

  /** Para a guarda de saída: há algo digitado que ainda não foi salvo? */
  temAlteracoesNaoSalvas(): boolean {
    return this.form.dirty && !this.salvando() && !this.criada();
  }

  salvar(): void {
    if (this.form.invalid || this.bloqueada()) {
      this.form.markAllAsTouched();
      this.irParaOPrimeiroErro();
      return;
    }

    this.salvando.set(true);
    this.erro.set(null);

    const id = this.companyId();
    const pedido = id ? this.companies.update(id, this.corpo()) : this.companies.create(this.corpo());

    pedido
      .pipe(
        switchMap((empresa) => this.aplicarLogo(empresa)),
        // A sessão carrega a carteira: sem recarregá-la, a empresa nova não
        // passaria na guarda do Contexto 2, e um nome editado seguiria velho na
        // sidebar.
        switchMap((empresa) => this.auth.refresh().pipe(map(() => empresa))),
      )
      .subscribe({
        next: (empresa) => {
          this.salvando.set(false);
          this.form.markAsPristine();
          if (id) {
            void this.router.navigateByUrl('/app/companies');
          } else {
            this.criada.set(empresa);
          }
        },
        error: (erro) => {
          this.salvando.set(false);
          this.recusado(erro);
        },
      });
  }

  /** Falha do logo não desfaz o cadastro: a empresa existe, e o logo se envia de novo. */
  private aplicarLogo(empresa: CompanyDetail): Observable<CompanyDetail> {
    const arquivo = this.logoEscolhido();
    const operação: Observable<unknown> | null = arquivo
      ? this.companies.setLogo(empresa.id, arquivo)
      : this.logoRemovido() && this.original()?.logoUrl
        ? this.companies.removeLogo(empresa.id)
        : null;

    if (!operação) return of(empresa);

    return operação.pipe(
      map(() => empresa),
      catchError((erro) => {
        this.avisoDoLogo.set(
          mensagemDoServidor(erro, 'A empresa foi salva, mas o logo não foi enviado. Tente de novo pela edição.'),
        );
        return of(empresa);
      }),
    );
  }

  /** CNPJ repetido é problema **do campo CNPJ**, e é lá que a pessoa lê. */
  private recusado(erro: unknown): void {
    const campo = erro instanceof HttpErrorResponse ? (erro.error as { field?: string })?.field : undefined;
    const mensagem = mensagemDoServidor(erro, 'Não foi possível salvar a empresa.');

    if (campo === 'document') {
      this.cnpjRecusado.set({ digitos: onlyDigits(this.form.controls.cnpj.value), mensagem });
      this.passo.set(1);
      return;
    }
    this.erro.set(mensagem);
  }

  private corpo(): CompanyUpsertRequest {
    const v = this.form.getRawValue();
    const opcional = (valor: string) => (valor.trim() ? valor.trim() : undefined);

    return {
      corporateName: v.razao.trim(),
      tradeName: v.fantasia.trim(),
      document: onlyDigits(v.cnpj),
      stateRegistration: opcional(v.ie),
      contact: {
        name: v.contatoNome.trim(),
        role: opcional(v.contatoCargo),
        email: v.contatoEmail.trim(),
        phone: opcional(v.contatoTelefone),
        mobile: opcional(v.contatoCelular),
      },
      address: {
        zipCode: onlyDigits(v.cep),
        street: v.logradouro.trim(),
        number: v.numero.trim(),
        complement: opcional(v.complemento),
        district: v.bairro.trim(),
        city: v.cidade.trim(),
        state: v.uf,
      },
      // Vazio tira do grupo — por isso `null`, e não ausente, na edição.
      groupName: v.grupo.trim() || null,
      externalCode: opcional(v.codigo),
      notes: opcional(v.observacoes),
    };
  }
}
