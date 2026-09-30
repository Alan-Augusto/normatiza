import { Component, computed, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideGauge, lucideMapPin, lucidePlus, lucideTriangleAlert, lucideWrench } from '@ng-icons/lucide';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { MultiSelect } from 'primeng/multiselect';
import { SelectButton } from 'primeng/selectbutton';
import { Textarea } from 'primeng/textarea';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { Observable, catchError, map, of, startWith, switchMap, timeout } from 'rxjs';

import {
  SAFETY_CATEGORY_OPTIONS,
  calculateHrn,
  safetyCategory,
  type AnalysisCatalogsDto,
  type HrnScore,
  type RiskPointDto,
  type RiskPointUpsert,
  type SafetyCategory,
} from '@normatiza/shared';

import { mensagemDoServidor } from '@core/http/mensagem-de-erro';
import { AnalysisService } from '@core/services/analysis.service';
import { CatalogsService } from '@core/services/catalogs.service';

import { CampoComponent } from '../../../../../../../../../shared/components/form/campo.component';
import { HrnBadgeComponent } from '../../../../../../../../../shared/components/hrn-badge/hrn-badge.component';
import { HRN_VAZIO, HrnCalculatorComponent, type HrnEscolha } from '../../../../../../../../../shared/components/hrn-calculator/hrn-calculator.component';

const FOTO_MAX_BYTES = 10 * 1024 * 1024;
const FOTO_TIPOS = ['image/png', 'image/jpeg', 'image/webp'];
const LIMITE_DE_ESPERA_MS = 20_000;

/** A análise que a etapa escreve: quem é, na API. */
export interface AlvoDaAnalise {
  companyId: string;
  code: string;
  number: number;
}

interface Grupo {
  label: string;
  items: { label: string; value: string }[];
}

/** "Conforme item 12.38.1, as zonas de perigo…" → "as zonas de perigo…": o código já vem ao lado. */
function textoDoItem(texto: string): string {
  return texto.replace(/^Conforme (o )?item [^,]+,\s*/i, '');
}

/**
 * Etapa 2 do assistente — os pontos de risco (docs/produto/03 §5.2).
 *
 * Uma lista, e um editor de cada vez no lugar dela: um ponto tem onze campos, e
 * um diálogo com esse tamanho rola por dentro, se perde num ESC e não cabe no
 * celular. O ponto é gravado inteiro pelo id gerado aqui (D11), então salvar
 * duas vezes é seguro. O HRN se calcula na tela enquanto se escolhe — o mesmo
 * cálculo do servidor, que é quem grava.
 */
@Component({
  selector: 'app-risk-points-step',
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    Button,
    Dialog,
    InputText,
    Message,
    MultiSelect,
    NgIconComponent,
    SelectButton,
    Textarea,
    ToggleSwitch,
    CampoComponent,
    HrnBadgeComponent,
    HrnCalculatorComponent,
  ],
  providers: [provideIcons({ lucideTriangleAlert, lucidePlus, lucideMapPin, lucideGauge, lucideWrench })],
  templateUrl: './risk-points-step.component.html',
  styleUrl: './risk-points-step.component.css',
})
export class RiskPointsStepComponent {
  private readonly service = inject(AnalysisService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly alvo = input.required<AlvoDaAnalise>();
  readonly pontos = input.required<RiskPointDto[]>();
  readonly editavel = input(false);
  /** A lista como ficou depois de gravar ou excluir: quem guarda a análise é o assistente. */
  readonly pontosChange = output<RiskPointDto[]>();

  /** As três perguntas da NBR 14153, com o texto da tela do legado. */
  readonly perguntasDaCategoria: { campo: 'gravidade' | 'frequencia' | 'possibilidade'; titulo: string; opcoes: { value: 1 | 2; code: string; label: string }[] }[] = [
    { campo: 'gravidade', titulo: 'Gravidade do ferimento', opcoes: [...SAFETY_CATEGORY_OPTIONS.severity] },
    { campo: 'frequencia', titulo: 'Frequência e tempo de exposição', opcoes: [...SAFETY_CATEGORY_OPTIONS.frequency] },
    { campo: 'possibilidade', titulo: 'Possibilidade de evitar o perigo', opcoes: [...SAFETY_CATEGORY_OPTIONS.possibility] },
  ];

  /** Os catálogos chegam uma vez; falhar aqui impede escolher, e a tela diz. */
  readonly catalogos = toSignal(
    inject(CatalogsService)
      .analysis()
      .pipe(
        map((c) => ({ pacote: c as AnalysisCatalogsDto | null, erro: false })),
        catchError(() => of({ pacote: null, erro: true })),
      ),
    { initialValue: { pacote: null, erro: false } },
  );

  /** O ponto aberto no editor: um que existe, ou um novo com o id já gerado. */
  readonly editando = signal<{ id: string; existente: RiskPointDto | null } | null>(null);
  readonly salvando = signal(false);
  readonly erro = signal<string | null>(null);
  readonly aviso = signal<string | null>(null);
  readonly erroDaFoto = signal<string | null>(null);
  readonly enviandoFoto = signal(false);
  readonly excluindo = signal<RiskPointDto | null>(null);
  readonly processando = signal(false);

  readonly form = this.fb.group({
    local: '',
    origens: this.fb.control<string[]>([]),
    consequencias: this.fb.control<string[]>([]),
    protecoes: this.fb.control<string[]>([]),
    normas: this.fb.control<string[]>([]),
    hrn: this.fb.control<HrnEscolha>({ ...HRN_VAZIO }),
    usaCategoria: false,
    gravidade: this.fb.control<1 | 2 | null>(null),
    frequencia: this.fb.control<1 | 2 | null>(null),
    possibilidade: this.fb.control<1 | 2 | null>(null),
    solucao: '',
  });

  private readonly valores = toSignal(this.form.valueChanges.pipe(startWith(this.form.getRawValue()), map(() => this.form.getRawValue())), {
    initialValue: this.form.getRawValue(),
  });

  // ── Opções dos catálogos ─────────────────────────────────────────────────

  readonly gruposDeOrigem = computed<Grupo[]>(() =>
    (this.catalogos().pacote?.hazardTypes ?? [])
      .filter((t) => t.origins.length)
      .map((t) => ({ label: t.name, items: t.origins.map((o) => ({ label: o.name, value: o.id })) })),
  );

  readonly gruposDeConsequencia = computed<Grupo[]>(() =>
    (this.catalogos().pacote?.hazardTypes ?? [])
      .filter((t) => t.consequences.length)
      .map((t) => ({ label: t.name, items: t.consequences.map((c) => ({ label: c.name, value: c.id })) })),
  );

  readonly gruposDeProtecao = computed<Grupo[]>(() =>
    (this.catalogos().pacote?.protectionTypes ?? [])
      .filter((t) => t.protections.length)
      .map((t) => ({ label: t.name, items: t.protections.map((p) => ({ label: p.name, value: p.id })) })),
  );

  readonly gruposDeNorma = computed<Grupo[]>(() =>
    (this.catalogos().pacote?.standardSections ?? [])
      .filter((s) => s.standards.length)
      .map((s) => ({
        label: s.name,
        items: s.standards.map((i) => ({ label: `${i.itemCode} — ${textoDoItem(i.text)}`, value: i.id })),
      })),
  );

  /** Para mostrar, abaixo da escolha, o texto inteiro de cada item marcado. */
  private readonly normaPorId = computed(() => {
    const mapa = new Map<string, { itemCode: string; text: string; secao: string }>();
    for (const s of this.catalogos().pacote?.standardSections ?? []) {
      for (const i of s.standards) mapa.set(i.id, { itemCode: i.itemCode, text: textoDoItem(i.text), secao: s.name });
    }
    return mapa;
  });

  private readonly nomePorId = computed(() => {
    const mapa = new Map<string, string>();
    const pacote = this.catalogos().pacote;
    for (const t of pacote?.hazardTypes ?? []) for (const x of [...t.origins, ...t.consequences]) mapa.set(x.id, x.name);
    for (const t of pacote?.protectionTypes ?? []) for (const x of t.protections) mapa.set(x.id, x.name);
    return mapa;
  });

  readonly normasEscolhidas = computed(() =>
    this.valores()
      .normas.map((id) => ({ id, ...this.normaPorId().get(id) }))
      .filter((n): n is { id: string; itemCode: string; text: string; secao: string } => !!n.itemCode),
  );

  // ── O que se calcula enquanto se escolhe ──────────────────────────────────

  /** Os quatro fatores, ou nenhum (D12): a tela diz qual dos dois estados. */
  readonly hrn = computed<HrnScore | 'incompleto' | null>(() => {
    const e = this.valores().hrn;
    const escolhidos = Object.values(e).filter((peso) => peso !== null).length;
    if (escolhidos === 0) return null;
    if (escolhidos < 4) return 'incompleto';
    const tabela = this.catalogos().pacote?.hrnTable;
    return tabela ? calculateHrn({ fe: e.fe!, pe: e.pe!, mpl: e.mpl!, np: e.np! }, tabela) : null;
  });

  readonly hrnCalculado = computed(() => {
    const h = this.hrn();
    return h && h !== 'incompleto' ? h : null;
  });

  readonly categoria = computed<SafetyCategory | 'incompleta' | null>(() => {
    const v = this.valores();
    if (!v.usaCategoria || v.gravidade === null) return v.usaCategoria ? 'incompleta' : null;
    if (v.gravidade === 2 && (v.frequencia === null || v.possibilidade === null)) return 'incompleta';
    return safetyCategory({ severity: v.gravidade, frequency: v.frequencia ?? undefined, possibility: v.possibilidade ?? undefined });
  });

  readonly numeroCategoria = computed(() => {
    const c = this.categoria();
    return c && c !== 'incompleta' ? c.category : null;
  });

  // ── Leitura da lista ─────────────────────────────────────────────────────

  nomes(ids: string[]): string {
    return ids.map((id) => this.nomePorId().get(id)).filter(Boolean).join(' · ');
  }

  temAlteracoes(): boolean {
    return this.editando() !== null && this.form.dirty && !this.salvando();
  }

  // ── Editor ───────────────────────────────────────────────────────────────

  novo(): void {
    this.abrir({ id: crypto.randomUUID(), existente: null });
  }

  editar(ponto: RiskPointDto): void {
    this.abrir({ id: ponto.id, existente: ponto });
  }

  fechar(): void {
    this.editando.set(null);
    this.erro.set(null);
    this.erroDaFoto.set(null);
  }

  constructor() {
    this.form.controls.gravidade.valueChanges.subscribe((g) => this.aplicarGravidade(g));
  }

  /**
   * Com ferimento leve, frequência e possibilidade não contam — a norma para
   * ali —, e as duas perguntas se fecham. Pelo formulário, e não pelo
   * `<fieldset disabled>`: os botões de escolha não são campos nativos, e o
   * fieldset não os alcança.
   */
  private aplicarGravidade(gravidade: 1 | 2 | null): void {
    const { frequencia, possibilidade } = this.form.controls;
    if (gravidade === 2 && this.editavel()) {
      frequencia.enable({ emitEvent: false });
      possibilidade.enable({ emitEvent: false });
    } else {
      if (gravidade !== 2) {
        frequencia.setValue(null, { emitEvent: false });
        possibilidade.setValue(null, { emitEvent: false });
      }
      frequencia.disable({ emitEvent: false });
      possibilidade.disable({ emitEvent: false });
    }
  }

  salvar(fechar = true): void {
    const aberto = this.editando();
    if (!aberto || this.salvando()) return;
    if (this.hrn() === 'incompleto') {
      this.erro.set('Escolha os quatro fatores do HRN, ou limpe os que já escolheu.');
      return;
    }
    if (this.categoria() === 'incompleta') {
      this.erro.set('Responda a categoria NBR 14153 até o fim, ou desligue a chave.');
      return;
    }

    this.gravar(aberto.id).subscribe({
      next: (ponto) => {
        this.aviso.set(`Ponto ${ponto.number} salvo.`);
        if (fechar) this.fechar();
      },
      // A mensagem já está na tela (`gravar`); aqui só não deixar o erro solto.
      error: () => undefined,
    });
  }

  aoEscolherFoto(evento: Event): void {
    const campo = evento.target as HTMLInputElement;
    const arquivo = campo.files?.[0];
    campo.value = '';
    const aberto = this.editando();
    if (!arquivo || !aberto) return;

    this.erroDaFoto.set(null);
    if (!FOTO_TIPOS.includes(arquivo.type)) return this.erroDaFoto.set('A foto precisa ser PNG, JPG ou WebP.');
    if (arquivo.size > FOTO_MAX_BYTES) return this.erroDaFoto.set('A foto pode ter no máximo 10 MB.');

    const { companyId, code, number } = this.alvo();
    this.enviandoFoto.set(true);
    // O ponto novo ainda não existe no servidor: grava primeiro, e a foto pende dele.
    const ponto$ = aberto.existente ? of(aberto.existente) : this.gravar(aberto.id);
    ponto$
      .pipe(switchMap((ponto) => this.service.setRiskPointPhoto(companyId, code, number, ponto.id, arquivo).pipe(map((photo) => ({ ...ponto, photo })))))
      .subscribe({
        next: (ponto) => {
          this.enviandoFoto.set(false);
          this.substituir(ponto);
          this.editando.set({ id: ponto.id, existente: ponto });
        },
        error: (erro: unknown) => {
          this.enviandoFoto.set(false);
          this.erroDaFoto.set(mensagemDoServidor(erro, 'Não foi possível enviar a foto. Tente de novo.'));
        },
      });
  }

  removerFoto(): void {
    const ponto = this.editando()?.existente;
    if (!ponto?.photo) return;
    const { companyId, code, number } = this.alvo();
    this.enviandoFoto.set(true);
    this.service.removeRiskPointPhoto(companyId, code, number, ponto.id).subscribe({
      next: () => {
        this.enviandoFoto.set(false);
        const { photo: _removida, ...sem } = ponto;
        this.substituir(sem);
        this.editando.set({ id: sem.id, existente: sem });
      },
      error: (erro: unknown) => {
        this.enviandoFoto.set(false);
        this.erroDaFoto.set(mensagemDoServidor(erro, 'Não foi possível remover a foto.'));
      },
    });
  }

  confirmarExclusao(): void {
    const ponto = this.excluindo();
    if (!ponto || this.processando()) return;
    const { companyId, code, number } = this.alvo();
    this.processando.set(true);
    this.service.removeRiskPoint(companyId, code, number, ponto.id).subscribe({
      next: () => {
        this.processando.set(false);
        this.excluindo.set(null);
        // A mesma renumeração do servidor: os seguintes sobem um (D11).
        this.pontosChange.emit(
          this.pontos()
            .filter((p) => p.id !== ponto.id)
            .map((p) => (p.number > ponto.number ? { ...p, number: p.number - 1 } : p)),
        );
        this.aviso.set(`Ponto ${ponto.number} excluído. Os seguintes foram renumerados.`);
      },
      error: (erro: unknown) => {
        this.processando.set(false);
        this.excluindo.set(null);
        this.aviso.set(null);
        this.erro.set(mensagemDoServidor(erro, 'Não foi possível excluir o ponto.'));
      },
    });
  }

  // ── Apoio ────────────────────────────────────────────────────────────────

  private abrir(aberto: { id: string; existente: RiskPointDto | null }): void {
    const p = aberto.existente;
    this.form.reset({
      local: p?.location ?? '',
      origens: p?.hazardOriginIds ?? [],
      consequencias: p?.hazardConsequenceIds ?? [],
      protecoes: p?.existingProtectionIds ?? [],
      normas: p?.violatedStandardIds ?? [],
      hrn: p?.currentHrn
        ? { fe: p.currentHrn.fe, pe: p.currentHrn.pe, mpl: p.currentHrn.mpl, np: p.currentHrn.np }
        : { ...HRN_VAZIO },
      usaCategoria: !!p?.safetyCategory,
      gravidade: p?.safetyCategory?.severity ?? null,
      frequencia: p?.safetyCategory?.frequency ?? null,
      possibilidade: p?.safetyCategory?.possibility ?? null,
      solucao: p?.suggestedSolution ?? '',
    });
    if (this.editavel()) this.form.enable();
    else this.form.disable();
    this.aplicarGravidade(this.form.controls.gravidade.value);
    this.erro.set(null);
    this.aviso.set(null);
    this.erroDaFoto.set(null);
    this.editando.set(aberto);
  }

  /** Grava o que está no editor e atualiza a lista. */
  private gravar(id: string): Observable<RiskPointDto> {
    const { companyId, code, number } = this.alvo();
    this.salvando.set(true);
    this.erro.set(null);
    return this.service.saveRiskPoint(companyId, code, number, id, this.corpo()).pipe(
      timeout(LIMITE_DE_ESPERA_MS),
      map((ponto) => {
        this.salvando.set(false);
        this.form.markAsPristine();
        this.substituir(ponto);
        this.editando.update((e) => (e ? { id: ponto.id, existente: ponto } : e));
        return ponto;
      }),
      catchError((erro: unknown) => {
        this.salvando.set(false);
        this.erro.set(mensagemDoServidor(erro, 'Não foi possível salvar o ponto. Confira a conexão e tente de novo.'));
        throw erro;
      }),
    );
  }

  private substituir(ponto: RiskPointDto): void {
    const lista = this.pontos();
    const existe = lista.some((p) => p.id === ponto.id);
    this.pontosChange.emit(existe ? lista.map((p) => (p.id === ponto.id ? ponto : p)) : [...lista, ponto]);
  }

  private corpo(): RiskPointUpsert {
    const v = this.form.getRawValue();
    const hrn = this.hrnCalculado();
    const categoria = this.numeroCategoria() !== null && v.gravidade !== null;
    return {
      location: v.local.trim() || null,
      hazardOriginIds: v.origens,
      hazardConsequenceIds: v.consequencias,
      existingProtectionIds: v.protecoes,
      violatedStandardIds: v.normas,
      hrn: hrn ? { fe: hrn.fe, pe: hrn.pe, mpl: hrn.mpl, np: hrn.np } : null,
      safetyCategory: categoria
        ? {
            severity: v.gravidade!,
            ...(v.gravidade === 2 ? { frequency: v.frequencia!, possibility: v.possibilidade! } : {}),
          }
        : null,
      suggestedSolution: v.solucao.trim() || null,
    };
  }
}
