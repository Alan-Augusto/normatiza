import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';

import { StorageDriver } from './storage.driver';

export interface FirebaseCredentials {
  projectId: string;
  clientEmail: string;
  privateKey: string;
  bucket: string;
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

  constructor(private readonly credenciais: FirebaseCredentials) {
    super();
    this.app =
      getApps().find((a) => a.name === 'normatiza-storage') ??
      initializeApp(
        {
          credential: cert({
            projectId: credenciais.projectId,
            clientEmail: credenciais.clientEmail,
            // Variável de ambiente não guarda quebra de linha: a chave chega com
            // `\n` literal, e o PEM sem as quebras é recusado pelo SDK.
            privateKey: credenciais.privateKey.replace(/\\n/g, '\n'),
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
