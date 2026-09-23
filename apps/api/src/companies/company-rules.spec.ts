import {
  deriveCompanyStatus,
  formatCnpj,
  isValidCnpj,
  normalizeForSearch,
  type ManagerSeat,
} from '@normatiza/shared';

/**
 * Regras puras de `@normatiza/shared` — as mesmas no servidor, no painel e no
 * app de campo. Testadas aqui porque é aqui que a suíte roda.
 */
describe('Regras de empresa', () => {
  describe('CNPJ', () => {
    it('deve aceitar um CNPJ válido, com ou sem máscara', () => {
      expect(isValidCnpj('11.222.333/0001-81')).toBe(true);
      expect(isValidCnpj('11222333000181')).toBe(true);
    });

    it('deve recusar dígito verificador errado', () => {
      expect(isValidCnpj('11.222.333/0001-82')).toBe(false);
    });

    it('deve recusar sequência repetida, que passa no módulo 11 e não é CNPJ', () => {
      expect(isValidCnpj('11.111.111/1111-11')).toBe(false);
      expect(isValidCnpj('00000000000000')).toBe(false);
    });

    it('deve recusar tamanho errado', () => {
      expect(isValidCnpj('1122233300018')).toBe(false);
    });

    it('deve formatar para exibição', () => {
      expect(formatCnpj('11222333000181')).toBe('11.222.333/0001-81');
    });
  });

  describe('texto de busca', () => {
    it('deve tratar acento, maiúscula e espaço sobrando como a mesma coisa', () => {
      expect(normalizeForSearch('  São   PAULO ')).toBe(normalizeForSearch('sao paulo'));
    });
  });

  describe('status da empresa', () => {
    const agora = new Date('2026-09-23T12:00:00Z');
    const amanha = new Date('2026-09-24T12:00:00Z');
    const ontem = new Date('2026-09-22T12:00:00Z');

    const convidado = (expiresAt: Date, status: 'PENDING' | 'REVOKED' = 'PENDING'): ManagerSeat => ({
      userStatus: 'INVITED',
      invitation: { status, expiresAt },
    });

    it('deve estar em implantação quando não há Gestor nenhum', () => {
      expect(deriveCompanyStatus({ managers: [] }, agora)).toBe('IMPLANTATION');
    });

    it('deve aguardar o Gestor enquanto o convite dele está aberto', () => {
      expect(deriveCompanyStatus({ managers: [convidado(amanha)] }, agora)).toBe(
        'AWAITING_MANAGER',
      );
    });

    it('deve voltar a implantação quando o convite do Gestor expira, sem ninguém fazer nada', () => {
      expect(deriveCompanyStatus({ managers: [convidado(ontem)] }, agora)).toBe('IMPLANTATION');
    });

    it('deve voltar a implantação quando o convite do Gestor é cancelado', () => {
      expect(deriveCompanyStatus({ managers: [convidado(amanha, 'REVOKED')] }, agora)).toBe(
        'IMPLANTATION',
      );
    });

    it('deve ficar ativa só quando um Gestor aceita — convite aberto não basta', () => {
      expect(
        deriveCompanyStatus({ managers: [convidado(amanha), { userStatus: 'ACTIVE' }] }, agora),
      ).toBe('ACTIVE');
    });

    it('não deve contar Gestor desligado', () => {
      expect(deriveCompanyStatus({ managers: [{ userStatus: 'DISABLED' }] }, agora)).toBe(
        'IMPLANTATION',
      );
    });

    it('deve ficar inativa quando desativada, tenha Gestor ou não', () => {
      expect(
        deriveCompanyStatus({ deactivatedAt: ontem, managers: [{ userStatus: 'ACTIVE' }] }, agora),
      ).toBe('INACTIVE');
    });
  });
});
