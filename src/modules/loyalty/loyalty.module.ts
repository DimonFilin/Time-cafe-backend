import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { KeycloakModule } from '../auth/keycloak.module';
import { WorkersModule } from '../workers/workers.module';
import { LoyaltyService } from './loyalty.service';
import { LoyaltyController } from './loyalty.controller';
import { LoyaltyStaffController } from './loyalty-staff.controller';
import { BrandLoyaltySettingsController } from './brand-loyalty-settings.controller';

@Module({
  imports: [PrismaModule, WorkersModule, KeycloakModule],
  controllers: [
    LoyaltyController,
    LoyaltyStaffController,
    BrandLoyaltySettingsController,
  ],
  providers: [LoyaltyService],
  exports: [LoyaltyService],
})
export class LoyaltyModule {}
