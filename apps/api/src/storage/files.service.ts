import {
  BadRequestException,
  Injectable,
  PayloadTooLargeException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { PrismaService } from '../prisma/prisma.service';
import { detectImageType } from './image-type';
import { StorageDriver } from './storage.driver';

/** docs/produto/03 §3.2 — o logo vai impresso no laudo; mais que isso é foto, não marca. */
export const LOGO_MAX_BYTES = 2 * 1024 * 1024;

/**
 * Validade da URL de leitura. Curta o bastante para um link vazado morrer
 * sozinho; longa o bastante para uma tela aberta não perder a imagem no meio.
 */
const READ_URL_TTL_SECONDS = 15 * 60;

export interface CompanyLogoUpload {
  accountId: string;
  companyId: string;
  actorUserId: string;
  bytes: Buffer;
}

/**
 * A porta de entrada de todo arquivo. Quem chama decide **de quem** é o
 * arquivo; este serviço decide **se ele entra** e **onde mora** — o caminho no
 * storage nunca é escolhido por quem envia.
 */
@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageDriver,
  ) {}

  async uploadCompanyLogo(upload: CompanyLogoUpload) {
    if (upload.bytes.length > LOGO_MAX_BYTES) {
      throw new PayloadTooLargeException('O logo pode ter no máximo 2 MB.');
    }

    const mimeType = detectImageType(upload.bytes);
    if (!mimeType) {
      throw new BadRequestException('O logo precisa ser uma imagem PNG, JPG ou WebP.');
    }

    const storageKey = `accounts/${upload.accountId}/companies/${upload.companyId}/logo/${randomUUID()}`;
    await this.storage.put(storageKey, upload.bytes, mimeType);

    return this.prisma.fileAsset.create({
      data: {
        accountId: upload.accountId,
        companyId: upload.companyId,
        category: 'COMPANY_LOGO',
        storageKey,
        mimeType,
        sizeBytes: upload.bytes.length,
        visibility: 'CLIENT_VISIBLE',
        createdByUserId: upload.actorUserId,
      },
    });
  }

  readUrl(file: { storageKey: string }): Promise<string | null> {
    return this.storage.signedUrl(file.storageKey, READ_URL_TTL_SECONDS);
  }
}
