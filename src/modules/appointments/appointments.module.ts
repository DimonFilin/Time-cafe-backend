import { Module } from '@nestjs/common';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { UsersModule } from '../users/users.module';
import { WorkersModule } from '../workers/workers.module';
import { PaymentsModule } from '../payments/payments.module';
import { KeycloakModule } from '../auth/keycloak.module';
import { ActivityLogsModule } from '../activity-logs/activity-logs.module';
import { CafeRealtimeModule } from '../cafe-realtime/cafe-realtime.module';

@Module({
  imports: [
    PrismaModule,
    UsersModule,
    WorkersModule,
    PaymentsModule,
    KeycloakModule,
    ActivityLogsModule,
    CafeRealtimeModule,
  ],
  controllers: [AppointmentsController],
  providers: [AppointmentsService],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
