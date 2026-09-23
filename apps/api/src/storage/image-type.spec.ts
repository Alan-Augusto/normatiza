import { detectImageType } from './image-type';

/**
 * O tipo do arquivo é decidido pelo **conteúdo**, nunca pela extensão nem pelo
 * `Content-Type` que o navegador declara — os dois são escritos por quem envia.
 * Regra em docs/produto/05_regras_transversais.md §4.
 */
describe('Detecção do tipo de imagem pelo conteúdo', () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 0]);
  const webp = Buffer.concat([
    Buffer.from('RIFF'),
    Buffer.from([0x24, 0, 0, 0]),
    Buffer.from('WEBPVP8 '),
  ]);

  it('deve reconhecer PNG, JPEG e WebP', () => {
    expect(detectImageType(png)).toBe('image/png');
    expect(detectImageType(jpeg)).toBe('image/jpeg');
    expect(detectImageType(webp)).toBe('image/webp');
  });

  it('deve recusar SVG, mesmo sendo imagem — ele pode carregar script', () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

    expect(detectImageType(svg)).toBeNull();
  });

  it('deve recusar um HTML disfarçado de imagem', () => {
    expect(detectImageType(Buffer.from('<!doctype html><html></html>'))).toBeNull();
  });

  it('deve recusar um RIFF que não é WebP', () => {
    const wav = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WAVE')]);

    expect(detectImageType(wav)).toBeNull();
  });

  it('deve recusar arquivo vazio ou curto demais para ter assinatura', () => {
    expect(detectImageType(Buffer.alloc(0))).toBeNull();
    expect(detectImageType(Buffer.from([0x89, 0x50]))).toBeNull();
  });
});
