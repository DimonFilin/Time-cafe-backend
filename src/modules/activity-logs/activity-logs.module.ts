import { Module, forwardRef } from '@nestjs/common';
import { ActivityLogsService } from './activity-logs.service';
import { ActivityLogsController } from './activity-logs.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { WorkersModule } from '../workers/workers.module';
import { KeycloakModule } from '../auth/keycloak.module';

@Module({
  imports: [PrismaModule, KeycloakModule, forwardRef(() => WorkersModule)],
  controllers: [ActivityLogsController],
  providers: [ActivityLogsService],
  exports: [ActivityLogsService], // Экспортируем для использования в других модулях
})
export class ActivityLogsModule {}
