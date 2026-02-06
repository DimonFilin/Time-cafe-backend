import { Module, forwardRef } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { WorkersService } from './workers.service';
import {
  WorkersController,
  AdminWorkersController,
} from './workers.controller';
import { KeycloakModule } from '../auth/keycloak.module';
import { KeycloakService } from '../auth/services/keycloak.service';
import { UsersModule } from '../users/users.module';
import { AuthModule } from '../auth/auth.module';
import { ActivityLogsModule } from '../activity-logs/activity-logs.module';

@Module({
  imports: [
    KeycloakModule,
    HttpModule,
    forwardRef(() => UsersModule),
    forwardRef(() => AuthModule),
    ActivityLogsModule,
  ],
  controllers: [WorkersController, AdminWorkersController],
  providers: [WorkersService, KeycloakService],
  exports: [WorkersService],
})
export class WorkersModule {}
