import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  FormsModule,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Button } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { InputText } from 'primeng/inputtext';
import { RadioButton } from 'primeng/radiobutton';

import {
  ROLE_LABEL,
  isCompanyScopedRole,
  type CompanySummary,
  type ExecutorType,
  type Role,
} from '@normatiza/shared';

import { aparaEmail } from '../../../core/forms/email';
import { mensagemDoServidor } from '../../../core/http/mensagem-de-erro';
import { TeamService } from '../../../core/services/team.service';
import { RolePickerComponent } from './role-picker.component';

/**
 * O formulário de convite — o mesmo nas duas telas de equipe.
 *
 * A diferença entre elas não é o formulário, é o **escopo**: no Contexto 2 já
 * se sabe de qual empresa se está falando, e perguntar seria oferecer ao Gestor
 * uma escolha que ele não tem. Por isso `companyId` fixo esconde o seletor
 * inteiro em vez de deixá-lo com uma opção só.
 *
 * A lista de papéis **não é o enum**: é o que quem convida pode conceder — e,
 * quando isso é um papel só, o formulário informa em vez de perguntar
 * (`app-role-picker`, D21). Para o Antonio, que só concede Executor, sobra
 * exatamente o que é pergunta de verdade: **nome, e-mail e interno × terceiro**.
 *
 * **Reactive forms tipado** (D24), e não sinais soltos: validade por campo,
 * estado `touched` e erro ao lado do campo não têm onde morar em `ngModel` sobre
 * sinal. Sem isso o e-mail malformado só era recusado pelo servidor, e voltava
 * como uma frase genérica no rodapé — longe do campo que a causou.
 */
@Component({
  selector: 'app-invite-form',
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    Button,
    Checkbox,
    InputText,
    RadioButton,
    RolePickerComponent,
  ],
  templateUrl: './invite-form.component.html',
})
export class InviteFormComponent {
  private readonly team = inject(TeamService);
  private readonly fb = inject(NonNullableFormBuilder);

  /** Os papéis que quem está convidando pode conceder. */
  readonly roles = input.required<readonly Role[]>();

  /** As empresas oferecidas. Vazio quando a empresa já está decidida. */
  readonly companies = input<readonly CompanySummary[]>([]);

  /** Contexto 2: a empresa da rota, sem pergunta nenhuma. */
  readonly fixedCompanyId = input<string>();

  readonly created = output<void>();

  readonly enviando = signal(false);
  readonly erro = signal<string | null>(null);

  readonly form = this.fb.group({
    nome: this.fb.control('', Validators.required),
    email: this.fb.control('', [Validators.required, Validators.email]),
    papel: this.fb.control<Role | ''>('', Validators.required),
    tipoDeExecutor: this.fb.control<ExecutorType>('INTERNAL'),
    cargo: this.fb.control(''),
    telefone: this.fb.control(''),
    empresas: this.fb.control<string[]>([]),
  });

  private readonly valores = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  private readonly situacao = toSignal(this.form.statusChanges, {
    initialValue: this.form.status,
  });

  readonly opcoesDeExecutor: { label: string; value: ExecutorType }[] = [
    { label: 'Interno — funcionário da própria empresa', value: 'INTERNAL' },
    { label: 'Terceiro — empresa ou profissional contratado', value: 'THIRD_PARTY' },
  ];

  readonly ehExecutor = computed(() => this.valores().papel === 'EXECUTOR');

  readonly empresasEscolhidas = computed(() => this.valores().empresas ?? []);

  constructor() {
    /**
     * Um papel só não é escolha, mas continua sendo **valor**: sem isto o
     * formulário do Antonio nasceria inválido por um campo que ele não tem como
     * preencher, e o botão ficaria travado sem nada na tela explicando o quê.
     */
    effect(() => {
      const oferecidos = this.roles();
      if (oferecidos.length === 1 && this.form.controls.papel.value === '') {
        this.form.controls.papel.setValue(oferecidos[0]);
      }
    });
  }

  /** Quem lê o rótulo do papel escolhido — usado no rodapé de confirmação. */
  rotuloDoPapel(papel: Role): string {
    return ROLE_LABEL[papel];
  }

  /**
   * Papel de escopo-empresa vale numa empresa só — a mesma invariante que a
   * troca de papel antecipa. Aqui ela aparece antes de existir vínculo algum.
   */
  readonly escopoDemaisDeUma = computed(() => {
    const papel = this.valores().papel;
    return !!papel && isCompanyScopedRole(papel) && this.empresasEscolhidas().length > 1;
  });

  readonly podeEnviar = computed(
    () =>
      !this.enviando() &&
      this.situacao() === 'VALID' &&
      !this.escopoDemaisDeUma() &&
      this.escopo().length > 0,
  );

  /** Erro de campo só depois de a pessoa ter passado por ele — nunca ao abrir. */
  erroDe(campo: 'nome' | 'email'): string | null {
    const controle = this.form.controls[campo];
    if (!controle.touched || controle.valid) return null;

    if (controle.hasError('required')) {
      return campo === 'nome'
        ? 'Informe o nome de quem vai receber o convite.'
        : 'Informe o e-mail.';
    }
    return 'Esse e-mail não parece válido. Confira antes de enviar.';
  }

  /**
   * Apara **antes** de validar. `Validators.email` é ancorado: um endereço
   * colado com espaço reprova, e a pessoa lê "e-mail inválido" olhando para o
   * endereço certo. Mesmo defeito que já foi corrigido no login e no DTO da
   * concessão de admin — a terceira vez que ele aparece neste sistema.
   */
  aoSairDoEmail(): void {
    aparaEmail(this.form.controls.email);
  }

  private escopo(): string[] {
    const fixa = this.fixedCompanyId();
    return fixa ? [fixa] : this.empresasEscolhidas();
  }

  alternarEmpresa(companyId: string, marcada: boolean): void {
    const atuais = this.form.controls.empresas.value;
    this.form.controls.empresas.setValue(
      marcada ? [...atuais, companyId] : atuais.filter((id) => id !== companyId),
    );
  }

  enviar(): void {
    if (!this.podeEnviar()) {
      this.form.markAllAsTouched();
      return;
    }

    const { nome, email, papel, tipoDeExecutor, cargo, telefone } = this.form.getRawValue();
    if (papel === '') return;

    this.enviando.set(true);
    this.erro.set(null);

    this.team
      .invite({
        name: nome.trim(),
        email: email.trim(),
        roles: [papel],
        companyIds: this.escopo(),
        ...(papel === 'EXECUTOR' ? { executorType: tipoDeExecutor } : {}),
        ...(cargo.trim() ? { jobTitle: cargo.trim() } : {}),
        ...(telefone.trim() ? { phone: telefone.trim() } : {}),
      })
      .subscribe({
        next: () => {
          this.enviando.set(false);
          this.created.emit();
        },
        error: (falha: unknown) => {
          this.enviando.set(false);
          this.erro.set(mensagemDoServidor(falha, 'Não foi possível enviar o convite.'));
        },
      });
  }
}
