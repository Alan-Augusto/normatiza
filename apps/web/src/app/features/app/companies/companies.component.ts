import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideSearch } from '@ng-icons/lucide';
import { Button, ButtonDirective, ButtonLabel } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';

import {
  COMPANY_ADMIN_ROLES,
  COMPANY_STATUS_LABEL,
  COMPANY_STATUS_ORDER,
  formatCnpj,
  type CompanyListItem,
  type CompanyManagerRef,
  type CompanyListQuery,
  type CompanyStatus,
  type InvitationSummary,
  type Role,
} from '@normatiza/shared';

import { AuthService } from '../../../core/auth/auth.service';
import { mensagemDoServidor } from '../../../core/http/mensagem-de-erro';
import { CompaniesService } from '../../../core/services/companies.service';
import { TeamService } from '../../../core/services/team.service';
import { CompanyInfoComponent } from '../../../shared/components/company-info/company-info.component';
import { CompanyLogoComponent } from '../../../shared/components/company-logo/company-logo.component';
import { DataTable } from '../../../shared/components/data-table/data-table.component';
import {
  AcaoVazia,
  CabecalhoDaTabela,
  LinhaDaTabela,
} from '../../../shared/components/data-table/data-table.directives';
import { RowActionComponent } from '../../../shared/components/row-action/row-action.component';
import { InviteFormComponent } from '../../../shared/components/team/invite-form.component';
import { ROTAS } from '../../../core/routing/rotas';

/**
 * Empresas — Contexto 1 (docs/produto/03 §3.2).
 *
 * A carteira em **tabela**: é lista de comparação — "qual cliente está pior?" —
 * e precisa aguentar centenas de linhas. Cartão com foto é o formato do
 * inventário de equipamentos, onde a imagem é informação.
 *
 * A URL é a fonte do estado da lista (D7): busca e filtro vivem nos query
 * params, e é por isso que o "voltar" de dentro de uma empresa encontra a
 * carteira como estava.
 */
@Component({
  selector: 'app-companies',
  standalone: true,
  imports: [
    CompanyLogoComponent,
    RowActionComponent,
    CompanyInfoComponent,
    InviteFormComponent,
    DatePipe,
    DecimalPipe,
    FormsModule,
    RouterLink,
    NgIconComponent,
    Button,
    ButtonDirective,
    ButtonLabel,
    Dialog,
    InputText,
    Message,
    Select,
    DataTable,
    CabecalhoDaTabela,
    LinhaDaTabela,
    AcaoVazia,
  ],
  providers: [provideIcons({ lucideSearch })],
  templateUrl: './companies.component.html',
  styleUrl: './companies.component.css',
})
export class CompaniesComponent implements OnInit {
  protected readonly rotas = ROTAS;

  private readonly companies = inject(CompaniesService);
  private readonly team = inject(TeamService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly empresas = signal<CompanyListItem[]>([]);
  readonly carregando = signal(false);
  readonly erro = signal<string | null>(null);
  readonly aviso = signal<string | null>(null);

  readonly filtros = signal<CompanyListQuery>({});
  /** O texto no campo — separado do filtro aplicado, que espera a pessoa parar de digitar. */
  readonly termo = signal('');

  readonly desativando = signal<CompanyListItem | null>(null);
  readonly processando = signal(false);

  private readonly digitado = new Subject<string>();

  readonly opcoesDeStatus: { label: string; value: CompanyStatus | 'ALL' }[] = [
    ...COMPANY_STATUS_ORDER.map((status) => ({ label: COMPANY_STATUS_LABEL[status], value: status })),
    { label: 'Todas, inclusive inativas', value: 'ALL' as const },
  ];

  /**
   * Quem pode cadastrar vê o botão. O titular da conta sempre pode — numa conta
   * recém-aberta ele ainda não tem vínculo nenhum, e é ele quem cadastra a
   * primeira empresa. O servidor decide igual e revalida no envio.
   */
  readonly podeCadastrar = computed(() => {
    if (this.auth.isAccountOwner()) return true;
    return (this.auth.session()?.memberships ?? []).some(
      (v) => v.isActive && v.roles.some((papel) => COMPANY_ADMIN_ROLES.includes(papel)),
    );
  });

  /** A empresa cujo Gestor está sendo convidado — o diálogo de convite. */
  readonly convidandoGestor = signal<CompanyListItem | null>(null);
  readonly papelDoGestor: readonly Role[] = ['MANAGER'];

  /** A prévia aberta pelo olho — o mesmo diálogo que o nome da empresa abre na sidebar. */
  readonly vendo = signal<CompanyListItem | null>(null);

  readonly buscando = computed(() => !!this.filtros().q || !!this.filtros().status);

  readonly tituloDoVazio = computed(() =>
    this.buscando() ? 'Nenhuma empresa encontrada.' : 'Nenhuma empresa na sua carteira.',
  );

  readonly detalheDoVazio = computed(() =>
    this.buscando()
      ? 'Tente outro termo — a busca olha nome, CNPJ, cidade, grupo, contato e Gestor.'
      : this.podeCadastrar()
        ? 'Cadastre a primeira empresa atendida. O Gestor dela pode ser convidado logo depois.'
        : 'Quando alguém incluir você no atendimento de uma empresa, ela aparece aqui.',
  );

  ngOnInit(): void {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const status = params.get('status') as CompanyListQuery['status'] | null;
      const q = params.get('q') ?? '';
      this.filtros.set({ q: q || undefined, status: status ?? undefined });
      this.termo.set(q);
      this.carregar();
    });

    // Uma busca por tecla gastaria o servidor com "c", "co", "con"…
    this.digitado
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((q) => this.aplicar({ q: q.trim() || undefined }));
  }

  carregar(): void {
    this.carregando.set(true);
    this.erro.set(null);

    this.companies.list(this.filtros()).subscribe({
      next: (empresas) => {
        this.empresas.set(empresas);
        this.carregando.set(false);
      },
      error: () => {
        this.carregando.set(false);
        this.erro.set('Não foi possível carregar a carteira.');
      },
    });
  }

  aoDigitar(valor: string): void {
    this.termo.set(valor);
    this.digitado.next(valor);
  }

  filtrarStatus(status: CompanyListQuery['status'] | null): void {
    this.aplicar({ status: status ?? undefined });
  }

  /** O filtro vai para a URL, e a URL recarrega a lista — um caminho só. */
  private aplicar(mudança: Partial<CompanyListQuery>): void {
    const próximo = { ...this.filtros(), ...mudança };
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { q: próximo.q || null, status: próximo.status || null },
      replaceUrl: true,
    });
  }

  /**
   * Clique na linha entra na empresa — menos quando ele foi num controle da
   * própria linha (o link do nome, as ações) ou terminou uma seleção de texto:
   * quem arrasta para copiar um CNPJ não quer ser levado embora.
   */
  entrar(empresa: CompanyListItem, evento: MouseEvent): void {
    const alvo = evento.target as HTMLElement | null;
    if (alvo?.closest('a, button, input, [role="button"]')) return;
    if (window.getSelection()?.toString()) return;
    this.router.navigateByUrl(ROTAS.empresa(empresa.id).painel);
  }

  cnpj(documento: string): string {
    return formatCnpj(documento);
  }

  rotuloDoStatus(status: CompanyStatus): string {
    return COMPANY_STATUS_LABEL[status];
  }

  // ── O Gestor, a partir da lista (docs/produto/03 §3.2) ───────────────────

  /**
   * Em implantação não há Gestor a caminho — nem convidado, ou o convite
   * venceu. Com um convite ainda valendo, um segundo seria dúvida, não ajuda:
   * o que se oferece ali é reenviar.
   */
  podeConvidarGestor(empresa: CompanyListItem): boolean {
    return empresa.actions.inviteManager && empresa.status === 'IMPLANTATION';
  }

  /** O Gestor convidado cujo convite se pode reenviar — vencido ou não: o e-mail pode não ter chegado. */
  conviteParaReenviar(empresa: CompanyListItem): CompanyManagerRef | undefined {
    if (!empresa.actions.inviteManager) return undefined;
    return empresa.managers.find((gestor) => gestor.invitation);
  }

  aoConvidarGestor(convite: InvitationSummary): void {
    this.convidandoGestor.set(null);
    this.aviso.set(`Convite de Gestor enviado para ${convite.email}.`);
    this.carregar();
  }

  reenviarConvite(gestor: CompanyManagerRef): void {
    if (!gestor.invitation) return;
    this.aviso.set(null);
    this.team.resendInvitation(gestor.invitation.id).subscribe({
      next: () => {
        this.aviso.set(`Convite reenviado para ${gestor.name}, com um link novo válido por 7 dias.`);
        this.carregar();
      },
      error: (erro) => this.erro.set(mensagemDoServidor(erro, 'Não foi possível reenviar o convite.')),
    });
  }

  confirmarDesativar(): void {
    const empresa = this.desativando();
    if (!empresa) return;

    this.processando.set(true);
    this.companies.deactivate(empresa.id).subscribe({
      next: () => {
        this.processando.set(false);
        this.desativando.set(null);
        this.carregar();
      },
      error: (erro) => {
        this.processando.set(false);
        this.erro.set(mensagemDoServidor(erro, 'Não foi possível desativar a empresa.'));
      },
    });
  }

  reativar(empresa: CompanyListItem): void {
    this.companies.reactivate(empresa.id).subscribe({
      next: () => this.carregar(),
      error: (erro) => this.erro.set(mensagemDoServidor(erro, 'Não foi possível reativar a empresa.')),
    });
  }
}
