import { ConfigService } from '@nestjs/config';

import { MailService } from './mail.service';
import { EnvironmentVariables } from '../config/env.validation';

/**
 * O que estes testes protegem não é a entrega — é o **não-envio**.
 *
 * O elenco de testes e o seed usam endereços de domínios que não existem
 * (`marcos@brf.com`, `josue@normatiza.com`). Disparar para eles queima a
 * reputação do domínio remetente com *hard bounces*, e reputação queimada não
 * se conserta com deploy: e-mail de convite legítimo passa a cair em spam.
 *
 * Por isso o envio real é **opt-in explícito**, e não o padrão.
 */
function configFake(valores: Record<string, unknown>) {
  return {
    get: (chave: string) => valores[chave],
  } as unknown as ConfigService<EnvironmentVariables, true>;
}

describe('MailService', () => {
  let enviados: { to: string; subject: string }[];

  /** Substitui o SDK do Resend: aqui não se testa a rede, se testa a decisão. */
  const provedorFalso = {
    emails: {
      send: jest.fn(async (payload: { to: string; subject: string }) => {
        enviados.push(payload);
        return { data: { id: 'msg-1' }, error: null };
      }),
    },
  };

  function criar(valores: Record<string, unknown> = {}) {
    const service = new MailService(
      configFake({
        NODE_ENV: 'development',
        MAIL_FROM: 'Normatiza <onboarding@resend.dev>',
        ...valores,
      }),
    );
    (service as unknown as { provedor: unknown }).provedor = provedorFalso;
    return service;
  }

  beforeEach(() => {
    enviados = [];
    provedorFalso.emails.send.mockClear();
  });

  describe('a trava de envio', () => {
    it('não deve enviar nada de verdade quando o transporte é o console', async () => {
      // O padrão em desenvolvimento. O link vai para o log, e ninguém recebe nada.
      const mail = criar({ MAIL_TRANSPORT: 'console' });

      await mail.enviarConvite({
        to: 'marcos@brf.com',
        nome: 'Marcos',
        convidadoPor: 'Josué',
        conta: 'Normatiza',
        link: 'http://localhost:8080/accept-invite?token=abc',
      });

      expect(provedorFalso.emails.send).not.toHaveBeenCalled();
    });

    it('nunca deve enviar durante a suíte de testes, mesmo com o transporte ligado', async () => {
      // Cinto e suspensório: a suíte roda dezenas de convites por minuto, e um
      // `MAIL_TRANSPORT=resend` esquecido no ambiente despejaria todos eles.
      const mail = criar({ NODE_ENV: 'test', MAIL_TRANSPORT: 'resend' });

      await mail.enviarConvite({
        to: 'marcos@brf.com',
        nome: 'Marcos',
        convidadoPor: 'Josué',
        conta: 'Normatiza',
        link: 'http://x/y',
      });

      expect(provedorFalso.emails.send).not.toHaveBeenCalled();
    });

    it('deve enviar quando o transporte é o provedor e o destinatário é permitido', async () => {
      const mail = criar({
        MAIL_TRANSPORT: 'resend',
        MAIL_ALLOWLIST: 'alanaugustodev@gmail.com',
      });

      await mail.enviarConvite({
        to: 'alanaugustodev@gmail.com',
        nome: 'Alan',
        convidadoPor: 'Josué',
        conta: 'Normatiza',
        link: 'http://localhost:8080/accept-invite?token=abc',
      });

      expect(enviados).toHaveLength(1);
      expect(enviados[0].to).toBe('alanaugustodev@gmail.com');
    });

    it('deve barrar destinatário fora da lista quando a lista existe', async () => {
      // É esta linha que impede um convite de teste de sair para o mundo.
      const mail = criar({
        MAIL_TRANSPORT: 'resend',
        MAIL_ALLOWLIST: 'alanaugustodev@gmail.com',
      });

      await mail.enviarConvite({
        to: 'marcos@brf.com',
        nome: 'Marcos',
        convidadoPor: 'Josué',
        conta: 'Normatiza',
        link: 'http://x/y',
      });

      expect(provedorFalso.emails.send).not.toHaveBeenCalled();
    });

    it('deve aceitar vários endereços na lista, ignorando espaços', async () => {
      const mail = criar({
        MAIL_TRANSPORT: 'resend',
        MAIL_ALLOWLIST: 'alanaugustodev@gmail.com,  outro@exemplo.com ',
      });

      await mail.enviarRecuperacaoDeSenha({
        to: 'outro@exemplo.com',
        nome: 'Outro',
        link: 'http://x/y',
      });

      expect(enviados).toHaveLength(1);
    });

    it('deve comparar o destinatário sem diferenciar maiúsculas', async () => {
      const mail = criar({
        MAIL_TRANSPORT: 'resend',
        MAIL_ALLOWLIST: 'alanaugustodev@gmail.com',
      });

      await mail.enviarRecuperacaoDeSenha({
        to: 'AlanAugustoDev@Gmail.com',
        nome: 'Alan',
        link: 'http://x/y',
      });

      expect(enviados).toHaveLength(1);
    });

    it('deve liberar todos os destinatários apenas em produção sem lista', async () => {
      // Produção é o único lugar onde a ausência de lista significa "pode todos".
      const mail = criar({ NODE_ENV: 'production', MAIL_TRANSPORT: 'resend' });

      await mail.enviarConvite({
        to: 'quem-quer-que-seja@cliente.com.br',
        nome: 'Fulano',
        convidadoPor: 'Josué',
        conta: 'Normatiza',
        link: 'http://x/y',
      });

      expect(enviados).toHaveLength(1);
    });

    it('deve barrar todo mundo fora de produção quando não há lista', async () => {
      // Sem lista e fora de produção, o padrão seguro é não enviar para ninguém —
      // e não "enviar para todos".
      const mail = criar({ MAIL_TRANSPORT: 'resend' });

      await mail.enviarConvite({
        to: 'alguem@exemplo.com',
        nome: 'Alguém',
        convidadoPor: 'Josué',
        conta: 'Normatiza',
        link: 'http://x/y',
      });

      expect(provedorFalso.emails.send).not.toHaveBeenCalled();
    });
  });

  describe('o conteúdo', () => {
    const enviarConvite = (mail: MailService) =>
      mail.enviarConvite({
        to: 'alanaugustodev@gmail.com',
        nome: 'Alan',
        convidadoPor: 'Josué',
        conta: 'Normatiza',
        link: 'http://localhost:8080/accept-invite?token=segredo-abc',
      });

    function comEnvioReal() {
      return criar({ MAIL_TRANSPORT: 'resend', MAIL_ALLOWLIST: 'alanaugustodev@gmail.com' });
    }

    it('deve levar o link de aceite no corpo', async () => {
      const mail = comEnvioReal();
      await enviarConvite(mail);

      const payload = provedorFalso.emails.send.mock.calls[0][0] as unknown as { html: string };
      expect(payload.html).toContain('accept-invite?token=segredo-abc');
    });

    it('deve dizer quem convidou e para qual consultoria', async () => {
      // Convite sem contexto parece phishing — e o destinatário, com razão,
      // não clica.
      const mail = comEnvioReal();
      await enviarConvite(mail);

      const payload = provedorFalso.emails.send.mock.calls[0][0] as unknown as { html: string };
      expect(payload.html).toContain('Josué');
      expect(payload.html).toContain('Normatiza');
    });

    it('não deve prometer prazo diferente do que o convite tem', async () => {
      const mail = comEnvioReal();
      await enviarConvite(mail);

      const payload = provedorFalso.emails.send.mock.calls[0][0] as unknown as { html: string };
      expect(payload.html).toContain('7 dias');
    });
  });

  describe('falha do provedor', () => {
    it('não deve estourar quando o envio falha', async () => {
      // Um provedor fora do ar não pode impedir o convite de ser criado. A falha
      // vai para o log, e a tela oferece reenviar.
      const mail = criar({
        MAIL_TRANSPORT: 'resend',
        MAIL_ALLOWLIST: 'alanaugustodev@gmail.com',
      });
      provedorFalso.emails.send.mockRejectedValueOnce(new Error('502 Bad Gateway'));

      await expect(
        mail.enviarRecuperacaoDeSenha({
          to: 'alanaugustodev@gmail.com',
          nome: 'Alan',
          link: 'http://x/y',
        }),
      ).resolves.toBeUndefined();
    });
  });
});
