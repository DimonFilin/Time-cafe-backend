import { Module } from '@nestjs/common';
import { RegionsService } from './regions.service';
import { RegionsController } from './regions.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { WorkersModule } from '../workers/workers.module';
import { KeycloakModule } from '../auth/keycloak.module';

@Module({
  imports: [PrismaModule, WorkersModule, KeycloakModule],
  controllers: [RegionsController],
  providers: [RegionsService],
  exports: [RegionsService],
})
export class RegionsModule {}
