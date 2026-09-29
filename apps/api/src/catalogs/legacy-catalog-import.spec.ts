import { ArquivoDeCatalogoInvalido, ordemDoCapitulo, validarArquivo } from './legacy-catalog-import';

/**
 * O arquivo exportado do legado é conferido antes de qualquer gravação
 * (docs/migracao §7). O que se protege: um arquivo torto não entra pela metade,
 * e quem roda o script vê todos os problemas de uma vez.
 */
describe('arquivo de catálogos do legado', () => {
  const capítulo = { tabela: 'standard_title', id: 5, pai_id: null, codigo: null, nome: '12.5 Sistemas de segurança', texto: null };
  const item = { tabela: 'standard', id: 40, pai_id: 5, codigo: '12.5.1', nome: null, texto: 'Conforme item 12.5.1, …' };

  it('deve aceitar o arquivo como o cliente SQL exporta, aparando os textos', () => {
    const [c, i] = validarArquivo([{ ...capítulo, nome: '  12.5 Sistemas de segurança ' }, item]);

    expect(c.nome).toBe('12.5 Sistemas de segurança');
    expect(i).toEqual(item);
  });

  it('deve aceitar ids que vieram como texto, como alguns clientes exportam', () => {
    const [i] = validarArquivo([{ ...item, id: '40', pai_id: '5' }]);

    expect(i.id).toBe(40);
    expect(i.pai_id).toBe(5);
  });

  it('deve juntar todos os problemas numa recusa só', () => {
    const erro = capturar(() =>
      validarArquivo([
        { ...item, codigo: '' },
        { ...capítulo, tabela: 'machine' },
        { ...capítulo, nome: null },
        { ...item, id: 41, pai_id: null },
        capítulo,
        capítulo,
      ]),
    );

    expect(erro.problemas).toEqual([
      'standard:40: item de norma sem código',
      'linha 2: tabela desconhecida "machine"',
      'standard_title:5: sem nome',
      'standard:41: sem pai_id',
      'standard_title:5: repetido no arquivo',
      'standard_title:5: repetido no arquivo',
    ]);
  });

  it('deve recusar o que não é uma lista', () => {
    expect(() => validarArquivo({ linhas: [] })).toThrow(ArquivoDeCatalogoInvalido);
  });
});

describe('ordem dos capítulos da norma', () => {
  it('deve pôr os capítulos pela numeração, e não pela ordem alfabética', () => {
    const nomes = ['12.10 Riscos adicionais', '12.2 Arranjo físico', '12.1 Princípios Gerais'];

    const ordenados = [...nomes].sort((a, b) => ordemDoCapitulo(a, 0) - ordemDoCapitulo(b, 0));

    expect(ordenados).toEqual(['12.1 Princípios Gerais', '12.2 Arranjo físico', '12.10 Riscos adicionais']);
  });

  it('deve pôr os anexos depois de todos os capítulos, pela numeração romana', () => {
    const nomes = ['Anexo XII - Guindar', 'Anexo IX - Injetora', 'Anexo III - Acesso', '12.18 Disposições finais', 'Anexo V - Motosserras'];

    const ordenados = [...nomes].sort((a, b) => ordemDoCapitulo(a, 0) - ordemDoCapitulo(b, 0));

    expect(ordenados).toEqual([
      '12.18 Disposições finais',
      'Anexo III - Acesso',
      'Anexo V - Motosserras',
      'Anexo IX - Injetora',
      'Anexo XII - Guindar',
    ]);
  });

  it('deve pôr no fim, na ordem do legado, o que não segue a numeração', () => {
    expect(ordemDoCapitulo('Glossário', 7)).toBeGreaterThan(ordemDoCapitulo('Anexo XII - Guindar', 0));
    expect(ordemDoCapitulo('Glossário', 7)).toBeLessThan(ordemDoCapitulo('Outro', 9));
  });
});

function capturar(fn: () => unknown): ArquivoDeCatalogoInvalido {
  try {
    fn();
  } catch (erro) {
    if (erro instanceof ArquivoDeCatalogoInvalido) return erro;
    throw erro;
  }
  throw new Error('deveria ter recusado');
}
