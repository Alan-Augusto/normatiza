import { Component } from '@angular/core';

/**
 * Plano e Créditos — do **titular da conta**.
 *
 * A conta é a unidade de faturamento ([01 §5](../../../../../../docs/produto/01_papeis_e_permissoes.md)):
 * quem contrata é a consultoria, através de quem responde por ela. Nem o resto
 * da consultoria nem o lado cliente têm o que fazer aqui.
 *
 * Tela ainda não construída — a placa existe para que a rota tenha destino real
 * e o item de menu não leve a lugar nenhum.
 */
@Component({
  selector: 'app-billing',
  standalone: true,
  template: `
    <p class="text-sm text-muted-color">
      Plano contratado, créditos e histórico de cobrança aparecerão aqui.
    </p>
  `,
})
export class BillingComponent {}
