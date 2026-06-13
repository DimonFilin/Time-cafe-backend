import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { KeycloakModule } from '../auth/keycloak.module';
import { WorkersModule } from '../workers/workers.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { GuestsService } from './guests.service';
import { GuestsController } from './guests.controller';

@Module({
  imports: [PrismaModule, WorkersModule, LoyaltyModule, KeycloakModule],
  controllers: [GuestsController],
  providers: [GuestsService],
  exports: [GuestsService],
})
export class GuestsModule {}
