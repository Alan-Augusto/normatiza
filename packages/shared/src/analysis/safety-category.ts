/**
 * A categoria de segurança pela NBR 14153, opcional em cada ponto de risco
 * (docs/produto/04 §4). Três respostas dão uma categoria de 1 a 4, e a regra é
 * a do legado, para o laudo migrado imprimir o mesmo.
 */

export type SafetyCategoryNumber = 1 | 2 | 3 | 4;

export interface SafetyCategoryAnswers {
  /** S1 ferimento leve · S2 ferimento sério, incluindo morte. */
  severity: 1 | 2;
  /** F1 raro a relativamente frequente · F2 frequente a contínuo. Só com S2. */
  frequency?: 1 | 2;
  /** P1 possível sob condições específicas · P2 quase nunca possível. Só com S2. */
  possibility?: 1 | 2;
}

export interface SafetyCategory extends SafetyCategoryAnswers {
  category: SafetyCategoryNumber;
}

/** Os textos da tela do legado, para as respostas migradas significarem o mesmo. */
export const SAFETY_CATEGORY_OPTIONS = {
  severity: [
    { value: 1, code: 'S1', label: 'Ferimento leve (normalmente reversível)' },
    { value: 2, code: 'S2', label: 'Ferimento sério (normalmente irreversível, incluindo morte)' },
  ],
  frequency: [
    { value: 1, code: 'F1', label: 'Raro a relativamente frequente e/ou baixo tempo de exposição' },
    { value: 2, code: 'F2', label: 'Frequente a contínuo e/ou tempo de exposição longo' },
  ],
  possibility: [
    { value: 1, code: 'P1', label: 'Possível sob condições específicas' },
    { value: 2, code: 'P2', label: 'Quase nunca possível' },
  ],
} as const;

/**
 * S1 → 1; S2 com F1 e P1 → 2; S2 com F2 e P2 → 4; o resto de S2 → 3.
 * Com S1, frequência e possibilidade não contam (a tela as desliga).
 */
export function safetyCategory(respostas: SafetyCategoryAnswers): SafetyCategory {
  if (respostas.severity === 1) return { severity: 1, category: 1 };

  const { frequency, possibility } = respostas;
  if (frequency === undefined || possibility === undefined) {
    throw new RangeError('Com ferimento sério (S2), frequência e possibilidade de evitar são obrigatórias');
  }
  const category: SafetyCategoryNumber =
    frequency === 1 && possibility === 1 ? 2 : frequency === 2 && possibility === 2 ? 4 : 3;
  return { severity: 2, frequency, possibility, category };
}
