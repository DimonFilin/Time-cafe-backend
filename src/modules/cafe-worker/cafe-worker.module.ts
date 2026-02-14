import { Module } from '@nestjs/common';
import { CafeWorkerController } from './cafe-worker.controller';
import { CafeWorkerService } from './cafe-worker.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { ActivityLogsModule } from '../activity-logs/activity-logs.module';
import { KeycloakModule } from '../auth/keycloak.module';

@Module({
  imports: [PrismaModule, ActivityLogsModule, KeycloakModule],
  controllers: [CafeWorkerController],
  providers: [CafeWorkerService],
  exports: [CafeWorkerService],
})
export class CafeWorkerModule {}
