import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { LocalStorage } from './local.storage';

/**
 * O storage de desenvolvimento: grava em disco para sobreviver a um restart da
 * API, e lê devolvendo o próprio conteúdo como `data:` — sem servidor de
 * arquivo, sem Firebase, e a pré-visualização do logo funciona igual.
 */
describe('LocalStorage', () => {
  let pasta: string;
  let storage: LocalStorage;

  beforeEach(async () => {
    pasta = await mkdtemp(join(tmpdir(), 'normatiza-storage-'));
    storage = new LocalStorage(pasta);
  });

  afterEach(() => rm(pasta, { recursive: true, force: true }));

  it('deve devolver o que foi gravado, com o tipo declarado na gravação', async () => {
    await storage.put('accounts/a/companies/b/logo/1', Buffer.from('conteudo'), 'image/png');

    const url = await storage.signedUrl('accounts/a/companies/b/logo/1', 60);

    expect(url).toBe(`data:image/png;base64,${Buffer.from('conteudo').toString('base64')}`);
  });

  it('deve responder sem URL para chave que não existe', async () => {
    expect(await storage.signedUrl('accounts/a/nada', 60)).toBeNull();
  });

  it('deve recusar chave que tenta sair da pasta do storage', async () => {
    await expect(storage.put('../../etc/passwd', Buffer.from('x'), 'image/png')).rejects.toThrow();
  });
});
