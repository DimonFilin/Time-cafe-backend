import { Module } from '@nestjs/common';
import { CafeAdminController } from './cafe-admin.controller';
import { CafeAdminService } from './cafe-admin.service';
import { CafeAdminWorkersService } from './services/cafe-admin-workers.service';
import { CafeAdminCafeService } from './services/cafe-admin-cafe.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { ActivityLogsModule } from '../activity-logs/activity-logs.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, ActivityLogsModule, AuthModule],
  controllers: [CafeAdminController],
  providers: [CafeAdminService, CafeAdminWorkersService, CafeAdminCafeService],
  exports: [CafeAdminService],
})
export class CafeAdminModule {}
