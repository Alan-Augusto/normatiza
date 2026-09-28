/**
 * O slug da empresa: o trecho legível da URL do Contexto 2
 * (docs/produto/03_navegacao_e_telas.md §4, "O endereço da empresa é legível").
 *
 * Funções puras, sem banco: quem sabe o que já está ocupado é o servidor, que
 * percorre `candidatosDeSlug` e fica com o primeiro livre.
 */

/**
 * Slugs que colidiriam com uma tela declarada sob `/app/empresas/`. O
 * `rotas.spec.ts` do painel falha se aparecer rota estática nova ali sem entrar
 * nesta lista.
 */
export const SLUGS_RESERVADOS_DE_EMPRESA: readonly string[] = ['nova'];

const TAMANHO_MÁXIMO = 60;

/**
 * Sufixos societários, em tokens já normalizados. Só saem do **fim** do nome:
 * "SA Ferragens" começa com "sa" e continua sendo "sa-ferragens".
 */
const SUFIXOS_SOCIETÁRIOS: readonly (readonly string[])[] = [
  ['ltda'],
  ['s', 'a'],
  ['sa'],
  ['me'],
  ['epp'],
  ['eireli'],
];

function palavras(texto: string): string[] {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function semSufixoSocietário(tokens: string[]): string[] {
  const resultado = [...tokens];
  let tirou = true;
  while (tirou) {
    tirou = false;
    for (const sufixo of SUFIXOS_SOCIETÁRIOS) {
      const início = resultado.length - sufixo.length;
      // Nunca esvazia o nome: uma empresa chamada "SA" continua sendo "sa".
      if (início < 1) continue;
      if (sufixo.every((parte, i) => resultado[início + i] === parte)) {
        resultado.splice(início);
        tirou = true;
      }
    }
  }
  return resultado;
}

/** Junta palavras até o limite, sem cortar uma no meio (salvo a primeira, se sozinha já passa). */
function caber(tokens: string[]): string {
  let slug = '';
  for (const token of tokens) {
    const próximo = slug ? `${slug}-${token}` : token;
    if (próximo.length > TAMANHO_MÁXIMO) break;
    slug = próximo;
  }
  return slug || (tokens[0] ?? '').slice(0, TAMANHO_MÁXIMO);
}

export function slugBase(nomeFantasia: string): string {
  return caber(semSufixoSocietário(palavras(nomeFantasia))) || 'empresa';
}

/**
 * A ordem de preferência: o nome; o nome com a cidade; o nome com a cidade e um
 * número. Nada aleatório nem iniciais — o slug existe para ser lido. Palavra
 * reservada nunca é oferecida.
 */
export function candidatosDeSlug(base: string, cidade?: string | null): string[] {
  const daCidade = cidade ? palavras(cidade).join('-') : '';
  const comCidade =
    daCidade && !base.endsWith(`-${daCidade}`) && base !== daCidade ? `${base}-${daCidade}` : base;

  const candidatos = [base];
  if (comCidade !== base) candidatos.push(comCidade);
  for (let n = 2; n <= 99; n++) candidatos.push(`${comCidade}-${n}`);

  return candidatos.filter((slug) => !SLUGS_RESERVADOS_DE_EMPRESA.includes(slug));
}
