import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';

import { StorageDriver } from './storage.driver';

/**
 * Storage de desenvolvimento e de teste: disco local.
 *
 * Em disco, e não em memória, para o logo sobreviver a um restart da API — a
 * linha em `FileAsset` sobrevive, e um arquivo que some a cada `nest start
 * --watch` faria o desenvolvimento parecer quebrado.
 *
 * A leitura devolve o conteúdo como `data:`. Não há servidor de arquivo para
 * assinar URL, e o navegador exibe `data:` igual a um endereço. O preço é o
 * arquivo viajar inteiro dentro do JSON — aceitável para um logo de 2 MB, não
 * para o acervo de fotos. Produção usa `STORAGE_DRIVER=firebase`.
 */
export class LocalStorage extends StorageDriver {
  private readonly raiz: string;
  private readonly tipos = new Map<string, string>();

  constructor(pasta: string) {
    super();
    this.raiz = resolve(pasta);
  }

  async put(key: string, bytes: Buffer, contentType: string): Promise<void> {
    const caminho = this.caminhoDe(key);
    await mkdir(dirname(caminho), { recursive: true });
    await writeFile(caminho, bytes);
    await writeFile(`${caminho}.type`, contentType);
    this.tipos.set(key, contentType);
  }

  /** Sem servidor para assinar, a validade não se aplica: o `data:` é o próprio conteúdo. */
  async signedUrl(key: string, _ttlSeconds?: number): Promise<string | null> {
    const caminho = this.caminhoDe(key);
    try {
      const [bytes, tipo] = await Promise.all([
        readFile(caminho),
        this.tipos.get(key) ?? readFile(`${caminho}.type`, 'utf8'),
      ]);
      return `data:${tipo};base64,${bytes.toString('base64')}`;
    } catch {
      return null;
    }
  }

  /** A chave nunca escapa da pasta: `../` numa chave seria escrita arbitrária em disco. */
  private caminhoDe(key: string): string {
    const caminho = resolve(join(this.raiz, key));
    if (!caminho.startsWith(this.raiz + sep)) {
      throw new Error(`Chave de storage fora da pasta: ${key}`);
    }
    return caminho;
  }
}
