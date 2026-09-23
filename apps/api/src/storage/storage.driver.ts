/**
 * Onde os bytes moram. O resto da API não sabe se é disco ou Firebase — sabe
 * gravar por chave e pedir uma URL de leitura.
 *
 * É classe abstrata, e não `interface`, porque serve também de **token de
 * injeção** do Nest: uma interface some na compilação e não sobra nada para o
 * container resolver.
 */
export abstract class StorageDriver {
  abstract put(key: string, bytes: Buffer, contentType: string): Promise<void>;

  /**
   * URL de leitura que expira sozinha. `null` quando a chave não existe — o
   * arquivo sumido é defeito a registrar, não motivo para derrubar a tela.
   */
  abstract signedUrl(key: string, ttlSeconds: number): Promise<string | null>;
}
