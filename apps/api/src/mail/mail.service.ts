import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

import { EnvironmentVariables } from '../config/env.validation';

export interface ConviteEmail {
  to: string;
  nome: string;
  convidadoPor: string;
  conta: string;
  link: string;
}

export interface RecuperacaoEmail {
  to: string;
  nome: string;
  link: string;
}

/** Deve bater com `VALIDADE_DO_CONVITE_EM_DIAS` do `InvitationsService`. */
const VALIDADE_DO_CONVITE_EM_DIAS = 7;

/**
 * Envio de e-mail transacional.
 *
 * O ponto sensível deste serviço não é entregar — é **não entregar**. O elenco
 * de testes e o seed usam endereços de domínios que não existem
 * (`marcos@brf.com`, `josue@normatiza.com`); disparar para eles produz *hard
 * bounces*, e reputação de remetente queimada não se conserta com deploy — o
 * convite legítimo do cliente passa a cair em spam.
 *
 * Daí o desenho: **o envio real é opt-in explícito.**
 *
 * | `MAIL_TRANSPORT` | O que acontece |
 * | :--- | :--- |
 * | `console` (padrão) | O e-mail é impresso no log, com o link. Ninguém recebe nada. |
 * | `resend` | Envia — respeitando a `MAIL_ALLOWLIST`. |
 *
 * E duas travas por cima disso:
 * - `NODE_ENV=test` **nunca** envia, aconteça o que acontecer;
 * - fora de produção, sem `MAIL_ALLOWLIST`, o padrão é não enviar para ninguém —
 *   e não "enviar para todos".
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly provedor: Pick<Resend, 'emails'> | null;

  constructor(private readonly config: ConfigService<EnvironmentVariables, true>) {
    const chave = this.config.get('RESEND_API_KEY', { infer: true });
    this.provedor = chave ? new Resend(chave) : null;
  }

  async enviarConvite(dados: ConviteEmail): Promise<void> {
    await this.enviar({
      to: dados.to,
      subject: `${dados.convidadoPor} convidou você para o Normatiza`,
      html: templateConvite(dados),
      resumo: `convite para ${dados.conta}`,
      link: dados.link,
    });
  }

  async enviarRecuperacaoDeSenha(dados: RecuperacaoEmail): Promise<void> {
    await this.enviar({
      to: dados.to,
      subject: 'Redefinir sua senha do Normatiza',
      html: templateRecuperacao(dados),
      resumo: 'recuperação de senha',
      link: dados.link,
    });
  }

  private async enviar(email: {
    to: string;
    subject: string;
    html: string;
    resumo: string;
    link: string;
  }): Promise<void> {
    if (!this.podeEnviarPara(email.to)) {
      this.logger.log(
        `[e-mail não enviado] ${email.resumo} → ${email.to}\n  ${email.link}`,
      );
      return;
    }

    // Falha de e-mail não derruba a operação que o originou: um provedor fora do
    // ar não pode impedir alguém de ser convidado. A tela oferece reenviar.
    try {
      await this.provedor!.emails.send({
        from: this.config.get('MAIL_FROM', { infer: true }),
        to: email.to,
        subject: email.subject,
        html: email.html,
      });
      this.logger.log(`[e-mail enviado] ${email.resumo} → ${email.to}`);
    } catch (erro) {
      this.logger.error(
        `Falha ao enviar ${email.resumo} para ${email.to}: ${(erro as Error).message}`,
      );
    }
  }

  private podeEnviarPara(destinatário: string): boolean {
    // A suíte roda dezenas de convites por minuto. Um `MAIL_TRANSPORT=resend`
    // esquecido no ambiente despejaria todos eles em domínios inexistentes.
    if (this.config.get('NODE_ENV', { infer: true }) === 'test') return false;

    if (this.config.get('MAIL_TRANSPORT', { infer: true }) !== 'resend') return false;
    if (!this.provedor) {
      this.logger.warn('MAIL_TRANSPORT=resend sem RESEND_API_KEY — nada será enviado.');
      return false;
    }

    const lista = this.allowlist();
    if (lista.length > 0) return lista.includes(destinatário.trim().toLowerCase());

    // Sem lista, só produção libera geral. Fora dela, o silêncio é o padrão
    // seguro — "não enviei" se conserta com uma variável, "enviei para o
    // cliente errado" não se conserta.
    return this.config.get('NODE_ENV', { infer: true }) === 'production';
  }

  private allowlist(): string[] {
    return (this.config.get('MAIL_ALLOWLIST', { infer: true }) ?? '')
      .split(',')
      .map((e: string) => e.trim().toLowerCase())
      .filter(Boolean);
  }
}

const ESTILO_BOTÃO =
  'display:inline-block;padding:12px 24px;background:#0f172a;color:#ffffff;' +
  'text-decoration:none;border-radius:6px;font-weight:600';

const ESTILO_CORPO =
  'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;' +
  'font-size:15px;line-height:1.6;color:#0f172a;max-width:480px';

function templateConvite({ nome, convidadoPor, conta, link }: ConviteEmail): string {
  return `
    <div style="${ESTILO_CORPO}">
      <p>Olá, ${escapar(nome)}.</p>
      <p>
        <strong>${escapar(convidadoPor)}</strong> criou um acesso para você no Normatiza,
        o sistema de adequação à NR-12 da <strong>${escapar(conta)}</strong>.
      </p>
      <p>Falta só você definir uma senha:</p>
      <p style="margin:24px 0"><a href="${link}" style="${ESTILO_BOTÃO}">Definir minha senha</a></p>
      <p style="color:#64748b;font-size:13px">
        O link vale por ${VALIDADE_DO_CONVITE_EM_DIAS} dias e só pode ser usado uma vez.
        Se você não esperava este convite, pode ignorar esta mensagem.
      </p>
    </div>
  `;
}

function templateRecuperacao({ nome, link }: RecuperacaoEmail): string {
  return `
    <div style="${ESTILO_CORPO}">
      <p>Olá, ${escapar(nome)}.</p>
      <p>Recebemos um pedido para redefinir a senha da sua conta no Normatiza.</p>
      <p style="margin:24px 0"><a href="${link}" style="${ESTILO_BOTÃO}">Definir nova senha</a></p>
      <p style="color:#64748b;font-size:13px">
        O link vale por 1 hora e só pode ser usado uma vez. Definir a senha nova
        encerra todas as sessões abertas.
      </p>
      <p style="color:#64748b;font-size:13px">
        <strong>Se não foi você que pediu</strong>, ignore esta mensagem — sua senha
        atual continua valendo.
      </p>
    </div>
  `;
}

/** O nome vem do cadastro e é digitado por gente: nunca entra cru no HTML. */
function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
