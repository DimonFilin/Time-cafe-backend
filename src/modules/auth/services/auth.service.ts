import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { KeycloakService } from './keycloak.service';
import { UsersService } from '../../users/users.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { AuthResponseDto } from '../dto/auth-response.dto';
import { UserProfileDto } from '../dto/user-profile.dto';
import { LoginLookupDto } from '../dto/login-lookup.dto';
import { LoginSelectDto } from '../dto/login-select.dto';
import { LoginLookupResponseDto } from '../dto/login-lookup-response.dto';
import { AccountInfoDto } from '../dto/account-info.dto';
import { MeResponseDto } from '../dto/me-response.dto';
import {
  WorkerRole,
  ActivityAction,
  ActivityCategory,
  LogSeverity,
} from '@prisma/client';
import { ActivityLogsService } from '../../activity-logs/activity-logs.service';

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly keycloakService: KeycloakService,
    private readonly usersService: UsersService,
    private readonly prisma: PrismaService,
    private readonly activityLogsService: ActivityLogsService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const keycloakUser = await this.keycloakService.getUserByEmail(dto.email);
    if (keycloakUser) {
      throw new ConflictException(
        'User with this email already exists in Keycloak',
      );
    }

    const existingUser = await this.usersService.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    try {
      const keycloakId = await this.keycloakService.createUser(
        dto.email,
        dto.password,
      );

      const user = await this.usersService.create({
        keycloakId,
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
      });

      let tokens: TokenResponse | undefined;
      let retries = 10;
      let delay = 300;

      while (retries > 0) {
        try {
          tokens = await this.keycloakService.validateCredentials(
            dto.email,
            dto.password,
          );
          break;
        } catch {
          retries--;
          if (retries === 0) {
            this.logger.warn(
              `Failed to login after registration after 10 attempts, user created: ${keycloakId}`,
            );
            throw new ConflictException(
              'User created but login failed. Please try logging in manually.',
            );
          }
          this.logger.debug(
            `Retry login attempt ${10 - retries}/10, waiting ${delay}ms`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay = Math.min(delay * 1.3, 2000);
        }
      }

      if (!tokens) {
        throw new ConflictException(
          'User created but login failed. Please try logging in manually.',
        );
      }

      return {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresIn: tokens.expires_in,
        user: this.mapToUserProfile(user),
      };
    } catch (error: unknown) {
      this.logger.error('Registration failed', error);
      if (error instanceof ConflictException) {
        throw error;
      }
      throw new ConflictException('Failed to register user');
    }
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    try {
      const tokens: TokenResponse =
        await this.keycloakService.validateCredentials(dto.email, dto.password);

      const decodedToken = this.decodeToken(tokens.access_token);
      if (!decodedToken || !decodedToken.sub) {
        throw new UnauthorizedException('Invalid token');
      }

      const keycloakId = decodedToken.sub;
      const keycloakUser =
        await this.keycloakService.getUserByKeycloakId(keycloakId);
      if (!keycloakUser) {
        throw new UnauthorizedException('User not found in Keycloak');
      }

      const user = await this.usersService.getOrCreateByKeycloakId(
        keycloakId,
        keycloakUser.email,
      );

      return {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresIn: tokens.expires_in,
        user: this.mapToUserProfile(user),
      };
    } catch (error: unknown) {
      this.logger.error('Login failed', error);
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid credentials');
    }
  }

  async refreshToken(refreshToken: string): Promise<AuthResponseDto> {
    try {
      this.logger.debug('Starting token refresh...');
      const tokens: TokenResponse =
        await this.keycloakService.refreshToken(refreshToken);

      this.logger.debug('Token refreshed from Keycloak successfully');

      const decodedToken = this.decodeToken(tokens.access_token);
      if (!decodedToken || !decodedToken.sub) {
        this.logger.error('Invalid token: no sub claim');
        throw new UnauthorizedException('Invalid token');
      }

      const keycloakId = decodedToken.sub;
      this.logger.debug(`Looking up account with keycloakId: ${keycloakId}`);

      // Try to find User first
      const user = await this.usersService.findByKeycloakId(keycloakId);

      if (user) {
        this.logger.debug(`User found: ${user.id}, email: ${user.email}`);
        return {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresIn: tokens.expires_in,
          user: this.mapToUserProfile(user),
        };
      }

      // If not found in User, try WorkerAccount
      this.logger.debug('User not found, checking WorkerAccount...');
      const workerAccount = await this.prisma.workerAccount.findFirst({
        where: {
          keycloakId,
          deletedAt: null,
        },
        include: {
          brand: true,
          cafe: true,
        },
      });

      if (workerAccount) {
        this.logger.debug(
          `WorkerAccount found: ${workerAccount.id}, email: ${workerAccount.email}, role: ${workerAccount.role}`,
        );
        return {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresIn: tokens.expires_in,
          user: this.mapWorkerToProfile(workerAccount),
        };
      }

      // Neither User nor WorkerAccount found
      this.logger.error(
        `Account not found in database for keycloakId: ${keycloakId}. Token claims: ${JSON.stringify(
          {
            sub: decodedToken.sub,
            email: decodedToken.email,
            preferred_username: decodedToken.preferred_username,
          },
        )}`,
      );
      throw new UnauthorizedException('User not found');
    } catch (error: unknown) {
      this.logger.error('Token refresh failed', error);
      // Re-throw if it's already an UnauthorizedException with specific message
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  private mapToUserProfile(user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    avatar: string | null;
    balance: { toString(): string };
    createdAt: Date;
  }): UserProfileDto {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone ?? undefined,
      avatar: user.avatar ?? undefined,
      balance: user.balance.toString(),
      createdAt: user.createdAt,
      role: 'USER',
      brandId: null,
      cafeId: null,
    };
  }

  private mapWorkerToProfile(worker: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: WorkerRole;
    brandId: string | null;
    cafeId: string | null;
    createdAt: Date;
  }): UserProfileDto {
    return {
      id: worker.id,
      email: worker.email,
      firstName: worker.firstName,
      lastName: worker.lastName,
      phone: undefined,
      avatar: undefined,
      balance: '0.00',
      createdAt: worker.createdAt,
      role: worker.role,
      brandId: worker.brandId ?? null,
      cafeId: worker.cafeId ?? null,
    };
  }

  async loginLookup(dto: LoginLookupDto): Promise<LoginLookupResponseDto> {
    try {
      // Validate credentials in Keycloak
      const tokens: TokenResponse =
        await this.keycloakService.validateCredentials(dto.email, dto.password);

      const decodedToken = this.decodeToken(tokens.access_token);
      if (!decodedToken || !decodedToken.sub) {
        throw new UnauthorizedException('Invalid token');
      }

      const keycloakId = decodedToken.sub;

      // Find all accounts for this keycloakId
      const accounts: AccountInfoDto[] = [];

      // Check for User account
      const user = await this.usersService.findByKeycloakId(keycloakId);
      if (user) {
        accounts.push({
          id: user.id,
          displayName:
            `${user.firstName} ${user.lastName}`.trim() || user.email,
          role: 'USER',
          brandId: null,
          cafeId: null,
        });
      }

      // Check for WorkerAccount accounts
      const workerAccounts = await this.prisma.workerAccount.findMany({
        where: {
          keycloakId,
          deletedAt: null,
        },
        include: {
          brand: true,
          cafe: true,
        },
      });

      for (const worker of workerAccounts) {
        accounts.push({
          id: worker.id,
          displayName:
            `${worker.firstName} ${worker.lastName}`.trim() || worker.email,
          role: worker.role,
          brandId: worker.brandId ?? null,
          cafeId: worker.cafeId ?? null,
        });
      }

      if (accounts.length === 0) {
        throw new UnauthorizedException('No accounts found for this user');
      }

      // Use refresh token as lookup token (more secure, can be used to get new access token)
      return {
        accounts,
        lookupToken: tokens.refresh_token,
      };
    } catch (error: unknown) {
      this.logger.error('Login lookup failed', error);
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid credentials');
    }
  }

  async loginSelect(dto: LoginSelectDto): Promise<AuthResponseDto> {
    try {
      // Use lookup token (refresh token) to get new access token
      // Add retry logic for test stability
      let tokens: TokenResponse | null = null;
      let retries = 3;
      let lastError: unknown = null;

      while (retries > 0 && !tokens) {
        try {
          tokens = await this.keycloakService.refreshToken(dto.lookupToken);
          break;
        } catch (error) {
          lastError = error;
          retries--;
          if (retries > 0) {
            // Wait a bit before retrying (for test stability)
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        }
      }

      if (!tokens) {
        this.logger.error('Failed to refresh token after retries', lastError);
        throw new UnauthorizedException('Invalid or expired refresh token');
      }

      // Decode new access token to get keycloakId
      const decodedToken = this.decodeToken(tokens.access_token);
      if (!decodedToken || !decodedToken.sub) {
        throw new UnauthorizedException('Invalid token');
      }

      const keycloakId = decodedToken.sub;

      // Verify user exists in Keycloak
      const keycloakUser =
        await this.keycloakService.getUserByKeycloakId(keycloakId);
      if (!keycloakUser) {
        throw new UnauthorizedException('User not found in Keycloak');
      }

      // Find the selected account
      const user = await this.usersService.findById(dto.accountId);
      const workerAccount = user
        ? null
        : await this.prisma.workerAccount.findFirst({
            where: {
              id: dto.accountId,
              keycloakId,
              deletedAt: null,
            },
            include: {
              brand: true,
              cafe: true,
            },
          });

      if (!user && !workerAccount) {
        throw new BadRequestException(
          'Account not found or does not belong to this user',
        );
      }

      // If we have a worker account, return worker profile
      if (workerAccount) {
        // Логируем успешный логин работника
        await this.activityLogsService.log({
          workerId: workerAccount.id,
          workerEmail: workerAccount.email,
          workerRole: workerAccount.role,
          brandId: workerAccount.brandId || undefined,
          cafeId: workerAccount.cafeId || undefined,
          action: ActivityAction.LOGIN,
          category: ActivityCategory.AUTH,
          severity: LogSeverity.INFO,
          resourceType: 'WORKER_ACCOUNT',
          resourceId: workerAccount.id,
          details: {
            loginMethod: 'select',
            role: workerAccount.role,
            brandName: workerAccount.brand?.name,
            cafeName: workerAccount.cafe?.name,
          },
        });

        return {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresIn: tokens.expires_in,
          user: this.mapWorkerToProfile(workerAccount),
        };
      }

      // Otherwise return user profile
      if (!user) {
        throw new UnauthorizedException('User account not found');
      }

      return {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresIn: tokens.expires_in,
        user: this.mapToUserProfile(user),
      };
    } catch (error: unknown) {
      this.logger.error('Login select failed', error);
      if (
        error instanceof UnauthorizedException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new UnauthorizedException('Invalid lookup token or account');
    }
  }

  async getProfile(keycloakId: string): Promise<UserProfileDto> {
    const user = await this.usersService.findByKeycloakId(keycloakId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return this.mapToUserProfile(user);
  }

  async getMe(
    keycloakId: string,
    selectedAccountId?: string,
  ): Promise<MeResponseDto> {
    // If accountId is provided (from cookie), use it to find the specific account
    if (selectedAccountId) {
      // Check if it's a WorkerAccount
      const workerAccount = await this.prisma.workerAccount.findFirst({
        where: {
          id: selectedAccountId,
          keycloakId,
          deletedAt: null,
        },
        include: {
          brand: true,
          cafe: true,
        },
      });

      if (workerAccount) {
        return {
          id: workerAccount.id,
          email: workerAccount.email,
          firstName: workerAccount.firstName,
          lastName: workerAccount.lastName,
          phone: undefined,
          avatar: undefined,
          balance: '0.00',
          createdAt: workerAccount.createdAt,
          role: workerAccount.role,
          brandId: workerAccount.brandId ?? null,
          cafeId: workerAccount.cafeId ?? null,
        };
      }

      // Check if it's a User account
      const user = await this.usersService.findById(selectedAccountId);
      if (user && user.keycloakId === keycloakId) {
        return {
          ...this.mapToUserProfile(user),
          role: 'USER',
          brandId: null,
          cafeId: null,
        };
      }

      // If selected account not found, throw error instead of fallback
      throw new UnauthorizedException('Selected account not found');
    }

    // No account selected - require explicit account selection for multi-account users
    // Check if user has multiple accounts
    const workerAccounts = await this.prisma.workerAccount.findMany({
      where: {
        keycloakId,
        deletedAt: null,
      },
    });

    const user = await this.usersService.findByKeycloakId(keycloakId);
    const hasMultipleAccounts = workerAccounts.length + (user ? 1 : 0) > 1;

    if (hasMultipleAccounts) {
      throw new UnauthorizedException(
        'Account not selected. Please select an account first.',
      );
    }

    // Single account users - return the only account
    if (workerAccounts.length === 1) {
      const workerAccount = workerAccounts[0];
      return {
        id: workerAccount.id,
        email: workerAccount.email,
        firstName: workerAccount.firstName,
        lastName: workerAccount.lastName,
        phone: undefined,
        avatar: undefined,
        balance: '0.00',
        createdAt: workerAccount.createdAt,
        role: workerAccount.role,
        brandId: workerAccount.brandId ?? null,
        cafeId: workerAccount.cafeId ?? null,
      };
    }

    // Only User account
    if (user) {
      return {
        ...this.mapToUserProfile(user),
        role: 'USER',
        brandId: null,
        cafeId: null,
      };
    }

    throw new UnauthorizedException('Account not found');
  }

  async updateProfile(
    keycloakId: string,
    data: {
      firstName?: string;
      lastName?: string;
      phone?: string;
      avatar?: string;
    },
  ): Promise<UserProfileDto> {
    const user = await this.usersService.findByKeycloakId(keycloakId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const updated = await this.usersService.update(user.id, data);
    return this.mapToUserProfile(updated);
  }

  async changePassword(
    keycloakId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    await this.keycloakService.resetPassword(
      keycloakId,
      currentPassword,
      newPassword,
    );
  }

  async deleteAccount(keycloakId: string): Promise<void> {
    const user = await this.usersService.findByKeycloakId(keycloakId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    await this.keycloakService.deleteUser(keycloakId);
    await this.usersService.softDelete(user.id);
  }

  private decodeToken(
    token: string,
  ): { sub?: string; [key: string]: unknown } | null {
    try {
      const base64Url = token.split('.')[1];
      if (!base64Url) {
        return null;
      }
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = Buffer.from(base64, 'base64').toString('utf-8');
      return JSON.parse(jsonPayload) as {
        sub?: string;
        [key: string]: unknown;
      };
    } catch {
      return null;
    }
  }
}
