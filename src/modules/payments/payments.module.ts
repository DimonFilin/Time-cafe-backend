import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentCardsService } from './services/payment-cards.service';
import { TransactionsService } from './services/transactions.service';
import { BalanceService } from './services/balance.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [PrismaModule, UsersModule],
  controllers: [PaymentsController],
  providers: [PaymentCardsService, TransactionsService, BalanceService],
  exports: [PaymentCardsService, TransactionsService, BalanceService],
})
export class PaymentsModule {}
