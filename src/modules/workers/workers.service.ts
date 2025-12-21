import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkerAccount, WorkerRole } from '@prisma/client';
import { KeycloakService } from '../auth/services/keycloak.service';
import { UsersService } from '../users/users.service';
import { RegisterWorkerDto } from './dto/register-worker.dto';
import { AuthResponseDto } from '../auth/dto/auth-response.dto';
import { UserProfileDto } from '../auth/dto/user-profile.dto';

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

@Injectable()
export class WorkersService {
  private readonly logger = new Logger(WorkersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly keycloakService: KeycloakService,
    private readonly usersService: UsersService,
  ) {}

  async findByKeycloakId(keycloakId: string): Promise<WorkerAccount | null> {
    return this.prisma.workerAccount.findUnique({
      where: { keycloakId },
    });
  }

  async findByEmail(email: string): Promise<WorkerAccount | null> {
    return this.prisma.workerAccount.findUnique({
      where: { email },
    });
  }

  async findById(id: string): Promise<WorkerAccount | null> {
    return this.prisma.workerAccount.findUnique({
      where: { id },
    });
  }

  async create(data: {
    keycloakId: string;
    email: string;
    firstName: string;
    lastName: string;
    role: WorkerRole;
    brandId?: string;
    cafeId?: string;
  }): Promise<WorkerAccount> {
    return this.prisma.workerAccount.create({
      data,
    });
  }

  async getOrCreateByKeycloakId(
    keycloakId: string,
    email: string,
  ): Promise<WorkerAccount> {
    const existing = await this.findByKeycloakId(keycloakId);
    if (existing) {
      if (existing.email !== email) {
        return this.updateEmail(existing.id, email);
      }
      return existing;
    }

    return this.create({
      keycloakId,
      email,
      firstName: '',
      lastName: '',
      role: WorkerRole.WORKER,
    });
  }

  async updateEmail(workerId: string, email: string): Promise<WorkerAccount> {
    return this.prisma.workerAccount.update({
      where: { id: workerId },
      data: { email },
    });
  }

  async update(
    workerId: string,
    data: {
      firstName?: string;
      lastName?: string;
      role?: WorkerRole;
      brandId?: string;
      cafeId?: string;
    },
  ): Promise<WorkerAccount> {
    const worker = await this.findById(workerId);
    if (!worker) {
      throw new NotFoundException('Worker account not found');
    }

    return this.prisma.workerAccount.update({
      where: { id: workerId },
      data,
    });
  }

  async register(dto: RegisterWorkerDto): Promise<AuthResponseDto> {
    const keycloakUser = await this.keycloakService.getUserByEmail(dto.email);
    if (keycloakUser) {
      throw new ConflictException(
        'Worker with this email already exists in Keycloak',
      );
    }

    const existingWorker = await this.findByEmail(dto.email);
    if (existingWorker) {
      throw new ConflictException('Worker with this email already exists');
    }

    const existingUser = await this.usersService.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException(
        'Email is already registered as a user. One email can only be used for one account type.',
      );
    }

    try {
      const keycloakId = await this.keycloakService.createUser(
        dto.email,
        dto.password,
      );

      const worker = await this.create({
        keycloakId,
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: dto.role,
        brandId: dto.brandId,
        cafeId: dto.cafeId,
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
              `Failed to login after registration after 10 attempts, worker created: ${keycloakId}`,
            );
            throw new ConflictException(
              'Worker created but login failed. Please try logging in manually.',
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
          'Worker created but login failed. Please try logging in manually.',
        );
      }

      return {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresIn: tokens.expires_in,
        user: this.mapToUserProfile(worker),
      };
    } catch (error: unknown) {
      this.logger.error('Worker registration failed', error);
      if (error instanceof ConflictException) {
        throw error;
      }
      throw new ConflictException('Failed to register worker');
    }
  }

  private mapToUserProfile(worker: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    createdAt: Date;
  }): UserProfileDto {
    return {
      id: worker.id,
      email: worker.email,
      firstName: worker.firstName,
      lastName: worker.lastName,
      phone: undefined,
      avatar: undefined,
      balance: '0',
      createdAt: worker.createdAt,
    };
  }
}
