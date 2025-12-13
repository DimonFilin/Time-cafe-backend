import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { KeycloakModule } from './keycloak.module';
import { AuthTestController } from './auth-test.controller';

@Module({
  imports: [KeycloakModule, HttpModule],
  controllers: [AuthTestController],
  providers: [],
  exports: [KeycloakModule],
})
export class AuthModule {}
