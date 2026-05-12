import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { WorkersModule } from '../workers/workers.module';
import { KeycloakModule } from '../auth/keycloak.module';
import { ActivityLogsModule } from '../activity-logs/activity-logs.module';
import { MenuService } from './menu.service';
import {
  AdminCafeMenuController,
  PublicCafeMenuController,
} from './menu.controller';

@Module({
  imports: [PrismaModule, WorkersModule, KeycloakModule, ActivityLogsModule],
  controllers: [PublicCafeMenuController, AdminCafeMenuController],
  providers: [MenuService],
  exports: [MenuService],
})
export class MenuModule {}
