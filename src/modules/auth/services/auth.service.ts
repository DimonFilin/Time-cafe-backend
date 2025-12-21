import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { KeycloakService } from './keycloak.service';
import { UsersService } from '../../users/users.service';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { AuthResponseDto } from '../dto/auth-response.dto';
import { UserProfileDto } from '../dto/user-profile.dto';

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
      const tokens: TokenResponse =
        await this.keycloakService.refreshToken(refreshToken);

      const decodedToken = this.decodeToken(tokens.access_token);
      if (!decodedToken || !decodedToken.sub) {
        throw new UnauthorizedException('Invalid token');
      }

      const keycloakId = decodedToken.sub;
      const user = await this.usersService.findByKeycloakId(keycloakId);

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      return {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresIn: tokens.expires_in,
        user: this.mapToUserProfile(user),
      };
    } catch (error: unknown) {
      this.logger.error('Token refresh failed', error);
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
    };
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
