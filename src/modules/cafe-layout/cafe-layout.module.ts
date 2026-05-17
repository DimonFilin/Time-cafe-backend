import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { WorkersModule } from '../workers/workers.module';
import { ActivityLogsModule } from '../activity-logs/activity-logs.module';
import { KeycloakModule } from '../auth/keycloak.module';
import { CafeLayoutController } from './cafe-layout.controller';
import { CafeLayoutService } from './cafe-layout.service';

@Module({
  imports: [PrismaModule, WorkersModule, ActivityLogsModule, KeycloakModule],
  controllers: [CafeLayoutController],
  providers: [CafeLayoutService],
  exports: [CafeLayoutService],
})
export class CafeLayoutModule {}
