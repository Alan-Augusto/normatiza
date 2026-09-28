import type SharpDefault from 'sharp';

/**
 * O `sharp`, carregado do jeito que a API roda.
 *
 * A API compila para CommonJS sem `esModuleInterop` (ligá-lo quebraria os
 * `import * as` de módulos que são função, como o supertest). Nessa
 * configuração o TypeScript lê os tipos ESM do pacote, que declaram
 * `export default`, enquanto o `require` devolve a própria função: `import sharp
 * from 'sharp'` compila para `sharp.default` e quebra em tempo de execução.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const carregado = require('sharp') as typeof SharpDefault | { default: typeof SharpDefault };

export const sharp: typeof SharpDefault =
  typeof carregado === 'function' ? carregado : carregado.default;
