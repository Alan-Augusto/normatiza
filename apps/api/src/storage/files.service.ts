import {
  BadRequestException,
  Injectable,
  PayloadTooLargeException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { sharp } from './sharp';

import { PrismaService } from '../prisma/prisma.service';
import { detectImageType } from './image-type';
import { StorageDriver } from './storage.driver';

/** docs/produto/03 §3.2 — o logo vai impresso no laudo; mais que isso é foto, não marca. */
export const LOGO_MAX_BYTES = 2 * 1024 * 1024;

/** Uma foto de celular com folga. A compressão antes do envio é do app de campo. */
export const EQUIPMENT_PHOTO_MAX_BYTES = 10 * 1024 * 1024;

/** O maior lado da miniatura: nítida num cartão da lista, leve numa tela com centenas. */
const THUMBNAIL_MAX_SIDE = 480;

/**
 * Validade da URL de leitura. Curta o bastante para um link vazado morrer
 * sozinho; longa o bastante para uma tela aberta não perder a imagem no meio.
 */
const READ_URL_TTL_SECONDS = 15 * 60;

export interface EquipmentPhotoUpload {
  accountId: string;
  companyId: string;
  equipmentId: string;
  actorUserId: string;
  bytes: Buffer;
}

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

  /**
   * A foto principal do equipamento (docs/produto/05 §4). O **original fica
   * intacto** — é ele que entra no laudo — e ao lado dele nasce a miniatura
   * WebP que as listas carregam. Decodificar para gerar a miniatura é também a
   * prova de que o conteúdo é imagem: a assinatura nos primeiros bytes não basta.
   */
  async uploadEquipmentPhoto(upload: EquipmentPhotoUpload) {
    if (upload.bytes.length > EQUIPMENT_PHOTO_MAX_BYTES) {
      throw new PayloadTooLargeException('A foto pode ter no máximo 10 MB.');
    }

    const mimeType = detectImageType(upload.bytes);
    if (!mimeType) {
      throw new BadRequestException('A foto precisa ser uma imagem PNG, JPG ou WebP.');
    }

    let miniatura: Buffer;
    try {
      miniatura = await sharp(upload.bytes)
        // A orientação da câmera vem no EXIF; sem aplicá-la, a foto de celular
        // aparece deitada na lista.
        .rotate()
        .resize(THUMBNAIL_MAX_SIDE, THUMBNAIL_MAX_SIDE, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 75 })
        .toBuffer();
    } catch {
      throw new BadRequestException('Não foi possível ler esta imagem. Confira o arquivo e envie de novo.');
    }

    const base = `accounts/${upload.accountId}/companies/${upload.companyId}/equipments/${upload.equipmentId}/main/${randomUUID()}`;
    const thumbnailKey = `${base}-thumb`;
    await this.storage.put(base, upload.bytes, mimeType);
    await this.storage.put(thumbnailKey, miniatura, 'image/webp');

    return this.prisma.fileAsset.create({
      data: {
        accountId: upload.accountId,
        companyId: upload.companyId,
        equipmentId: upload.equipmentId,
        category: 'EQUIPMENT_MAIN_PHOTO',
        storageKey: base,
        thumbnailKey,
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

  /** A miniatura, para listas; o original quando o arquivo não tem uma (logo). */
  readThumbnailUrl(file: { storageKey: string; thumbnailKey: string | null }): Promise<string | null> {
    return this.storage.signedUrl(file.thumbnailKey ?? file.storageKey, READ_URL_TTL_SECONDS);
  }

  /**
   * Um arquivo que deixou de ser usado — o logo trocado, a foto substituída.
   * O registro sai primeiro: um byte órfão no bucket é só espaço; um registro
   * apontando para byte apagado seria imagem quebrada na tela.
   */
  async remove(file: { id: string; storageKey: string; thumbnailKey: string | null }): Promise<void> {
    await this.prisma.fileAsset.delete({ where: { id: file.id } });
    await Promise.all(
      [file.storageKey, file.thumbnailKey].filter((k): k is string => !!k).map((k) => this.storage.delete(k)),
    );
  }
}
