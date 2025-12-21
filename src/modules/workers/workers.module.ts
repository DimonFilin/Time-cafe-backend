import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { WorkersService } from './workers.service';
import { WorkersController } from './workers.controller';
import { KeycloakModule } from '../auth/keycloak.module';
import { KeycloakService } from '../auth/services/keycloak.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [KeycloakModule, HttpModule, UsersModule],
  controllers: [WorkersController],
  providers: [WorkersService, KeycloakService],
  exports: [WorkersService],
})
export class WorkersModule {}
