/**
 * Tamanho mínimo de senha.
 *
 * Regra de composição (maiúscula, símbolo, dígito) fica de fora de propósito:
 * obriga a senha ruim e memorizável. Comprimento é o que mede resistência.
 *
 * Vive aqui, e não na API e no front separadamente, porque já esteve nos dois —
 * com valores diferentes. O formulário aceitava 8, o servidor exigia 10, e a
 * pessoa que digitava 9 recebia uma recusa que a tela traduzia como "convite
 * expirado". Duas cópias de um número não ficam iguais sozinhas.
 */
export const SENHA_MINIMA = 10;

/**
 * A frase que a pessoa lê. Também é uma só: a API a devolve na validação e o
 * front a mostra antes de enviar, e não pode haver duas redações do mesmo
 * limite dizendo números diferentes.
 */
export const MENSAGEM_SENHA_CURTA = `A senha precisa de ao menos ${SENHA_MINIMA} caracteres.`;
