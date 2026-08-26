import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { AuthorizationModule } from './authorization/authorization.module';
import { validate } from './config/env.validation';
import { InvitationsModule } from './invitations/invitations.module';
import { PlatformModule } from './platform/platform.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate,
    }),
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60_000, limit: 120 }],
      // A suíte e2e faz dezenas de logins em segundos e tropeçaria no limite.
      // A alternativa — limites frouxos o bastante para os testes passarem —
      // seria pior: o limite existiria só no papel. O bloqueio de verdade é
      // exercitado por `test/rate-limit.e2e-spec.ts`, que liga isto de volta.
      skipIf: () => process.env.THROTTLE_DISABLED === 'true',
    }),
    PrismaModule,
    AuditModule,
    AuthorizationModule,
    AuthModule,
    InvitationsModule,
    PlatformModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
