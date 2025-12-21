import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { UsersService } from '../../users/users.service';

interface KeycloakEvent {
  type: string;
  realmId: string;
  userId?: string;
  details?: {
    email?: string;
    firstName?: string;
    lastName?: string;
    [key: string]: unknown;
  };
}

@Injectable()
export class KeycloakWebhookService {
  private readonly logger = new Logger(KeycloakWebhookService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly usersService: UsersService,
  ) {}

  async handleUserEvent(event: KeycloakEvent): Promise<void> {
    try {
      switch (event.type) {
        case 'REGISTER':
        case 'UPDATE_PROFILE':
          await this.syncUserFromKeycloak(event.userId, event.realmId);
          break;
        case 'DELETE':
          await this.handleUserDelete(event.userId);
          break;
        default:
          this.logger.debug(`Unhandled event type: ${event.type}`);
      }
    } catch (error: unknown) {
      this.logger.error(`Failed to handle Keycloak event ${event.type}`, error);
      throw error;
    }
  }

  private async syncUserFromKeycloak(
    keycloakId: string | undefined,
    realmId: string,
  ): Promise<void> {
    if (!keycloakId) {
      return;
    }

    const keycloakUrl = process.env.KEYCLOAK_URL || 'http://localhost:8080';
    const adminToken = await this.getAdminToken();

    try {
      interface KeycloakUserResponse {
        id: string;
        email: string;
      }

      const response = await firstValueFrom(
        this.httpService.get<KeycloakUserResponse>(
          `${keycloakUrl}/admin/realms/${realmId}/users/${keycloakId}`,
          {
            headers: {
              Authorization: `Bearer ${adminToken}`,
            },
          },
        ),
      );

      const keycloakUser = response.data;

      await this.usersService.getOrCreateByKeycloakId(
        keycloakUser.id,
        keycloakUser.email,
      );

      this.logger.log(`Synced user ${keycloakId} from Keycloak to Prisma`);
    } catch (error: unknown) {
      this.logger.error(
        `Failed to sync user ${keycloakId} from Keycloak`,
        error,
      );
      throw error;
    }
  }

  private async handleUserDelete(
    keycloakId: string | undefined,
  ): Promise<void> {
    if (!keycloakId) {
      return;
    }

    try {
      const user = await this.usersService.findByKeycloakId(keycloakId);
      if (user) {
        this.logger.log(`User ${keycloakId} deleted from Keycloak`);
      }
    } catch (error: unknown) {
      this.logger.error(`Failed to handle user delete ${keycloakId}`, error);
    }
  }

  private async getAdminToken(): Promise<string> {
    const keycloakUrl = process.env.KEYCLOAK_URL || 'http://localhost:8080';
    const realm = process.env.KEYCLOAK_REALM || 'time-cafe-shared';
    const clientId = process.env.KEYCLOAK_CLIENT_ID || 'backend-shared-api';
    const clientSecret = process.env.KEYCLOAK_CLIENT_SECRET || '';

    try {
      interface TokenResponse {
        access_token: string;
        expires_in: number;
      }

      const response = await firstValueFrom(
        this.httpService.post<TokenResponse>(
          `${keycloakUrl}/realms/${realm}/protocol/openid-connect/token`,
          new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: 'client_credentials',
          }),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          },
        ),
      );

      if (!response.data.access_token) {
        throw new UnauthorizedException(
          'Failed to get admin token from Keycloak',
        );
      }

      return response.data.access_token;
    } catch (error: unknown) {
      this.logger.error('Failed to get admin token', error);
      throw new UnauthorizedException('Failed to authenticate with Keycloak');
    }
  }

  async syncAllUsers(): Promise<void> {
    const keycloakUrl = process.env.KEYCLOAK_URL || 'http://localhost:8080';
    const realm = process.env.KEYCLOAK_REALM || 'time-cafe-shared';
    const adminToken = await this.getAdminToken();

    try {
      interface KeycloakUserResponse {
        id: string;
        email: string;
      }

      const response = await firstValueFrom(
        this.httpService.get<KeycloakUserResponse[]>(
          `${keycloakUrl}/admin/realms/${realm}/users`,
          {
            headers: {
              Authorization: `Bearer ${adminToken}`,
            },
            params: {
              max: 1000,
            },
          },
        ),
      );

      const users = response.data;
      let synced = 0;

      for (const keycloakUser of users) {
        try {
          await this.usersService.getOrCreateByKeycloakId(
            keycloakUser.id,
            keycloakUser.email,
          );
          synced++;
        } catch (error: unknown) {
          this.logger.error(`Failed to sync user ${keycloakUser.id}`, error);
        }
      }

      this.logger.log(`Synced ${synced} users from Keycloak to Prisma`);
    } catch (error: unknown) {
      this.logger.error('Failed to sync all users from Keycloak', error);
      throw error;
    }
  }
}
