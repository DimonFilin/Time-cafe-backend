import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { UsersModule } from '../users/users.module';
import { PaymentsModule } from '../payments/payments.module';
import { WorkersModule } from '../workers/workers.module';
import { KeycloakModule } from '../auth/keycloak.module';

@Module({
  imports: [
    PrismaModule,
    UsersModule,
    PaymentsModule,
    WorkersModule,
    KeycloakModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
