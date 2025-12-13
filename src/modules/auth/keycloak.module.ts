import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import {
  KeycloakConnectModule,
  AuthGuard,
  ResourceGuard,
  RoleGuard,
  PolicyEnforcementMode,
  TokenValidation,
} from 'nest-keycloak-connect';

@Module({
  imports: [
    KeycloakConnectModule.registerAsync({
      useFactory: () => ({
        authServerUrl: process.env.KEYCLOAK_URL || 'http://localhost:8080',
        realm: process.env.KEYCLOAK_REALM || 'master',
        clientId: process.env.KEYCLOAK_CLIENT_ID || 'backend-shared-api',
        secret: process.env.KEYCLOAK_CLIENT_SECRET || '',
        cookieKey: 'KEYCLOAK_JWT',
        logLevels: ['warn'],
        useNestLogger: true,
        policyEnforcement: PolicyEnforcementMode.PERMISSIVE,
        tokenValidation: TokenValidation.ONLINE,
      }),
    }),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ResourceGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RoleGuard,
    },
  ],
  exports: [KeycloakConnectModule],
})
export class KeycloakModule {}
