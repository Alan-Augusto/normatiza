/**
 * Produção. Vale o mesmo do ambiente de desenvolvimento: a API responde na raiz
 * da própria origem, por causa do `Path=/auth` do cookie de refresh.
 *
 * O endereço é definitivo no deploy. Enquanto o domínio próprio não existe, este
 * valor é o que precisa ser conferido antes de publicar.
 */
export const environment = {
  production: true,
  apiBaseUrl: 'https://api.normatiza.com',
};
