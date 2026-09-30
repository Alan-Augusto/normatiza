import type { RiskPoint } from '@prisma/client';
import type { RecognitionPhoto, RiskPointDto } from '@normatiza/shared';

import { FilesService } from '../storage/files.service';

/**
 * O ponto de risco como a API o devolve — no detalhe da análise e na gravação
 * do ponto. Arquivo à parte para os dois serviços o usarem sem se importarem
 * um ao outro.
 */

export type PontoComFoto = RiskPoint & { hazardPhoto: { id: string; storageKey: string; thumbnailKey: string | null } | null };

/** O ponto como a API o devolve. Usado também no detalhe da análise. */
export async function pontoDto(files: FilesService, p: PontoComFoto): Promise<RiskPointDto> {
  const temHrn = p.hrnFe !== null && p.hrnPe !== null && p.hrnMpl !== null && p.hrnNp !== null && p.hrnResult !== null && p.hrnLevel !== null;
  return {
    id: p.id,
    number: p.number,
    ...(p.location ? { location: p.location } : {}),
    hazardOriginIds: p.hazardOriginIds,
    hazardConsequenceIds: p.hazardConsequenceIds,
    existingProtectionIds: p.existingProtectionIds,
    violatedStandardIds: p.violatedStandardIds,
    ...(temHrn
      ? { currentHrn: { fe: p.hrnFe!, pe: p.hrnPe!, mpl: p.hrnMpl!, np: p.hrnNp!, result: p.hrnResult!, level: p.hrnLevel! } }
      : {}),
    ...(p.safetyCategory !== null && p.safetySeverity !== null
      ? {
          safetyCategory: {
            severity: p.safetySeverity as 1 | 2,
            ...(p.safetyFrequency !== null ? { frequency: p.safetyFrequency as 1 | 2 } : {}),
            ...(p.safetyPossibility !== null ? { possibility: p.safetyPossibility as 1 | 2 } : {}),
            category: p.safetyCategory as 1 | 2 | 3 | 4,
          },
        }
      : {}),
    ...(p.suggestedSolution ? { suggestedSolution: p.suggestedSolution } : {}),
    ...(p.hazardPhoto ? { photo: await foto(files, p.hazardPhoto) } : {}),
  };
}

export async function foto(files: FilesService, arquivo: { storageKey: string; thumbnailKey: string | null }): Promise<RecognitionPhoto> {
  return { url: (await files.readUrl(arquivo)) ?? '', thumbnailUrl: (await files.readThumbnailUrl(arquivo)) ?? '' };
}

