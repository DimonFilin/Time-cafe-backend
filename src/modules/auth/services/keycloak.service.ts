import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

interface KeycloakUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  username: string;
  enabled: boolean;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

@Injectable()
export class KeycloakService {
  private readonly logger = new Logger(KeycloakService.name);
  private readonly keycloakUrl: string;
  private readonly realm: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly adminUsername: string | undefined;
  private readonly adminPassword: string | undefined;
  private adminToken: string | null = null;
  private adminTokenExpiry: number = 0;

  constructor(private readonly httpService: HttpService) {
    this.keycloakUrl = process.env.KEYCLOAK_URL || 'http://localhost:8080';
    this.realm = process.env.KEYCLOAK_REALM || 'time-cafe-shared';
    this.clientId = process.env.KEYCLOAK_CLIENT_ID || 'backend-shared-api';
    this.clientSecret = process.env.KEYCLOAK_CLIENT_SECRET || '';
    this.adminUsername = process.env.KEYCLOAK_ADMIN_USERNAME;
    this.adminPassword = process.env.KEYCLOAK_ADMIN_PASSWORD;
  }

  private async getAdminToken(): Promise<string> {
    const now = Date.now();
    if (this.adminToken && now < this.adminTokenExpiry) {
      return this.adminToken;
    }

    try {
      let tokenParams: URLSearchParams;
      let tokenUrl: string;

      if (this.adminUsername && this.adminPassword) {
        // Use master realm with admin-cli for admin credentials
        tokenUrl = `${this.keycloakUrl}/realms/master/protocol/openid-connect/token`;
        tokenParams = new URLSearchParams({
          client_id: 'admin-cli',
          grant_type: 'password',
          username: this.adminUsername,
          password: this.adminPassword,
        });
      } else {
        // Use configured realm with client credentials
        tokenUrl = `${this.keycloakUrl}/realms/${this.realm}/protocol/openid-connect/token`;
        tokenParams = new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'client_credentials',
        });
      }

      const response = await firstValueFrom(
        this.httpService.post<TokenResponse>(tokenUrl, tokenParams, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }),
      );

      this.adminToken = response.data.access_token;
      this.adminTokenExpiry = now + (response.data.expires_in - 60) * 1000;

      if (!this.adminToken) {
        throw new UnauthorizedException(
          'Failed to get admin token from Keycloak',
        );
      }

      const decodedToken = this.decodeToken(this.adminToken);
      if (decodedToken) {
        this.logger.debug(
          `Admin token roles: ${JSON.stringify(decodedToken.realm_access?.roles || [])}`,
        );
        this.logger.debug(
          `Resource access: ${JSON.stringify(decodedToken.resource_access || {})}`,
        );
      }

      return this.adminToken;
    } catch (error: unknown) {
      this.logger.error('Failed to get admin token', error);
      throw new UnauthorizedException('Failed to authenticate with Keycloak');
    }
  }

  async createUser(email: string, password: string): Promise<string> {
    const token = await this.getAdminToken();

    try {
      const userData = {
        email,
        username: email,
        enabled: true,
        emailVerified: true,
        requiredActions: [],
        credentials: [
          {
            type: 'password',
            value: password,
            temporary: false,
          },
        ],
      };

      const response = await firstValueFrom(
        this.httpService.post<unknown>(
          `${this.keycloakUrl}/admin/realms/${this.realm}/users`,
          userData,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      const location: string | string[] | undefined = response.headers
        .location as string | string[] | undefined;
      if (!location) {
        throw new Error('Keycloak did not return user ID');
      }

      const locationString: string =
        typeof location === 'string'
          ? location
          : Array.isArray(location)
            ? (location[0] ?? '')
            : String(location);

      if (!locationString) {
        throw new Error('Keycloak did not return user ID');
      }

      const userId: string | undefined = locationString.split('/').pop();
      if (!userId) {
        throw new Error('Failed to extract user ID from Keycloak response');
      }

      await this.clearRequiredActions(userId, token);

      this.logger.log(`User created in Keycloak: ${userId}`);
      return userId;
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as {
          response?: { status?: number; data?: unknown };
        };
        if (axiosError.response?.status === 409) {
          throw new Error('User with this email already exists');
        }
        this.logger.error('Keycloak API error', axiosError.response?.data);
      }
      this.logger.error('Failed to create user in Keycloak', error);
      throw new Error('Failed to create user in Keycloak');
    }
  }

  async validateCredentials(
    email: string,
    password: string,
  ): Promise<TokenResponse> {
    try {
      const response = await firstValueFrom(
        this.httpService.post<TokenResponse>(
          `${this.keycloakUrl}/realms/${this.realm}/protocol/openid-connect/token`,
          new URLSearchParams({
            client_id: this.clientId,
            client_secret: this.clientSecret,
            grant_type: 'password',
            username: email,
            password: password,
          }),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          },
        ),
      );

      return {
        access_token: response.data.access_token,
        refresh_token: response.data.refresh_token,
        expires_in: response.data.expires_in,
        token_type: response.data.token_type,
      };
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as {
          response?: { status?: number; data?: { error_description?: string } };
        };
        if (axiosError.response?.status === 401) {
          throw new UnauthorizedException('Invalid credentials');
        }
        if (
          axiosError.response?.status === 400 &&
          axiosError.response?.data?.error_description?.includes(
            'Account is not fully set up',
          )
        ) {
          throw new UnauthorizedException('Account is not fully set up');
        }
      }
      this.logger.error('Failed to validate credentials', error);
      throw new UnauthorizedException('Failed to authenticate');
    }
  }

  async refreshToken(refreshToken: string): Promise<TokenResponse> {
    try {
      const response = await firstValueFrom(
        this.httpService.post<TokenResponse>(
          `${this.keycloakUrl}/realms/${this.realm}/protocol/openid-connect/token`,
          new URLSearchParams({
            client_id: this.clientId,
            client_secret: this.clientSecret,
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
          }),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          },
        ),
      );

      return {
        access_token: response.data.access_token,
        refresh_token: response.data.refresh_token || refreshToken,
        expires_in: response.data.expires_in,
        token_type: response.data.token_type,
      };
    } catch (error: unknown) {
      this.logger.error('Failed to refresh token', error);
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async getUserByKeycloakId(keycloakId: string): Promise<KeycloakUser | null> {
    const token = await this.getAdminToken();

    try {
      const response = await firstValueFrom(
        this.httpService.get<KeycloakUser>(
          `${this.keycloakUrl}/admin/realms/${this.realm}/users/${keycloakId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        ),
      );

      return {
        id: response.data.id,
        email: response.data.email,
        firstName: response.data.firstName,
        lastName: response.data.lastName,
        username: response.data.username,
        enabled: response.data.enabled,
      };
    } catch (error: unknown) {
      this.logger.error(
        `Failed to get user ${keycloakId} from Keycloak`,
        error,
      );
      return null;
    }
  }

  async getUserByEmail(email: string): Promise<KeycloakUser | null> {
    const token = await this.getAdminToken();

    try {
      const response = await firstValueFrom(
        this.httpService.get<KeycloakUser[]>(
          `${this.keycloakUrl}/admin/realms/${this.realm}/users`,
          {
            params: {
              email: email,
              exact: true,
            },
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        ),
      );

      if (response.data && response.data.length > 0) {
        const user = response.data[0];
        return {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          username: user.username,
          enabled: user.enabled,
        };
      }

      return null;
    } catch (error: unknown) {
      this.logger.error(
        `Failed to get user by email ${email} from Keycloak`,
        error,
      );
      return null;
    }
  }

  private async clearRequiredActions(
    userId: string,
    adminToken: string,
  ): Promise<void> {
    try {
      await firstValueFrom(
        this.httpService.put(
          `${this.keycloakUrl}/admin/realms/${this.realm}/users/${userId}`,
          {
            requiredActions: [],
          },
          {
            headers: {
              Authorization: `Bearer ${adminToken}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );
      this.logger.debug(`Cleared required actions for user ${userId}`);
    } catch (error: unknown) {
      this.logger.warn(
        `Failed to clear required actions for user ${userId}`,
        error,
      );
    }
  }

  async resetPassword(
    keycloakId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.getUserByKeycloakId(keycloakId);
    if (!user) {
      throw new UnauthorizedException('User not found in Keycloak');
    }

    try {
      await this.validateCredentials(user.email, currentPassword);
    } catch {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const token = await this.getAdminToken();

    try {
      await firstValueFrom(
        this.httpService.put(
          `${this.keycloakUrl}/admin/realms/${this.realm}/users/${keycloakId}/reset-password`,
          {
            type: 'password',
            value: newPassword,
            temporary: false,
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );
      this.logger.log(`Password reset for user ${keycloakId}`);
    } catch (error: unknown) {
      this.logger.error('Failed to reset password in Keycloak', error);
      throw new UnauthorizedException('Failed to reset password');
    }
  }

  async deleteUser(keycloakId: string): Promise<void> {
    const token = await this.getAdminToken();

    try {
      await firstValueFrom(
        this.httpService.delete(
          `${this.keycloakUrl}/admin/realms/${this.realm}/users/${keycloakId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        ),
      );
      this.logger.log(`User ${keycloakId} deleted from Keycloak`);
    } catch (error: unknown) {
      this.logger.error(
        `Failed to delete user ${keycloakId} from Keycloak`,
        error,
      );
      throw new UnauthorizedException('Failed to delete user from Keycloak');
    }
  }

  private decodeToken(token: string): {
    sub?: string;
    realm_access?: { roles?: string[] };
    resource_access?: Record<string, { roles?: string[] }>;
    [key: string]: unknown;
  } | null {
    try {
      const base64Url = token.split('.')[1];
      if (!base64Url) {
        return null;
      }
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = Buffer.from(base64, 'base64').toString('utf-8');
      return JSON.parse(jsonPayload) as {
        sub?: string;
        realm_access?: { roles?: string[] };
        resource_access?: Record<string, { roles?: string[] }>;
        [key: string]: unknown;
      };
    } catch {
      return null;
    }
  }
}
