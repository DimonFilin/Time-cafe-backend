import { Module, forwardRef } from '@nestjs/common';
import { UsersService } from './users.service';
import { AdminUsersController } from './admin-users.controller';
import { WorkersModule } from '../workers/workers.module';
import { KeycloakModule } from '../auth/keycloak.module';

@Module({
  imports: [forwardRef(() => WorkersModule), KeycloakModule],
  controllers: [AdminUsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
