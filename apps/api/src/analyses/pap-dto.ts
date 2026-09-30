import type { PapAssessment } from '@prisma/client';
import {
  PAP_CRITERIA,
  PAP_SECTIONS,
  emptyPapAnswers,
  type PapAnswers,
  type PapDto,
  type PapSection,
  type PapUpsert,
} from '@normatiza/shared';

import { FilesService } from '../storage/files.service';
import { foto } from './risk-point-dto';

type Arquivo = { id: string; storageKey: string; thumbnailKey: string | null } | null;

export type PapComFotos = PapAssessment & { activationPhoto: Arquivo; stopPhoto: Arquivo; resetPhoto: Arquivo };

/** A coluna da foto de cada seção, e o nome da relação que a carrega. */
export const FOTO_DA_SEÇÃO = {
  activation: { coluna: 'activationPhotoFileId', relação: 'activationPhoto' },
  stop: { coluna: 'stopPhotoFileId', relação: 'stopPhoto' },
  reset: { coluna: 'resetPhotoFileId', relação: 'resetPhoto' },
} as const satisfies Record<PapSection, { coluna: keyof PapComFotos; relação: keyof PapComFotos }>;

export const FOTOS_DO_PAP = {
  activationPhoto: { select: { id: true, storageKey: true, thumbnailKey: true } },
  stopPhoto: { select: { id: true, storageKey: true, thumbnailKey: true } },
  resetPhoto: { select: { id: true, storageKey: true, thumbnailKey: true } },
} as const;

/** As três seções completas: o que não veio é "Não", como no legado. */
export function respostasDoPap(entrada: PapUpsert['sections'] | unknown): Record<PapSection, PapAnswers> {
  const origem = (entrada ?? {}) as NonNullable<PapUpsert['sections']>;
  return Object.fromEntries(
    PAP_SECTIONS.map((s) => {
      const vindas = origem[s.key]?.answers ?? {};
      const respostas = emptyPapAnswers();
      for (const c of PAP_CRITERIA) {
        respostas[c.key] = { physicalState: vindas[c.key]?.physicalState === true, nr12Compliant: vindas[c.key]?.nr12Compliant === true };
      }
      return [s.key, respostas];
    }),
  ) as Record<PapSection, PapAnswers>;
}

/** O PAP como a API o devolve — no detalhe da análise e na gravação. */
export async function papDto(files: FilesService, p: PapComFotos): Promise<PapDto> {
  const guardadas = p.answers as Partial<Record<PapSection, { [k: string]: unknown }>>;
  const respostas = respostasDoPap(Object.fromEntries(Object.entries(guardadas).map(([s, a]) => [s, { answers: a }])));
  const sections = {} as PapDto['sections'];
  for (const s of PAP_SECTIONS) {
    const arquivo = p[FOTO_DA_SEÇÃO[s.key].relação];
    sections[s.key] = { answers: respostas[s.key], ...(arquivo ? { photo: await foto(files, arquivo) } : {}) };
  }
  return {
    id: p.id,
    number: p.number,
    ...(p.location ? { location: p.location } : {}),
    sections,
    violatedStandardIds: p.violatedStandardIds,
    ...(p.solution ? { solution: p.solution } : {}),
  };
}
