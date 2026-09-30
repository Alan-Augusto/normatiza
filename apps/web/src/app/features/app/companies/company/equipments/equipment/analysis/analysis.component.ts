import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Button, ButtonDirective, ButtonLabel } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { Message } from 'primeng/message';

import { ANALYSIS_EDITOR_ROLES, ANALYSIS_STATUS_LABEL, type AnalysisListItem, type AnalysisStatus } from '@normatiza/shared';

import { AuthService } from '@core/auth/auth.service';
import { mensagemDoServidor } from '@core/http/mensagem-de-erro';
import { empresaDaRota } from '@core/routing/empresa-da-rota';
import { ROTAS } from '@core/routing/rotas';
import { AnalysisService } from '@core/services/analysis.service';

import { DataTable } from '../../../../../../../shared/components/data-table/data-table.component';
import { AcaoPrimaria, AcaoVazia, CabecalhoDaTabela, LinhaDaTabela } from '../../../../../../../shared/components/data-table/data-table.directives';
import { HrnBadgeComponent } from '../../../../../../../shared/components/hrn-badge/hrn-badge.component';
import { RowActionComponent } from '../../../../../../../shared/components/row-action/row-action.component';
import { EquipmentContext } from '../equipment-context';

/**
 * As análises da máquina — Contexto 3 (docs/produto/03 §5.2).
 *
 * O rascunho é da consultoria: o cliente vê a lista só com as concluídas, e é
 * o servidor quem recorta. Um rascunho por máquina, então o botão de abrir vira
 * o de continuar enquanto houver um.
 */
@Component({
  selector: 'app-equipment-analysis',
  standalone: true,
  imports: [
    DatePipe,
    RouterLink,
    Button,
    ButtonDirective,
    ButtonLabel,
    Message,
    DataTable,
    CabecalhoDaTabela,
    LinhaDaTabela,
    AcaoPrimaria,
    AcaoVazia,
    HrnBadgeComponent,
    RowActionComponent,
    Dialog,
  ],
  templateUrl: './analysis.component.html',
  styleUrl: './analysis.component.css',
})
export class EquipmentAnalysisComponent {
  private readonly contexto = inject(EquipmentContext);
  private readonly service = inject(AnalysisService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly empresa = empresaDaRota();

  readonly equipamento = this.contexto.atual;
  readonly analises = signal<AnalysisListItem[] | null>(null);
  readonly erro = signal<string | null>(null);
  readonly abrindo = signal(false);
  readonly descartando = signal<AnalysisListItem | null>(null);
  readonly processando = signal(false);

  /** A consultoria alocada, com a máquina ativa numa empresa ativa. O servidor confere de novo. */
  readonly podeAbrir = computed(() => {
    const empresa = this.empresa();
    const equipamento = this.equipamento();
    if (!empresa || !equipamento || empresa.status === 'INACTIVE' || equipamento.status !== 'ACTIVE') return false;
    return this.auth.rolesInCompany(empresa.id).some((p) => ANALYSIS_EDITOR_ROLES.includes(p));
  });

  readonly rascunho = computed(() => this.analises()?.find((a) => a.status === 'DRAFT') ?? null);
  readonly lista = computed(() => this.analises() ?? []);

  /**
   * O que não varia não aparece (docs/web/design_system.md §6): enquanto
   * nenhuma análise foi concluída, "Conclusão" e "Engenheiro" diriam "—" em
   * todas as linhas.
   */
  readonly mostraConclusao = computed(() => this.lista().some((a) => a.concludedAt));
  readonly mostraEngenheiro = computed(() => this.lista().some((a) => a.responsibleEngineer));
  readonly mostraAcoes = computed(() => this.lista().some((a) => a.actions.discard));

  constructor() {
    effect(() => {
      const empresa = this.empresa();
      const equipamento = this.equipamento();
      if (empresa && equipamento) this.carregar(empresa.id, equipamento.code);
    });
  }

  rotaDa(analise: AnalysisListItem): string {
    return this.rotas()?.analiseNumero(analise.number) ?? '';
  }

  rotulo(status: AnalysisStatus): string {
    return ANALYSIS_STATUS_LABEL[status];
  }

  /** Abre o rascunho e vai direto para ele. Se outro técnico abriu antes, a lista se atualiza e diz qual. */
  novaAnalise(): void {
    const empresa = this.empresa();
    const equipamento = this.equipamento();
    if (!empresa || !equipamento || this.abrindo()) return;

    this.abrindo.set(true);
    this.erro.set(null);
    this.service.create(empresa.id, equipamento.code).subscribe({
      next: (analise) => {
        this.abrindo.set(false);
        void this.router.navigateByUrl(this.rotas()!.analiseNumero(analise.number));
      },
      error: (erro: unknown) => {
        this.abrindo.set(false);
        this.erro.set(mensagemDoServidor(erro, 'Não foi possível abrir a análise. Tente de novo.'));
        if (erro instanceof HttpErrorResponse && erro.status === 409) this.carregar(empresa.id, equipamento.code);
      },
    });
  }

  /** Só o rascunho se descarta; a análise concluída é congelada, e se corrige por revisão (D2). */
  confirmarDescarte(): void {
    const empresa = this.empresa();
    const equipamento = this.equipamento();
    const analise = this.descartando();
    if (!empresa || !equipamento || !analise || this.processando()) return;
    this.processando.set(true);
    this.service.discard(empresa.id, equipamento.code, analise.number).subscribe({
      next: () => {
        this.processando.set(false);
        this.descartando.set(null);
        this.analises.update((lista) => lista?.filter((a) => a.id !== analise.id) ?? lista);
      },
      error: (erro: unknown) => {
        this.processando.set(false);
        this.descartando.set(null);
        this.erro.set(mensagemDoServidor(erro, 'Não foi possível descartar o rascunho.'));
      },
    });
  }

  private rotas() {
    const equipamento = this.equipamento();
    return equipamento ? ROTAS.empresa(this.empresa()?.slug ?? '').equipamento(equipamento.code) : null;
  }

  private carregar(companyId: string, code: string): void {
    this.service.list(companyId, code).subscribe({
      next: (lista) => this.analises.set(lista),
      error: (erro: unknown) => {
        this.analises.set([]);
        this.erro.set(mensagemDoServidor(erro, 'Não foi possível carregar as análises.'));
      },
    });
  }
}
