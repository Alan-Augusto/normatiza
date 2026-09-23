export type ImageMimeType = 'image/png' | 'image/jpeg' | 'image/webp';

/**
 * O tipo de uma imagem, lido da assinatura nos primeiros bytes.
 *
 * Nunca da extensão nem do `Content-Type` da requisição: os dois são escritos
 * por quem envia. Um `.png` que é HTML por dentro, servido de volta por URL
 * assinada, vira página executando no domínio do storage.
 *
 * SVG não tem assinatura binária e **não é aceito** de propósito: é XML, pode
 * carregar `<script>`, e o gerador de laudo lida mal com ele.
 */
export function detectImageType(bytes: Buffer): ImageMimeType | null {
  if (bytes.length < 12) return null;

  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }

  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';

  // RIFF é um contêiner: WAV e AVI também começam assim. O que o faz WebP é o
  // "WEBP" nos bytes 8–11.
  if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') {
    return 'image/webp';
  }

  return null;
}
