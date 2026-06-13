import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { KeycloakModule } from '../auth/keycloak.module';
import { WorkersModule } from '../workers/workers.module';
import { GuestsModule } from '../guests/guests.module';
import { ReceptionController } from './reception.controller';
import { ReceptionService } from './reception.service';

@Module({
  imports: [PrismaModule, WorkersModule, GuestsModule, KeycloakModule],
  controllers: [ReceptionController],
  providers: [ReceptionService],
})
export class ReceptionModule {}
