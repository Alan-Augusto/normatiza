import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideCircleAlert, lucideClipboardList, lucidePower, lucideTriangleAlert, lucideWrench } from '@ng-icons/lucide';
import { Button, ButtonDirective, ButtonLabel } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { SelectButton } from 'primeng/selectbutton';
import { Step, StepList, Stepper } from 'primeng/stepper';
import { Observable, catchError, finalize, map, of, timeout } from 'rxjs';

import {
  ANALYSIS_STATUS_LABEL,
  PAP_NAME,
  PE_NAME,
  RECOGNITION_VIEWS,
  RECOGNITION_VIEW_LABEL,
  SAFETY_MANAGEMENT_QUESTIONS,
  type AnalysisDetail,
  type AnalysisSheetUpdate,
  type PapDto,
  type PersonRef,
  type RecognitionView,
  type RiskPointDto,
  type SafetyManagementQuestion,
} from '@normatiza/shared';

import { FormularioComAlteracoes } from '@core/guards/unsaved-changes.guard';
import { mensagemDoServidor } from '@core/http/mensagem-de-erro';
import { empresaDaRota } from '@core/routing/empresa-da-rota';
import { ROTAS } from '@core/routing/rotas';
import { AnalysisService } from '@core/services/analysis.service';

import { CampoComponent } from '../../../../../../../../shared/components/form/campo.component';
import { NumeroComponent } from '../../../../../../../../shared/components/form/numero.component';
import { EquipmentContext } from '../../equipment-context';
import { linhasDaFicha } from '../../ficha-do-ativo';
import { PapStepComponent } from './pap/pap-step.component';
import { RiskPointsStepComponent, type AlvoDaAnalise, type ResultadoDoSalvar } from './risk-points/risk-points-step.component';

const FOTO_MAX_BYTES = 10 * 1024 * 1024;
const FOTO_TIPOS = ['image/png', 'image/jpeg', 'image/webp'];
const LIMITE_DE_ESPERA_MS = 20_000;

interface Etapa {
  valor: number;
  chave: 'ficha' | 'pontos' | 'pap' | 'pe';
  titulo: string;
  /** O que a sigla quer dizer, embaixo dela. */
  legenda?: string;
  icone: string;
  /** Ainda não construída: a etapa aparece, e diz que chega depois. */
  futura?: boolean;
}

const ETAPAS: readonly Etapa[] = [
  { valor: 1, chave: 'ficha', titulo: 'Ficha técnica', icone: 'lucideClipboardList' },
  { valor: 2, chave: 'pontos', titulo: 'Pontos de risco', icone: 'lucideTriangleAlert' },
  { valor: 3, chave: 'pap', titulo: 'PAP', legenda: PAP_NAME, icone: 'lucidePower' },
  { valor: 4, chave: 'pe', titulo: 'PE', legenda: PE_NAME, icone: 'lucideWrench', futura: true },
];

/** Sim, não — e, sem nenhum dos dois marcado, sem resposta. */
const SIM_OU_NÃO = [
  { label: 'Sim', value: true },
  { label: 'Não', value: false },
];

/**
 * O assistente da análise — Contexto 3 (docs/produto/03 §5.2).
 *
 * Nada é obrigatório para salvar: o rascunho guarda o que tiver, e o que o
 * laudo exige se confere ao concluir. **Sair de onde se está sempre salva**,
 * como no legado: Avançar, Voltar e o clique no stepper gravam a ficha ou o
 * item aberto no editor antes de trocar de etapa, e o Salvar grava e fica.
 * As fotos sobem na hora em que são escolhidas.
 */
@Component({
  selector: 'app-analysis-wizard',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    NgIconComponent,
    Button,
    ButtonDirective,
    ButtonLabel,
    Dialog,
    InputText,
    Message,
    Select,
    SelectButton,
    Stepper,
    StepList,
    Step,
    CampoComponent,
    NumeroComponent,
    RiskPointsStepComponent,
    PapStepComponent,
  ],
  providers: [provideIcons({ lucideClipboardList, lucideTriangleAlert, lucidePower, lucideWrench, lucideCircleAlert })],
  templateUrl: './analysis-wizard.component.html',
  styleUrls: ['../../../../../../../../shared/styles/cadastro-em-etapas.css', './analysis-wizard.component.css'],
})
export class AnalysisWizardComponent implements FormularioComAlteracoes {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(AnalysisService);
  private readonly contexto = inject(EquipmentContext);
  private readonly empresa = empresaDaRota();

  readonly sobreOQue = 'nesta análise';
  readonly etapas = ETAPAS;
  readonly perguntas = SAFETY_MANAGEMENT_QUESTIONS;
  readonly vistas = RECOGNITION_VIEWS;
  readonly simOuNao = SIM_OU_NÃO;

  readonly equipamento = this.contexto.atual;
  readonly analise = signal<AnalysisDetail | null>(null);
  readonly tecnicos = signal<PersonRef[]>([]);
  readonly inexistente = signal(false);
  readonly erro = signal<string | null>(null);
  readonly aviso = signal<string | null>(null);
  readonly salvando = signal(false);
  /** Salvando para sair da etapa, ou pelo Salvar do rodapé. */
  readonly ocupado = signal(false);
  readonly passo = signal(1);
  /** A vista cuja foto está subindo, para o botão dela mostrar que está ocupado. */
  readonly enviando = signal<RecognitionView | null>(null);
  readonly erroDaFoto = signal<string | null>(null);
  readonly descartando = signal(false);
  readonly confirmandoDescarte = signal(false);

  private readonly numero = toSignal(this.route.paramMap.pipe(map((p) => Number(p.get('numero')))), {
    initialValue: Number(this.route.snapshot?.paramMap.get('numero')),
  });

  private readonly fb = inject(NonNullableFormBuilder);

  readonly form = this.fb.group({
    tecnico: this.fb.control<string | null>(null),
    ciclo: this.fb.control<number | null>(null),
    acionamento: this.fb.control<number | null>(null),
    parada: this.fb.control<number | null>(null),
    regime: '',
    maintenancePlannedByQualifiedProfessional: this.fb.control<boolean | null>(null),
    maintenanceRecorded: this.fb.control<boolean | null>(null),
    maintenanceRecordsAvailable: this.fb.control<boolean | null>(null),
    hasInstructionManual: this.fb.control<boolean | null>(null),
    hasWorkAndSafetyProcedures: this.fb.control<boolean | null>(null),
    workersTrained: this.fb.control<boolean | null>(null),
  });

  readonly etapaAtual = computed(() => ETAPAS[this.passo() - 1]);
  private readonly etapaDosPontos = viewChild(RiskPointsStepComponent);
  private readonly etapaDoPap = viewChild(PapStepComponent);

  /** A análise na API, para a etapa dos pontos gravar direto. */
  readonly alvoDaAnalise = computed<AlvoDaAnalise | null>(() => this.alvo());
  readonly editavel = computed(() => !!this.analise()?.actions.edit);
  readonly ficha = computed(() => linhasDaFicha(this.equipamento()?.sheet));

  readonly rotas = computed(() => {
    const e = this.equipamento();
    return e ? ROTAS.empresa(this.empresa()?.slug ?? '').equipamento(e.code) : null;
  });

  /** Corrigir a ficha é no cadastro do equipamento (D8), que volta para cá ao salvar. */
  readonly corrigirFicha = computed(() => {
    const rotas = this.rotas();
    return rotas ? { rota: rotas.editar, voltar: rotas.analiseNumero(this.numero()) } : null;
  });

  readonly fotosFaltando = computed(() => {
    const fotos = this.analise()?.photos ?? {};
    return RECOGNITION_VIEWS.filter((v) => !fotos[v]).length;
  });

  constructor() {
    effect(() => {
      const empresa = this.empresa();
      const equipamento = this.equipamento();
      const numero = this.numero();
      if (empresa && equipamento && Number.isInteger(numero)) this.carregar(empresa.id, equipamento.code, numero);
    });
  }

  rotuloDoStatus(): string {
    const a = this.analise();
    return a ? ANALYSIS_STATUS_LABEL[a.status] : '';
  }

  rotuloDaVista(v: RecognitionView): string {
    return RECOGNITION_VIEW_LABEL[v];
  }

  pergunta(chave: SafetyManagementQuestion) {
    return this.form.controls[chave];
  }

  /** Trocar de etapa — pelo stepper, por Avançar ou por Voltar — salva antes; se não salvou, fica. */
  irPara(valor: number | undefined): void {
    if (!valor || valor === this.passo() || this.ocupado()) return;
    this.salvarEtapa().subscribe((r) => {
      if (r === 'erro') return;
      this.passo.set(valor);
      this.aviso.set(null);
    });
  }

  readonly primeiraEtapa = computed(() => this.passo() === 1);
  readonly ultimaEtapa = computed(() => this.passo() === ETAPAS.length);

  avancar(): void {
    this.irPara(Math.min(this.passo() + 1, ETAPAS.length));
  }

  voltar(): void {
    this.irPara(Math.max(1, this.passo() - 1));
  }

  /** O Salvar do rodapé: grava o que está na tela e fica nela. */
  salvarAqui(): void {
    if (this.ocupado()) return;
    this.salvarEtapa().subscribe((r) => {
      if (r === 'nada') this.aviso.set('Tudo salvo.');
    });
  }

  /** O que a etapa atual tem por gravar: a ficha, ou o item aberto no editor. */
  private salvarEtapa(): Observable<ResultadoDoSalvar> {
    if (!this.editavel()) return of('nada');
    const chave = this.etapaAtual().chave;
    let salvar$: Observable<ResultadoDoSalvar>;
    if (chave === 'ficha') salvar$ = this.form.dirty ? this.salvarFicha() : of('nada');
    else if (chave === 'pontos') salvar$ = this.etapaDosPontos()?.salvarAberto() ?? of('nada');
    else if (chave === 'pap') salvar$ = this.etapaDoPap()?.salvarAberto() ?? of('nada');
    else salvar$ = of('nada');
    this.ocupado.set(true);
    this.aviso.set(null);
    return salvar$.pipe(finalize(() => this.ocupado.set(false)));
  }

  /** Enter num campo não salva: salvar é um clique, como nos cadastros. */
  semEnter(evento: Event): void {
    if ((evento.target as HTMLElement).tagName !== 'TEXTAREA') evento.preventDefault();
  }

  /** A ficha por salvar, ou um ponto ou PAP aberto no editor com alteração. */
  temAlteracoesNaoSalvas(): boolean {
    return (this.form.dirty && !this.salvando()) || !!this.etapaDosPontos()?.temAlteracoes() || !!this.etapaDoPap()?.temAlteracoes();
  }

  /** A etapa dos pontos gravou ou excluiu: a lista da análise passa a ser a dela. */
  atualizarPontos(pontos: RiskPointDto[]): void {
    this.analise.update((a) => (a ? { ...a, riskPoints: pontos, riskPointsCount: pontos.length } : a));
  }

  atualizarPaps(paps: PapDto[]): void {
    this.analise.update((a) => (a ? { ...a, paps } : a));
  }

  private salvarFicha(): Observable<ResultadoDoSalvar> {
    const alvo = this.alvo();
    if (!alvo || this.salvando()) return of('erro');
    this.salvando.set(true);
    this.erro.set(null);
    return this.service.updateSheet(alvo.companyId, alvo.code, alvo.number, this.corpo()).pipe(
      timeout(LIMITE_DE_ESPERA_MS),
      map((salva): ResultadoDoSalvar => {
        this.salvando.set(false);
        this.preencher(salva);
        this.aviso.set('Rascunho salvo.');
        return 'salvo';
      }),
      catchError((erro: unknown) => {
        this.salvando.set(false);
        this.erro.set(mensagemDoServidor(erro, 'Não foi possível salvar. Confira a conexão e tente de novo.'));
        return of<ResultadoDoSalvar>('erro');
      }),
    );
  }

  aoEscolherFoto(vista: RecognitionView, evento: Event): void {
    const campo = evento.target as HTMLInputElement;
    const arquivo = campo.files?.[0];
    campo.value = '';
    if (!arquivo) return;

    this.erroDaFoto.set(null);
    if (!FOTO_TIPOS.includes(arquivo.type)) {
      this.erroDaFoto.set('A foto precisa ser PNG, JPG ou WebP.');
      return;
    }
    if (arquivo.size > FOTO_MAX_BYTES) {
      this.erroDaFoto.set('A foto pode ter no máximo 10 MB.');
      return;
    }

    const alvo = this.alvo();
    if (!alvo) return;
    this.enviando.set(vista);
    this.service.setPhoto(alvo.companyId, alvo.code, alvo.number, vista, arquivo).subscribe({
      next: (foto) => {
        this.enviando.set(null);
        this.analise.update((a) => (a ? { ...a, photos: { ...a.photos, [vista]: foto } } : a));
      },
      error: (erro: unknown) => {
        this.enviando.set(null);
        this.erroDaFoto.set(mensagemDoServidor(erro, 'Não foi possível enviar a foto. Tente de novo.'));
      },
    });
  }

  removerFoto(vista: RecognitionView): void {
    const alvo = this.alvo();
    if (!alvo) return;
    this.enviando.set(vista);
    this.service.removePhoto(alvo.companyId, alvo.code, alvo.number, vista).subscribe({
      next: () => {
        this.enviando.set(null);
        this.analise.update((a) => {
          if (!a) return a;
          const { [vista]: _removida, ...resto } = a.photos;
          return { ...a, photos: resto };
        });
      },
      error: (erro: unknown) => {
        this.enviando.set(null);
        this.erroDaFoto.set(mensagemDoServidor(erro, 'Não foi possível remover a foto.'));
      },
    });
  }

  confirmarDescarte(): void {
    const alvo = this.alvo();
    if (!alvo || this.descartando()) return;
    this.descartando.set(true);
    this.service.discard(alvo.companyId, alvo.code, alvo.number).subscribe({
      next: () => {
        this.descartando.set(false);
        this.confirmandoDescarte.set(false);
        this.form.markAsPristine();
        void this.router.navigateByUrl(this.rotas()!.analise);
      },
      error: (erro: unknown) => {
        this.descartando.set(false);
        this.confirmandoDescarte.set(false);
        this.erro.set(mensagemDoServidor(erro, 'Não foi possível descartar o rascunho.'));
      },
    });
  }

  private alvo() {
    const empresa = this.empresa();
    const equipamento = this.equipamento();
    const analise = this.analise();
    return empresa && equipamento && analise
      ? { companyId: empresa.id, code: equipamento.code, number: analise.number }
      : null;
  }

  private carregar(companyId: string, code: string, numero: number): void {
    this.service.get(companyId, code, numero).subscribe({
      next: (analise) => {
        this.preencher(analise);
        if (analise.actions.edit) {
          this.service.fieldTechnicians(companyId, code).subscribe((lista) => this.tecnicos.set(lista));
        }
      },
      error: () => this.inexistente.set(true),
    });
  }

  private preencher(a: AnalysisDetail): void {
    this.analise.set(a);
    this.form.reset({
      tecnico: a.fieldTechnician?.id ?? null,
      ciclo: a.sheet.times.cycleTimeSec ?? null,
      acionamento: a.sheet.times.activationTimeSec ?? null,
      parada: a.sheet.times.emergencyStopTimeSec ?? null,
      regime: a.sheet.shiftRegime ?? '',
      ...a.sheet.safetyManagement,
    });
    if (a.actions.edit) this.form.enable();
    else this.form.disable();
  }

  private corpo(): AnalysisSheetUpdate {
    const v = this.form.getRawValue();
    const tempo = (n: number | null) => n ?? undefined;
    return {
      fieldTechnicianUserId: v.tecnico,
      times: { cycleTimeSec: tempo(v.ciclo), activationTimeSec: tempo(v.acionamento), emergencyStopTimeSec: tempo(v.parada) },
      shiftRegime: v.regime.trim() || null,
      safetyManagement: Object.fromEntries(SAFETY_MANAGEMENT_QUESTIONS.map((q) => [q.key, v[q.key]])),
    };
  }
}
