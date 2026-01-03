import { Module } from '@nestjs/common';
import { BrandsController } from './brands.controller';
import { BrandsService } from './brands.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { KeycloakModule } from '../auth/keycloak.module';
import { WorkersModule } from '../workers/workers.module';

@Module({
  imports: [PrismaModule, StorageModule, KeycloakModule, WorkersModule],
  controllers: [BrandsController],
  providers: [BrandsService],
  exports: [BrandsService],
})
export class BrandsModule {}
