import { Global, Module } from '@nestjs/common';

import { MailService } from './mail.service';

/**
 * Global porque o envio é transversal: convite, recuperação de senha e o que
 * vier depois. Um módulo a ser importado em cada lugar seria cerimônia sem ganho.
 */
@Global()
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
