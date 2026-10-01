import { Component, ElementRef, computed, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, FormsModule, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideCamera, lucideListChecks, lucideOctagonX, lucidePlus, lucideScale } from '@ng-icons/lucide';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { SelectButton } from 'primeng/selectbutton';
import { Textarea } from 'primeng/textarea';
import { Observable, catchError, map, of, startWith, switchMap, tap, timeout } from 'rxjs';

import {
  PE_CRITERIA,
  PE_NAME,
  PE_STANDARD_SECTION,
  emptyPeAnswers,
  peNonConformities,
  type AnalysisCatalogsDto,
  type PeCriterion,
  type PeDto,
  type PeUpsert,
} from '@normatiza/shared';

import { mensagemDoServidor } from '@core/http/mensagem-de-erro';
import { ModalService } from '@core/modal/modal.service';
import { AnalysisService } from '@core/services/analysis.service';
import { CatalogsService } from '@core/services/catalogs.service';

import { CampoComponent } from '../../../../../../../../../shared/components/form/campo.component';
import { RowActionComponent } from '../../../../../../../../../shared/components/row-action/row-action.component';
import { FotoDoItemComponent } from '../foto/foto-do-item.component';
import { EscolhaMultiplaComponent } from '../../../../../../../../../shared/components/escolha-multipla/escolha-multipla.component';
import { gruposDeNorma } from '../normas/normas';
import type { EtapaComEditor, ResultadoDoSalvar } from '../etapa-com-editor';
import type { AlvoDaAnalise } from '../risk-points/risk-points-step.component';

const LIMITE_DE_ESPERA_MS = 20_000;

type Resposta = FormGroup<{ physicalState: FormControl<boolean>; nr12Compliant: FormControl<boolean> }>;

/**
 * Etapa 4 do assistente — os PE, dispositivos de parada de emergência
 * (docs/produto/03 §5.2): um por dispositivo avaliado. A forma da etapa do PAP,
 * com um checklist só e uma foto, na ordem da tela do legado: foto, os oito
 * quesitos (sempre à vista — no laudo do legado eles saem com ou sem foto),
 * parecer técnico e possíveis soluções.
 */
@Component({
  selector: 'app-pe-step',
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    Button,
    InputText,
    Message,
    NgIconComponent,
    SelectButton,
    Textarea,
    CampoComponent,
    FotoDoItemComponent,
    RowActionComponent,
    EscolhaMultiplaComponent,
  ],
  providers: [provideIcons({ lucideOctagonX, lucidePlus, lucideListChecks, lucideScale, lucideCamera })],
  templateUrl: './pe-step.component.html',
  styleUrls: ['../risk-points/risk-points-step.component.css', '../pap/pap-step.component.css'],
})
export class PeStepComponent implements EtapaComEditor {
  private readonly service = inject(AnalysisService);
  private readonly modal = inject(ModalService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly alvo = input.required<AlvoDaAnalise>();
  readonly pes = input.required<PeDto[]>();
  readonly editavel = input(false);
  readonly pesChange = output<PeDto[]>();

  readonly nome = PE_NAME;
  readonly quesitos = PE_CRITERIA;
  readonly opcoesFisico = [
    { label: 'Sim', value: true },
    { label: 'Não', value: false },
  ];
  readonly opcoesNr12 = [
    { label: 'Atende NR-12', value: true },
    { label: 'Não atende NR-12', value: false },
  ];

  readonly catalogos = toSignal(
    inject(CatalogsService)
      .analysis()
      .pipe(
        map((c) => ({ pacote: c as AnalysisCatalogsDto | null, erro: false })),
        catchError(() => of({ pacote: null, erro: true })),
      ),
    { initialValue: { pacote: null, erro: false } },
  );

  /** As normas do PE saem da 12.6, como no legado. */
  readonly secoesDeNorma = computed(() =>
    (this.catalogos().pacote?.standardSections ?? []).filter((s) => s.name.startsWith(`${PE_STANDARD_SECTION} `)),
  );

  readonly gruposDeNorma = computed(() => gruposDeNorma(this.secoesDeNorma()));

  /** O PE aberto no editor: um que existe, ou um novo — em branco ou cópia de outro. */
  readonly editando = signal<{ id: string; existente: PeDto | null; copiaDe?: number } | null>(null);
  readonly salvando = signal(false);
  readonly erro = signal<string | null>(null);
  readonly aviso = signal<string | null>(null);
  readonly enviandoFoto = signal(false);
  readonly erroDaFoto = signal<string | null>(null);

  readonly form = this.fb.group({
    local: '',
    respostas: this.fb.group(
      Object.fromEntries(
        PE_CRITERIA.map((c) => [c.key, this.fb.group({ physicalState: this.fb.control(false), nr12Compliant: this.fb.control(false) })]),
      ) as Record<PeCriterion, Resposta>,
    ),
    normas: this.fb.control<string[]>([]),
    solucao: '',
  });

  private readonly valores = toSignal(this.form.valueChanges.pipe(startWith(null), map(() => this.form.getRawValue())), {
    initialValue: this.form.getRawValue(),
  });

  readonly naoConformesNoEditor = computed(() => Object.values(this.valores().respostas).filter((r) => !r.nr12Compliant).length);

  naoConformidades(pe: PeDto): number {
    return peNonConformities(pe);
  }

  resposta(quesito: PeCriterion): Resposta {
    return this.form.controls.respostas.controls[quesito];
  }

  temAlteracoes(): boolean {
    return this.editando() !== null && this.form.dirty && !this.salvando();
  }

  // ── Editor ───────────────────────────────────────────────────────────────

  novo(): void {
    this.abrir({ id: crypto.randomUUID(), existente: null });
  }

  editar(pe: PeDto): void {
    this.abrir({ id: pe.id, existente: pe });
  }

  /** Como no legado: tudo do original, menos a foto — é outro dispositivo. */
  duplicar(pe: PeDto): void {
    this.abrir({ id: crypto.randomUUID(), existente: null, copiaDe: pe.number }, pe);
  }

  fechar(): void {
    this.editando.set(null);
    this.erro.set(null);
    this.erroDaFoto.set(null);
  }

  /** Salva o PE aberto, se há o que salvar. PE novo em branco não vira PE. */
  salvarAberto(): Observable<ResultadoDoSalvar> {
    const aberto = this.editando();
    if (!aberto || !this.editavel() || !this.form.dirty) return of('nada');
    if (this.salvando()) return of('erro');
    return this.gravar(aberto.id).pipe(
      map((pe): ResultadoDoSalvar => {
        this.aviso.set(`PE ${pe.number} salvo.`);
        return 'salvo';
      }),
      catchError(() => of<ResultadoDoSalvar>('erro')),
    );
  }

  /** Salva o que está aberto e abre um em branco — para quem levanta vários em seguida. */
  salvarEAdicionar(): void {
    this.salvarAberto().subscribe((r) => {
      if (r === 'erro') return;
      const aviso = this.aviso();
      this.novo();
      this.aviso.set(aviso);
      this.host.nativeElement.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
    });
  }

  voltarALista(): void {
    this.salvarAberto().subscribe((r) => {
      if (r !== 'erro') this.fechar();
    });
  }

  enviarFoto(arquivo: File): void {
    const aberto = this.editando();
    if (!aberto) return;
    const { companyId, code, number } = this.alvo();
    this.erroDaFoto.set(null);
    this.enviandoFoto.set(true);
    // O PE novo ainda não existe no servidor: grava primeiro, e a foto pende dele.
    const pe$ = aberto.existente ? of(aberto.existente) : this.gravar(aberto.id);
    pe$
      .pipe(switchMap((pe) => this.service.setPePhoto(companyId, code, number, pe.id, arquivo).pipe(map((photo): PeDto => ({ ...pe, photo })))))
      .subscribe({
        next: (pe) => {
          this.enviandoFoto.set(false);
          this.substituir(pe);
          this.editando.set({ id: pe.id, existente: pe });
        },
        error: (erro: unknown) => {
          this.enviandoFoto.set(false);
          this.erroDaFoto.set(mensagemDoServidor(erro, 'Não foi possível enviar a foto. Tente de novo.'));
        },
      });
  }

  removerFoto(): void {
    const pe = this.editando()?.existente;
    if (!pe?.photo) return;
    const { companyId, code, number } = this.alvo();
    this.enviandoFoto.set(true);
    this.service.removePePhoto(companyId, code, number, pe.id).subscribe({
      next: () => {
        this.enviandoFoto.set(false);
        const { photo: _removida, ...sem } = pe;
        this.substituir(sem);
        this.editando.set({ id: sem.id, existente: sem });
      },
      error: (erro: unknown) => {
        this.enviandoFoto.set(false);
        this.erroDaFoto.set(mensagemDoServidor(erro, 'Não foi possível remover a foto.'));
      },
    });
  }

  /** Pergunta antes; os seguintes sobem um, como no servidor (D11). */
  excluir(pe: PeDto): void {
    const { companyId, code, number } = this.alvo();
    void this.modal.confirmar({
      titulo: `Excluir o PE ${pe.number}`,
      texto: 'O PE sai do rascunho, com a foto, e os seguintes são renumerados para a lista não pular um número.',
      confirmar: 'Excluir',
      testid: 'confirmar-exclusao-pe',
      acao: () =>
        this.service.removePe(companyId, code, number, pe.id).pipe(
          tap({
            next: () => {
              this.pesChange.emit(
                this.pes()
                  .filter((p) => p.id !== pe.id)
                  .map((p) => (p.number > pe.number ? { ...p, number: p.number - 1 } : p)),
              );
              this.aviso.set(`PE ${pe.number} excluído. Os seguintes foram renumerados.`);
            },
            error: (erro: unknown) => {
              this.aviso.set(null);
              this.erro.set(mensagemDoServidor(erro, 'Não foi possível excluir o PE.'));
            },
          }),
        ),
    });
  }

  // ── Apoio ────────────────────────────────────────────────────────────────

  /** `origem` preenche o editor: o próprio PE, ou o que se duplica. */
  private abrir(aberto: { id: string; existente: PeDto | null; copiaDe?: number }, origem: PeDto | null = aberto.existente): void {
    this.form.reset({
      local: origem?.location ?? '',
      respostas: origem?.answers ?? emptyPeAnswers(),
      normas: origem?.violatedStandardIds ?? [],
      solucao: origem?.solution ?? '',
    });
    if (this.editavel()) this.form.enable();
    else this.form.disable();
    // A cópia ainda não existe: sair do editor a grava, como qualquer alteração.
    if (aberto.copiaDe) this.form.markAsDirty();
    this.erro.set(null);
    this.aviso.set(null);
    this.erroDaFoto.set(null);
    this.editando.set(aberto);
  }

  private gravar(id: string): Observable<PeDto> {
    const { companyId, code, number } = this.alvo();
    this.salvando.set(true);
    this.erro.set(null);
    return this.service.savePe(companyId, code, number, id, this.corpo()).pipe(
      timeout(LIMITE_DE_ESPERA_MS),
      map((pe) => {
        this.salvando.set(false);
        this.form.markAsPristine();
        this.substituir(pe);
        this.editando.update((e) => (e ? { id: pe.id, existente: pe } : e));
        return pe;
      }),
      catchError((erro: unknown) => {
        this.salvando.set(false);
        this.erro.set(mensagemDoServidor(erro, 'Não foi possível salvar o PE. Confira a conexão e tente de novo.'));
        throw erro;
      }),
    );
  }

  private substituir(pe: PeDto): void {
    const lista = this.pes();
    const existe = lista.some((p) => p.id === pe.id);
    this.pesChange.emit(existe ? lista.map((p) => (p.id === pe.id ? pe : p)) : [...lista, pe]);
  }

  private corpo(): PeUpsert {
    const v = this.form.getRawValue();
    return {
      location: v.local.trim() || null,
      answers: v.respostas,
      violatedStandardIds: v.normas,
      solution: v.solucao.trim() || null,
    };
  }
}
