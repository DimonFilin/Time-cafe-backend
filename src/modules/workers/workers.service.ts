import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  WorkerAccount,
  WorkerRole,
  Prisma,
  ActivityAction,
  ActivityCategory,
} from '@prisma/client';
import { KeycloakService } from '../auth/services/keycloak.service';
import { UsersService } from '../users/users.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { RegisterWorkerDto } from './dto/register-worker.dto';
import { UpdateWorkerDto } from './dto/update-worker.dto';
import { AuthResponseDto } from '../auth/dto/auth-response.dto';
import { UserProfileDto } from '../auth/dto/user-profile.dto';
import { WorkerListResponseDto } from './dto/worker-list-response.dto';
import { WorkerListQueryDto } from './dto/worker-list-query.dto';

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
    private readonly activityLogsService: ActivityLogsService,
  ) {}

  async findByKeycloakId(keycloakId: string): Promise<WorkerAccount | null> {
    return this.prisma.workerAccount.findFirst({
      where: {
        keycloakId,
        deletedAt: null,
      },
    });
  }

  async findByEmail(email: string): Promise<WorkerAccount | null> {
    return this.prisma.workerAccount.findFirst({
      where: {
        email,
        deletedAt: null,
      },
    });
  }

  async findById(id: string): Promise<WorkerAccount | null> {
    return this.prisma.workerAccount.findFirst({
      where: {
        id,
        deletedAt: null,
      },
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

  async softDelete(workerId: string): Promise<WorkerAccount> {
    return this.prisma.workerAccount.update({
      where: { id: workerId },
      data: { deletedAt: new Date() },
    });
  }

  async register(
    requesterKeycloakId: string,
    dto: RegisterWorkerDto,
  ): Promise<AuthResponseDto> {
    // Check requester permissions
    const requester = await this.findByKeycloakId(requesterKeycloakId);
    if (!requester) {
      throw new ForbiddenException('Requester worker account not found');
    }

    if (
      requester.role !== WorkerRole.SYSTEM_ADMIN &&
      requester.role !== WorkerRole.BRAND_ADMIN
    ) {
      throw new ForbiddenException(
        'Only SYSTEM_ADMIN or BRAND_ADMIN can create workers',
      );
    }

    // Validate CAFE_ADMIN requirements
    if (dto.role === WorkerRole.CAFE_ADMIN) {
      if (!dto.cafeId) {
        throw new BadRequestException('cafeId is required for CAFE_ADMIN role');
      }

      // Check cafe exists and is not deleted
      const cafe = await this.prisma.cafe.findFirst({
        where: {
          id: dto.cafeId,
          deletedAt: null,
        },
        include: {
          brand: true,
        },
      });

      if (!cafe) {
        throw new NotFoundException(`Cafe with ID ${dto.cafeId} not found`);
      }

      // Validate brand relationship
      if (dto.brandId) {
        if (cafe.brandId !== dto.brandId) {
          throw new BadRequestException(
            `Cafe ${dto.cafeId} does not belong to brand ${dto.brandId}`,
          );
        }
      }

      // Check access rights
      if (requester.role === WorkerRole.BRAND_ADMIN) {
        if (!requester.brandId || requester.brandId !== cafe.brandId) {
          throw new ForbiddenException(
            'BRAND_ADMIN can only create CAFE_ADMIN for cafes of their brand',
          );
        }
      }
      // SYSTEM_ADMIN can create for any cafe
    }

    // Validate BRAND_ADMIN requirements
    if (dto.role === WorkerRole.BRAND_ADMIN) {
      if (!dto.brandId) {
        throw new BadRequestException(
          'brandId is required for BRAND_ADMIN role',
        );
      }

      // Check brand exists
      const brand = await this.prisma.brand.findFirst({
        where: {
          id: dto.brandId,
          deletedAt: null,
        },
      });

      if (!brand) {
        throw new NotFoundException(`Brand with ID ${dto.brandId} not found`);
      }

      // Check access rights
      if (requester.role === WorkerRole.BRAND_ADMIN) {
        if (requester.brandId !== dto.brandId) {
          throw new ForbiddenException(
            'BRAND_ADMIN can only create BRAND_ADMIN for their own brand',
          );
        }
      }
      // SYSTEM_ADMIN can create for any brand
    }

    // Validate WORKER requirements
    if (dto.role === WorkerRole.WORKER) {
      if (!dto.cafeId) {
        throw new BadRequestException('cafeId is required for WORKER role');
      }

      // Check cafe exists
      const cafe = await this.prisma.cafe.findFirst({
        where: {
          id: dto.cafeId,
          deletedAt: null,
        },
      });

      if (!cafe) {
        throw new NotFoundException(`Cafe with ID ${dto.cafeId} not found`);
      }

      // Check access rights
      if (requester.role === WorkerRole.BRAND_ADMIN) {
        if (!requester.brandId || requester.brandId !== cafe.brandId) {
          throw new ForbiddenException(
            'BRAND_ADMIN can only create WORKER for cafes of their brand',
          );
        }
      }
      // SYSTEM_ADMIN can create for any cafe
    }

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

      await this.activityLogsService.log({
        workerId: requester.id,
        workerEmail: requester.email,
        workerRole: requester.role,
        brandId: requester.brandId ?? undefined,
        cafeId: requester.cafeId ?? undefined,
        action: ActivityAction.CREATE,
        category: ActivityCategory.DATA,
        resourceType: 'WORKER_ACCOUNT',
        resourceId: worker.id,
        details: {
          createdWorkerId: worker.id,
          createdEmail: worker.email,
          createdRole: worker.role,
          brandId: worker.brandId,
          cafeId: worker.cafeId,
        },
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

  /**
   * List workers: SYSTEM_ADMIN (all or by brandId), BRAND_ADMIN (own brand only).
   */
  async findAll(
    keycloakId: string,
    query: WorkerListQueryDto,
  ): Promise<WorkerListResponseDto> {
    const worker = await this.findByKeycloakId(keycloakId);
    if (!worker) {
      throw new ForbiddenException('Worker not found');
    }

    let brandIdFilter = query.brandId;

    if (worker.role === WorkerRole.BRAND_ADMIN) {
      if (!worker.brandId) {
        throw new ForbiddenException('Brand admin has no brand assigned');
      }
      if (brandIdFilter && brandIdFilter !== worker.brandId) {
        throw new ForbiddenException('Cannot view workers of another brand');
      }
      if (query.role === WorkerRole.SYSTEM_ADMIN) {
        throw new ForbiddenException('Cannot list system administrators');
      }
      brandIdFilter = worker.brandId;
    } else if (worker.role !== WorkerRole.SYSTEM_ADMIN) {
      throw new ForbiddenException('Only SYSTEM_ADMIN can view all workers');
    }

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    let where: Prisma.WorkerAccountWhereInput = {
      ...(query.includeDeleted ? {} : { deletedAt: null }),
      ...(query.cafeId && { cafeId: query.cafeId }),
      ...(worker.role === WorkerRole.BRAND_ADMIN
        ? query.role
          ? { role: query.role }
          : { role: { not: WorkerRole.SYSTEM_ADMIN } }
        : query.role
          ? { role: query.role }
          : {}),
    };

    if (brandIdFilter) {
      where = { ...where, brandId: brandIdFilter };
    }

    const [items, total] = await Promise.all([
      this.prisma.workerAccount.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.workerAccount.count({ where }),
    ]);

    return {
      items: items.map((w) => ({
        id: w.id,
        email: w.email,
        firstName: w.firstName,
        lastName: w.lastName,
        role: w.role,
        brandId: w.brandId ?? undefined,
        cafeId: w.cafeId ?? undefined,
        createdAt: w.createdAt,
        deletedAt: w.deletedAt ?? null,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get worker by ID (SYSTEM_ADMIN only)
   */
  async findOneById(
    keycloakId: string,
    workerId: string,
  ): Promise<WorkerAccount | null> {
    // Check if user is SYSTEM_ADMIN
    const worker = await this.findByKeycloakId(keycloakId);
    if (!worker || worker.role !== WorkerRole.SYSTEM_ADMIN) {
      throw new ForbiddenException('Only SYSTEM_ADMIN can view worker details');
    }

    return this.findById(workerId);
  }

  /**
   * Update worker by ID (SYSTEM_ADMIN only)
   */
  async updateById(
    keycloakId: string,
    workerId: string,
    dto: UpdateWorkerDto,
  ): Promise<WorkerAccount> {
    // Check if user is SYSTEM_ADMIN
    const requester = await this.findByKeycloakId(keycloakId);
    if (!requester || requester.role !== WorkerRole.SYSTEM_ADMIN) {
      throw new ForbiddenException('Only SYSTEM_ADMIN can update workers');
    }

    const worker = await this.findById(workerId);
    if (!worker) {
      throw new NotFoundException('Worker account not found');
    }

    // Validate cafe if cafeId is being updated
    if (dto.cafeId !== undefined && dto.cafeId !== worker.cafeId) {
      const cafe = await this.prisma.cafe.findFirst({
        where: {
          id: dto.cafeId,
          deletedAt: null,
        },
      });

      if (!cafe) {
        throw new NotFoundException(`Cafe with ID ${dto.cafeId} not found`);
      }
    }

    // Validate brand if brandId is being updated
    if (dto.brandId !== undefined && dto.brandId !== worker.brandId) {
      const brand = await this.prisma.brand.findFirst({
        where: {
          id: dto.brandId,
          deletedAt: null,
        },
      });

      if (!brand) {
        throw new NotFoundException(`Brand with ID ${dto.brandId} not found`);
      }
    }

    return this.update(workerId, dto);
  }

  /**
   * Delete worker by ID (SYSTEM_ADMIN only)
   */
  async deleteById(keycloakId: string, workerId: string): Promise<void> {
    // Check if user is SYSTEM_ADMIN
    const requester = await this.findByKeycloakId(keycloakId);
    if (!requester || requester.role !== WorkerRole.SYSTEM_ADMIN) {
      throw new ForbiddenException('Only SYSTEM_ADMIN can delete workers');
    }

    // Prevent deleting yourself
    if (requester.id === workerId) {
      throw new ForbiddenException('SYSTEM_ADMIN cannot delete themselves');
    }

    const worker = await this.findById(workerId);
    if (!worker) {
      throw new NotFoundException('Worker account not found');
    }

    // Prevent deleting any SYSTEM_ADMIN
    if (worker.role === WorkerRole.SYSTEM_ADMIN) {
      throw new ForbiddenException('SYSTEM_ADMIN accounts cannot be deleted');
    }

    // Delete from Keycloak
    await this.keycloakService.deleteUser(worker.keycloakId);

    // Soft delete from database
    await this.softDelete(workerId);
  }
}
