import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { AdminTransactionsController } from './admin-transactions.controller';
import { PaymentCardsService } from './services/payment-cards.service';
import { TransactionsService } from './services/transactions.service';
import { BalanceService } from './services/balance.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { UsersModule } from '../users/users.module';
import { WorkersModule } from '../workers/workers.module';
import { KeycloakModule } from '../auth/keycloak.module';
import { ActivityLogsModule } from '../activity-logs/activity-logs.module';

@Module({
  imports: [
    PrismaModule,
    UsersModule,
    WorkersModule,
    KeycloakModule,
    ActivityLogsModule,
  ],
  controllers: [PaymentsController, AdminTransactionsController],
  providers: [PaymentCardsService, TransactionsService, BalanceService],
  exports: [PaymentCardsService, TransactionsService, BalanceService],
})
export class PaymentsModule {}
