import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { EnvironmentVariables } from '../config/env.validation';
import { FilesService } from './files.service';
import { FirebaseStorage } from './firebase.storage';
import { LocalStorage } from './local.storage';
import { StorageDriver } from './storage.driver';

/**
 * Global pelo mesmo motivo do e-mail: logo, foto de equipamento, evidência,
 * laudo — todo contexto que guarda arquivo passa por aqui.
 */
@Global()
@Module({
  providers: [
    {
      provide: StorageDriver,
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>): StorageDriver => {
        if (config.get('STORAGE_DRIVER', { infer: true }) === 'firebase') {
          return new FirebaseStorage({
            projectId: config.get('FIREBASE_PROJECT_ID', { infer: true })!,
            clientEmail: config.get('FIREBASE_CLIENT_EMAIL', { infer: true })!,
            privateKey: config.get('FIREBASE_PRIVATE_KEY', { infer: true })!,
            bucket: config.get('FIREBASE_STORAGE_BUCKET', { infer: true })!,
          });
        }

        // A suíte e2e grava logos a cada teste: fora da pasta de desenvolvimento,
        // para não misturar arquivo de teste com o que a pessoa enviou de verdade.
        const pasta =
          config.get('NODE_ENV', { infer: true }) === 'test'
            ? join(tmpdir(), 'normatiza-e2e-storage')
            : config.get('STORAGE_LOCAL_DIR', { infer: true });
        new Logger('StorageModule').log(`Arquivos em disco local: ${pasta}`);
        return new LocalStorage(pasta);
      },
    },
    FilesService,
  ],
  exports: [FilesService],
})
export class StorageModule {}
