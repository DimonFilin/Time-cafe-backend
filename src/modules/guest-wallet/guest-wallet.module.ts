import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../../prisma/prisma.module';
import { KeycloakModule } from '../auth/keycloak.module';
import { WorkersModule } from '../workers/workers.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { GuestsModule } from '../guests/guests.module';
import { GuestWalletService } from './guest-wallet.service';
import { GuestWalletController } from './guest-wallet.controller';
import { LoyaltyAccrualService } from './loyalty-accrual.service';
import { LoyaltyReportsService } from './loyalty-reports.service';
import { LoyaltyReportsController } from './loyalty-reports.controller';
import { UsersWalletController } from './users-wallet.controller';
import { UsersMeController } from './users-me.controller';
import { BrandLoyaltyReportsController } from './brand-loyalty-reports.controller';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    WorkersModule,
    LoyaltyModule,
    GuestsModule,
    KeycloakModule,
  ],
  controllers: [
    GuestWalletController,
    LoyaltyReportsController,
    UsersWalletController,
    UsersMeController,
    BrandLoyaltyReportsController,
  ],
  providers: [GuestWalletService, LoyaltyAccrualService, LoyaltyReportsService],
  exports: [GuestWalletService, LoyaltyReportsService],
})
export class GuestWalletModule {}
