import type { PeAssessment } from '@prisma/client';
import { PE_CRITERIA, emptyPeAnswers, type PeAnswers, type PeDto, type PeUpsert } from '@normatiza/shared';

import { FilesService } from '../storage/files.service';
import { foto } from './risk-point-dto';

export type PeComFoto = PeAssessment & { photo: { id: string; storageKey: string; thumbnailKey: string | null } | null };

export const FOTO_DO_PE = { photo: { select: { id: true, storageKey: true, thumbnailKey: true } } } as const;

/** Os oito quesitos completos: o que não veio é "Não", como no legado. */
export function respostasDoPe(entrada: PeUpsert['answers'] | unknown): PeAnswers {
  const vindas = (entrada ?? {}) as NonNullable<PeUpsert['answers']>;
  const respostas = emptyPeAnswers();
  for (const c of PE_CRITERIA) {
    respostas[c.key] = { physicalState: vindas[c.key]?.physicalState === true, nr12Compliant: vindas[c.key]?.nr12Compliant === true };
  }
  return respostas;
}

/** O PE como a API o devolve — no detalhe da análise e na gravação. */
export async function peDto(files: FilesService, p: PeComFoto): Promise<PeDto> {
  return {
    id: p.id,
    number: p.number,
    ...(p.location ? { location: p.location } : {}),
    answers: respostasDoPe(p.answers),
    violatedStandardIds: p.violatedStandardIds,
    ...(p.solution ? { solution: p.solution } : {}),
    ...(p.photo ? { photo: await foto(files, p.photo) } : {}),
  };
}
