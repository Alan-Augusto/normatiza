import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';

import { StorageDriver } from './storage.driver';

/** O Firebase de verdade: conta de serviço, que assina as URLs de leitura. */
export interface FirebaseCredentials {
  projectId: string;
  clientEmail: string;
  privateKey: string;
  bucket: string;
}

/** O Firebase Storage Emulator: sem credencial nenhuma, só onde ele responde. */
export interface FirebaseEmulator {
  projectId: string;
  bucket: string;
  /** Onde a API grava: `host:porta`, como o SDK exige. */
  emulatorHost: string;
  /** Onde o navegador lê. Padrão: o próprio emulador, por HTTP. */
  publicUrl?: string;
}

/**
 * A leitura no emulador. O emulador não confere assinatura e, sem conta de
 * serviço, a API não teria com que assinar — então a URL é a direta, **sem
 * validade**. Aceitável só com dados de demonstração: em produção, o emulador
 * exige opt-in explícito (`STORAGE_EMULATOR_IN_PRODUCTION`).
 */
export function urlDeLeituraNoEmulador(base: string, bucket: string, key: string): string {
  return `${base.replace(/\/+$/, '')}/v0/b/${bucket}/o/${encodeURIComponent(key)}?alt=media`;
}

/**
 * Firebase Storage — o mesmo do acervo legado (docs/produto/05 §4).
 *
 * Só o servidor fala com o bucket, com a conta de serviço. As regras de
 * segurança do Firebase não conhecem nossas sessões nem o `accountId`: se o
 * navegador gravasse direto, o isolamento por conta dependeria de regras
 * escritas em outro lugar, em outra linguagem.
 */
export class FirebaseStorage extends StorageDriver {
  private readonly app: App;

  constructor(private readonly credenciais: FirebaseCredentials | FirebaseEmulator) {
    super();

    if ('emulatorHost' in credenciais) {
      // O SDK lê o endereço do ambiente, e não de uma opção: gravar aqui torna
      // explícito que foi este driver que decidiu falar com o emulador.
      process.env.FIREBASE_STORAGE_EMULATOR_HOST = credenciais.emulatorHost;
    }

    this.app =
      getApps().find((a) => a.name === 'normatiza-storage') ??
      initializeApp(
        {
          ...('emulatorHost' in credenciais
            ? { projectId: credenciais.projectId }
            : {
                credential: cert({
                  projectId: credenciais.projectId,
                  clientEmail: credenciais.clientEmail,
                  // Variável de ambiente não guarda quebra de linha: a chave chega com
                  // `\n` literal, e o PEM sem as quebras é recusado pelo SDK.
                  privateKey: credenciais.privateKey.replace(/\\n/g, '\n'),
                }),
              }),
          storageBucket: credenciais.bucket,
        },
        'normatiza-storage',
      );
  }

  async put(key: string, bytes: Buffer, contentType: string): Promise<void> {
    await this.bucket()
      .file(key)
      .save(bytes, { contentType, resumable: false, metadata: { cacheControl: 'private' } });
  }

  async signedUrl(key: string, ttlSeconds: number): Promise<string | null> {
    const arquivo = this.bucket().file(key);
    const [existe] = await arquivo.exists();
    if (!existe) return null;

    if ('emulatorHost' in this.credenciais) {
      const base = this.credenciais.publicUrl ?? `http://${this.credenciais.emulatorHost}`;
      return urlDeLeituraNoEmulador(base, this.credenciais.bucket, key);
    }

    const [url] = await arquivo.getSignedUrl({
      action: 'read',
      expires: Date.now() + ttlSeconds * 1000,
    });
    return url;
  }

  private bucket() {
    return getStorage(this.app).bucket(this.credenciais.bucket);
  }
}
