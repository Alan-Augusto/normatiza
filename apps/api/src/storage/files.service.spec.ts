import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';

import { FilesService, LOGO_MAX_BYTES } from './files.service';
import { StorageDriver } from './storage.driver';

/** Um storage que só lembra o que recebeu: aqui se testa a decisão, não a rede. */
class StorageFalso implements StorageDriver {
  readonly gravados = new Map<string, { bytes: Buffer; contentType: string }>();
  readonly validades: number[] = [];

  async put(key: string, bytes: Buffer, contentType: string): Promise<void> {
    this.gravados.set(key, { bytes, contentType });
  }

  async signedUrl(key: string, ttlSeconds: number): Promise<string | null> {
    this.validades.push(ttlSeconds);
    return this.gravados.has(key) ? `https://storage.test/${key}?ttl=${ttlSeconds}` : null;
  }
}

/** Só o pedaço do Prisma que o serviço toca. */
function prismaFalso() {
  const linhas: Record<string, unknown>[] = [];
  return {
    linhas,
    fileAsset: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const linha = { id: `file-${linhas.length + 1}`, ...data };
        linhas.push(linha);
        return linha;
      }),
    },
  };
}

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(64),
]);

describe('FilesService — logo da empresa', () => {
  let storage: StorageFalso;
  let prisma: ReturnType<typeof prismaFalso>;
  let files: FilesService;

  const alvo = { accountId: 'conta-normatiza', companyId: 'brf', actorUserId: 'josue' };

  beforeEach(() => {
    storage = new StorageFalso();
    prisma = prismaFalso();
    files = new FilesService(prisma as never, storage);
  });

  it('deve gravar o logo e registrar o arquivo com o tipo lido do conteúdo', async () => {
    const arquivo = await files.uploadCompanyLogo({ ...alvo, bytes: PNG });

    expect(arquivo.mimeType).toBe('image/png');
    expect(arquivo.sizeBytes).toBe(PNG.length);
    expect(storage.gravados.get(arquivo.storageKey)?.contentType).toBe('image/png');
  });

  it('deve guardar o arquivo sob o prefixo da conta e da empresa', async () => {
    // O isolamento por conta é do servidor: o caminho nunca é escolhido por quem envia.
    const arquivo = await files.uploadCompanyLogo({ ...alvo, bytes: PNG });

    expect(arquivo.storageKey).toMatch(/^accounts\/conta-normatiza\/companies\/brf\/logo\//);
  });

  it('deve registrar quem enviou e deixar o logo visível ao cliente', async () => {
    // O logo vai impresso no laudo que o cliente baixa — não é interno da consultoria.
    const arquivo = await files.uploadCompanyLogo({ ...alvo, bytes: PNG });

    expect(arquivo).toMatchObject({
      accountId: 'conta-normatiza',
      companyId: 'brf',
      createdByUserId: 'josue',
      visibility: 'CLIENT_VISIBLE',
    });
  });

  it('deve recusar SVG e qualquer coisa que não seja PNG, JPG ou WebP', async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');

    await expect(files.uploadCompanyLogo({ ...alvo, bytes: svg })).rejects.toThrow(
      BadRequestException,
    );
    expect(storage.gravados.size).toBe(0);
    expect(prisma.linhas).toHaveLength(0);
  });

  it('deve recusar logo acima de 2 MB sem gravar nada', async () => {
    const grande = Buffer.concat([PNG, Buffer.alloc(LOGO_MAX_BYTES)]);

    await expect(files.uploadCompanyLogo({ ...alvo, bytes: grande })).rejects.toThrow(
      PayloadTooLargeException,
    );
    expect(storage.gravados.size).toBe(0);
  });

  it('deve entregar a leitura por URL assinada de validade curta', async () => {
    const arquivo = await files.uploadCompanyLogo({ ...alvo, bytes: PNG });

    const url = await files.readUrl(arquivo);

    expect(url).toContain(arquivo.storageKey);
    expect(storage.validades[0]).toBeLessThanOrEqual(60 * 60);
  });

  it('deve responder sem URL quando o arquivo sumiu do storage, em vez de quebrar a tela', async () => {
    const url = await files.readUrl({ storageKey: 'accounts/x/companies/y/logo/perdido' });

    expect(url).toBeNull();
  });
});
