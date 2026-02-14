import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { KeycloakService } from '../../auth/services/keycloak.service';
import { InviteWorkerDto } from '../dto/invite-worker.dto';
import { UpdateWorkerDto } from '../dto/update-worker.dto';
import { Prisma, WorkerRole } from '@prisma/client';

@Injectable()
export class CafeAdminWorkersService {
  private readonly logger = new Logger(CafeAdminWorkersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly keycloakService: KeycloakService,
  ) {}

  async inviteWorker(cafeId: string, dto: InviteWorkerDto) {
    // Validate email uniqueness
    const existing = await this.prisma.workerAccount.findFirst({
      where: { email: dto.email, deletedAt: null },
    });

    if (existing) {
      throw new BadRequestException('Email already exists');
    }

    // Get cafe to get brandId
    const cafe = await this.prisma.cafe.findUnique({
      where: { id: cafeId },
    });

    if (!cafe) {
      throw new NotFoundException('Cafe not found');
    }

    // Create in Keycloak
    const keycloakId = await this.keycloakService.createUser(
      dto.email,
      dto.password,
    );

    // Create in database
    const worker = await this.prisma.workerAccount.create({
      data: {
        keycloakId,
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: WorkerRole.WORKER,
        cafeId,
        brandId: cafe.brandId,
      },
    });

    this.logger.log(`Worker invited: ${worker.email} to cafe ${cafeId}`);

    return worker;
  }

  async getWorkers(
    cafeId: string,
    query: {
      page?: number;
      limit?: number;
      search?: string;
      shiftStatus?: 'ON_SHIFT' | 'OFF_SHIFT';
    },
  ) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.WorkerAccountWhereInput = {
      cafeId,
      deletedAt: null,
      role: WorkerRole.WORKER,
    };

    if (query.search) {
      where.OR = [
        { email: { contains: query.search, mode: 'insensitive' } },
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.shiftStatus) {
      where.shiftStatus = query.shiftStatus;
    }

    const [workers, total] = await Promise.all([
      this.prisma.workerAccount.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.workerAccount.count({ where }),
    ]);

    return {
      workers,
      total,
      page,
      limit,
    };
  }

  async getWorkerById(cafeId: string, workerId: string) {
    const worker = await this.prisma.workerAccount.findUnique({
      where: { id: workerId },
    });

    if (!worker || worker.deletedAt) {
      throw new NotFoundException('Worker not found');
    }

    if (worker.cafeId !== cafeId) {
      throw new ForbiddenException('Worker does not belong to your cafe');
    }

    return worker;
  }

  async updateWorker(cafeId: string, workerId: string, dto: UpdateWorkerDto) {
    // Validate worker belongs to cafe
    const worker = await this.getWorkerById(cafeId, workerId);

    // Validate email uniqueness if changing
    if (dto.email && dto.email !== worker.email) {
      const existing = await this.prisma.workerAccount.findFirst({
        where: { email: dto.email, deletedAt: null },
      });
      if (existing) {
        throw new BadRequestException('Email already exists');
      }
    }

    // Update in Keycloak if needed
    if (dto.password) {
      // Reset password in Keycloak
      await this.keycloakService.resetPassword(
        worker.keycloakId,
        worker.email,
        dto.password,
      );
    }
    // Note: Keycloak email/name updates would need additional implementation

    // Update in database
    const updated = await this.prisma.workerAccount.update({
      where: { id: workerId },
      data: {
        ...(dto.email && { email: dto.email }),
        ...(dto.firstName && { firstName: dto.firstName }),
        ...(dto.lastName && { lastName: dto.lastName }),
      },
    });

    this.logger.log(`Worker updated: ${updated.email}`);

    return updated;
  }

  async deleteWorker(cafeId: string, workerId: string) {
    // Validate worker belongs to cafe
    const worker = await this.getWorkerById(cafeId, workerId);

    // Soft delete in database
    await this.prisma.workerAccount.update({
      where: { id: workerId },
      data: { deletedAt: new Date() },
    });

    // Deactivate in Keycloak
    try {
      await this.keycloakService.deleteUser(worker.keycloakId);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to deactivate user in Keycloak: ${message}`);
      // Continue even if Keycloak fails
    }

    this.logger.log(`Worker deleted: ${worker.email}`);

    return { message: 'Worker deleted successfully' };
  }
}
