import { HttpErrorResponse } from '@angular/common/http';

/**
 * A mensagem que a pessoa lê quando o servidor recusa alguma coisa.
 *
 * Existe porque a tela estava **inventando** o motivo: qualquer resposta 4xx
 * virava "este convite não vale mais", inclusive um 400 que dizia, com todas as
 * letras, que a senha era curta demais. Quem lia era mandado pedir um convite
 * novo para resolver um problema que não existia.
 *
 * A regra passa a ser: **o servidor sabe o que aconteceu; a tela repete**. Só
 * se inventa texto quando não há o que repetir — falha de rede, erro 500, ou
 * uma mensagem técnica que não foi escrita para ser lida.
 */
export function mensagemDoServidor(erro: unknown, alternativa: string): string {
  if (!(erro instanceof HttpErrorResponse)) return alternativa;

  // Sem resposta (rede fora) ou defeito do servidor: não há nada que a pessoa
  // possa fazer com o texto interno, e ele costuma nem existir.
  if (erro.status === 0 || erro.status >= 500) return alternativa;

  // O limite de tentativas responde em inglês, do pacote de throttling. É a
  // única recusa cuja frase a tela precisa escrever no lugar do servidor.
  if (erro.status === 429) {
    return 'Muitas tentativas seguidas. Espere um minuto e tente de novo.';
  }

  return primeiraFrase(erro.error) ?? alternativa;
}

/**
 * O `ValidationPipe` do Nest devolve **uma lista** de mensagens quando mais de
 * um campo falha; as demais recusas devolvem uma frase só. Ler apenas
 * `message` como string perderia a lista inteira, silenciosamente.
 */
function primeiraFrase(corpo: unknown): string | null {
  const mensagem = (corpo as { message?: unknown } | null)?.message;

  if (Array.isArray(mensagem)) {
    const frases = mensagem.filter((item): item is string => typeof item === 'string');
    return frases.length > 0 ? frases.join(' ') : null;
  }

  return typeof mensagem === 'string' && mensagem.trim() ? mensagem : null;
}
