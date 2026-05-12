import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StorageService } from './storage.service';
import { StorageTestController } from './storage-test.controller';
import { AdminStorageController } from './admin-storage.controller';
import { MediaFilesController } from './media-files.controller';
import { WorkersModule } from '../workers/workers.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { KeycloakModule } from '../auth/keycloak.module';

@Module({
  imports: [
    ConfigModule,
    forwardRef(() => WorkersModule),
    PrismaModule,
    KeycloakModule,
  ],
  controllers: [
    StorageTestController,
    AdminStorageController,
    MediaFilesController,
  ],
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
