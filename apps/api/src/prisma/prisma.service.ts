import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

import { EnvironmentVariables, Environment } from '../config/env.validation';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    const isTest = config.get('NODE_ENV', { infer: true }) === Environment.Test;
    const url = isTest
      ? config.get('TEST_DATABASE_URL', { infer: true })
      : config.get('DATABASE_URL', { infer: true });

    super({ datasources: { db: { url } } });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Conectado ao banco.');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
