import { Module, forwardRef } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { KeycloakModule } from './keycloak.module';
import { AuthTestController } from './auth-test.controller';
import { AuthController } from './auth.controller';
import { KeycloakWebhookController } from './controllers/keycloak-webhook.controller';
import { KeycloakService } from './services/keycloak.service';
import { AuthService } from './services/auth.service';
import { KeycloakWebhookService } from './services/keycloak-webhook.service';
import { UsersModule } from '../users/users.module';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [
    KeycloakModule,
    HttpModule,
    forwardRef(() => UsersModule),
    PrismaModule,
  ],
  controllers: [AuthController, AuthTestController, KeycloakWebhookController],
  providers: [KeycloakService, AuthService, KeycloakWebhookService],
  exports: [
    KeycloakModule,
    KeycloakService,
    AuthService,
    KeycloakWebhookService,
  ],
})
export class AuthModule {}
