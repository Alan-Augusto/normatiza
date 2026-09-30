import { Component, computed, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, FormsModule, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideCamera, lucideListChecks, lucidePlus, lucidePower, lucideScale } from '@ng-icons/lucide';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { SelectButton } from 'primeng/selectbutton';
import { Textarea } from 'primeng/textarea';
import { Observable, catchError, map, of, startWith, switchMap, timeout } from 'rxjs';

import {
  PAP_CRITERIA,
  PAP_NAME,
  PAP_SECTIONS,
  PAP_STANDARD_SECTION,
  emptyPapAnswers,
  papAssessedSections,
  papNonConformities,
  type AnalysisCatalogsDto,
  type PapCriterion,
  type PapDto,
  type PapSection,
  type PapUpsert,
} from '@normatiza/shared';

import { mensagemDoServidor } from '@core/http/mensagem-de-erro';
import { AnalysisService } from '@core/services/analysis.service';
import { CatalogsService } from '@core/services/catalogs.service';

import { CampoComponent } from '../../../../../../../../../shared/components/form/campo.component';
import { FotoDoItemComponent } from '../foto/foto-do-item.component';
import { NormasDescumpridasComponent } from '../normas/normas-descumpridas.component';
import type { AlvoDaAnalise, ResultadoDoSalvar } from '../risk-points/risk-points-step.component';

const LIMITE_DE_ESPERA_MS = 20_000;

type Resposta = FormGroup<{ physicalState: FormControl<boolean>; nr12Compliant: FormControl<boolean> }>;
type Secao = FormGroup<Record<PapCriterion, Resposta>>;


/**
 * Etapa 3 do assistente — os PAP, dispositivos de partida, acionamento e parada
 * (docs/produto/03 §5.2): um por conjunto de comando da máquina. Mesma forma da
 * etapa dos pontos: a lista, e um editor de cada vez no lugar dela, gravado
 * inteiro pelo id gerado aqui (D11).
 *
 * Segue a tela do legado: as seções Partida, Parada e Rearme, os quesitos com o
 * texto dele, tudo nascendo "Não" e "Não atende", e os quesitos de uma seção
 * aparecendo depois da foto dela — a foto é o que diz que a seção foi avaliada.
 * As seções ficam em abas: dezoito quesitos em fila não cabem no celular.
 */
@Component({
  selector: 'app-pap-step',
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    Button,
    Dialog,
    InputText,
    Message,
    NgIconComponent,
    SelectButton,
    Textarea,
    CampoComponent,
    FotoDoItemComponent,
    NormasDescumpridasComponent,
  ],
  providers: [provideIcons({ lucidePower, lucidePlus, lucideListChecks, lucideScale, lucideCamera })],
  templateUrl: './pap-step.component.html',
  styleUrls: ['../risk-points/risk-points-step.component.css', './pap-step.component.css'],
})
export class PapStepComponent {
  private readonly service = inject(AnalysisService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly alvo = input.required<AlvoDaAnalise>();
  readonly paps = input.required<PapDto[]>();
  readonly editavel = input(false);
  readonly papsChange = output<PapDto[]>();

  readonly nome = PAP_NAME;
  readonly secoes = PAP_SECTIONS;
  readonly quesitos = PAP_CRITERIA;
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

  /** As normas do PAP saem da 12.4, como no legado. */
  readonly secoesDeNorma = computed(() =>
    (this.catalogos().pacote?.standardSections ?? []).filter((s) => s.name.startsWith(`${PAP_STANDARD_SECTION} `)),
  );

  readonly editando = signal<{ id: string; existente: PapDto | null } | null>(null);
  readonly secaoAberta = signal<PapSection>('activation');
  readonly salvando = signal(false);
  readonly erro = signal<string | null>(null);
  readonly aviso = signal<string | null>(null);
  /** A seção cuja foto está subindo. */
  readonly enviandoFoto = signal<PapSection | null>(null);
  readonly erroDaFoto = signal<{ secao: PapSection; texto: string } | null>(null);
  readonly excluindo = signal<PapDto | null>(null);
  readonly processando = signal(false);

  readonly form = this.fb.group({
    local: '',
    secoes: this.fb.group(
      Object.fromEntries(PAP_SECTIONS.map((s) => [s.key, this.secao()])) as Record<PapSection, Secao>,
    ),
    normas: this.fb.control<string[]>([]),
    solucao: '',
  });

  private readonly valores = toSignal(this.form.valueChanges.pipe(startWith(null), map(() => this.form.getRawValue())), {
    initialValue: this.form.getRawValue(),
  });

  /** O que não atende em cada aba, enquanto se responde. */
  readonly naoConformesPorSecao = computed(() => {
    const secoes = this.valores().secoes;
    return Object.fromEntries(
      PAP_SECTIONS.map((s) => [s.key, Object.values(secoes[s.key]).filter((r) => !r.nr12Compliant).length]),
    ) as Record<PapSection, number>;
  });

  // ── Leitura da lista ─────────────────────────────────────────────────────

  naoConformidades(pap: PapDto): number {
    return papNonConformities(pap);
  }

  /** Nulo quando a seção não foi avaliada (sem foto): ela não entra no laudo. */
  naoConformesNaSecao(pap: PapDto, secao: PapSection): number | null {
    if (!pap.sections[secao].photo) return null;
    return PAP_CRITERIA.filter((c) => !pap.sections[secao].answers[c.key].nr12Compliant).length;
  }

  avaliadas(pap: PapDto): number {
    return papAssessedSections(pap).length;
  }

  /** A foto da seção no editor: é ela que abre os quesitos. */
  fotoDaSecao(secao: PapSection) {
    return this.editando()?.existente?.sections[secao].photo;
  }

  resposta(secao: PapSection, quesito: PapCriterion): Resposta {
    return this.form.controls.secoes.controls[secao].controls[quesito];
  }

  temAlteracoes(): boolean {
    return this.editando() !== null && this.form.dirty && !this.salvando();
  }

  // ── Editor ───────────────────────────────────────────────────────────────

  novo(): void {
    this.abrir({ id: crypto.randomUUID(), existente: null });
  }

  editar(pap: PapDto): void {
    this.abrir({ id: pap.id, existente: pap });
  }

  fechar(): void {
    this.editando.set(null);
    this.erro.set(null);
    this.erroDaFoto.set(null);
  }

  /**
   * Salva o PAP aberto, se há o que salvar — o que o assistente chama antes de
   * trocar de etapa, e o que "Voltar à lista" faz. PAP novo em branco não vira PAP.
   */
  salvarAberto(): Observable<ResultadoDoSalvar> {
    const aberto = this.editando();
    if (!aberto || !this.editavel() || !this.form.dirty) return of('nada');
    if (this.salvando()) return of('erro');
    return this.gravar(aberto.id).pipe(
      map((pap): ResultadoDoSalvar => {
        this.aviso.set(`PAP ${pap.number} salvo.`);
        return 'salvo';
      }),
      catchError(() => of<ResultadoDoSalvar>('erro')),
    );
  }

  voltarALista(): void {
    this.salvarAberto().subscribe((r) => {
      if (r !== 'erro') this.fechar();
    });
  }

  enviarFoto(secao: PapSection, arquivo: File): void {
    const aberto = this.editando();
    if (!aberto) return;
    const { companyId, code, number } = this.alvo();
    this.erroDaFoto.set(null);
    this.enviandoFoto.set(secao);
    // O PAP novo ainda não existe no servidor: grava primeiro, e a foto pende dele.
    const pap$ = aberto.existente ? of(aberto.existente) : this.gravar(aberto.id);
    pap$
      .pipe(
        switchMap((pap) =>
          this.service
            .setPapPhoto(companyId, code, number, pap.id, secao, arquivo)
            .pipe(map((photo): PapDto => ({ ...pap, sections: { ...pap.sections, [secao]: { ...pap.sections[secao], photo } } }))),
        ),
      )
      .subscribe({
        next: (pap) => {
          this.enviandoFoto.set(null);
          this.substituir(pap);
          this.editando.set({ id: pap.id, existente: pap });
        },
        error: (erro: unknown) => {
          this.enviandoFoto.set(null);
          this.erroDaFoto.set({ secao, texto: mensagemDoServidor(erro, 'Não foi possível enviar a foto. Tente de novo.') });
        },
      });
  }

  removerFoto(secao: PapSection): void {
    const pap = this.editando()?.existente;
    if (!pap?.sections[secao].photo) return;
    const { companyId, code, number } = this.alvo();
    this.enviandoFoto.set(secao);
    this.service.removePapPhoto(companyId, code, number, pap.id, secao).subscribe({
      next: () => {
        this.enviandoFoto.set(null);
        const { photo: _removida, ...semFoto } = pap.sections[secao];
        const atualizado: PapDto = { ...pap, sections: { ...pap.sections, [secao]: semFoto } };
        this.substituir(atualizado);
        this.editando.set({ id: atualizado.id, existente: atualizado });
      },
      error: (erro: unknown) => {
        this.enviandoFoto.set(null);
        this.erroDaFoto.set({ secao, texto: mensagemDoServidor(erro, 'Não foi possível remover a foto.') });
      },
    });
  }

  confirmarExclusao(): void {
    const pap = this.excluindo();
    if (!pap || this.processando()) return;
    const { companyId, code, number } = this.alvo();
    this.processando.set(true);
    this.service.removePap(companyId, code, number, pap.id).subscribe({
      next: () => {
        this.processando.set(false);
        this.excluindo.set(null);
        this.papsChange.emit(
          this.paps()
            .filter((p) => p.id !== pap.id)
            .map((p) => (p.number > pap.number ? { ...p, number: p.number - 1 } : p)),
        );
        this.aviso.set(`PAP ${pap.number} excluído. Os seguintes foram renumerados.`);
      },
      error: (erro: unknown) => {
        this.processando.set(false);
        this.excluindo.set(null);
        this.aviso.set(null);
        this.erro.set(mensagemDoServidor(erro, 'Não foi possível excluir o PAP.'));
      },
    });
  }

  // ── Apoio ────────────────────────────────────────────────────────────────

  private secao(): Secao {
    return this.fb.group(
      Object.fromEntries(
        PAP_CRITERIA.map((c) => [
          c.key,
          this.fb.group({ physicalState: this.fb.control(false), nr12Compliant: this.fb.control(false) }),
        ]),
      ) as Record<PapCriterion, Resposta>,
    );
  }

  private abrir(aberto: { id: string; existente: PapDto | null }): void {
    const p = aberto.existente;
    this.form.reset({
      local: p?.location ?? '',
      secoes: Object.fromEntries(PAP_SECTIONS.map((s) => [s.key, p?.sections[s.key].answers ?? emptyPapAnswers()])) as never,
      normas: p?.violatedStandardIds ?? [],
      solucao: p?.solution ?? '',
    });
    if (this.editavel()) this.form.enable();
    else this.form.disable();
    this.secaoAberta.set('activation');
    this.erro.set(null);
    this.aviso.set(null);
    this.erroDaFoto.set(null);
    this.editando.set(aberto);
  }

  private gravar(id: string): Observable<PapDto> {
    const { companyId, code, number } = this.alvo();
    this.salvando.set(true);
    this.erro.set(null);
    return this.service.savePap(companyId, code, number, id, this.corpo()).pipe(
      timeout(LIMITE_DE_ESPERA_MS),
      map((pap) => {
        this.salvando.set(false);
        this.form.markAsPristine();
        this.substituir(pap);
        this.editando.update((e) => (e ? { id: pap.id, existente: pap } : e));
        return pap;
      }),
      catchError((erro: unknown) => {
        this.salvando.set(false);
        this.erro.set(mensagemDoServidor(erro, 'Não foi possível salvar o PAP. Confira a conexão e tente de novo.'));
        throw erro;
      }),
    );
  }

  private substituir(pap: PapDto): void {
    const lista = this.paps();
    const existe = lista.some((p) => p.id === pap.id);
    this.papsChange.emit(existe ? lista.map((p) => (p.id === pap.id ? pap : p)) : [...lista, pap]);
  }

  private corpo(): PapUpsert {
    const v = this.form.getRawValue();
    return {
      location: v.local.trim() || null,
      sections: Object.fromEntries(PAP_SECTIONS.map((s) => [s.key, { answers: v.secoes[s.key] }])),
      violatedStandardIds: v.normas,
      solution: v.solucao.trim() || null,
    };
  }
}
