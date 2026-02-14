import { Injectable, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkerRole } from '@prisma/client';

@Injectable()
export class CafeAdminService {
  private readonly logger = new Logger(CafeAdminService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get worker by ID (for cookie-based auth)
   */
  async getWorkerById(workerId: string) {
    const worker = await this.prisma.workerAccount.findFirst({
      where: {
        id: workerId,
        deletedAt: null,
      },
    });

    return worker;
  }

  /**
   * Get worker from token and validate they are a Cafe Admin with assigned cafe
   */
  async getWorkerFromToken(keycloakId: string) {
    const worker = await this.prisma.workerAccount.findFirst({
      where: {
        keycloakId,
        deletedAt: null,
      },
    });

    if (!worker) {
      throw new ForbiddenException('Worker account not found');
    }

    if (
      worker.role !== WorkerRole.CAFE_ADMIN &&
      worker.role !== WorkerRole.SYSTEM_ADMIN
    ) {
      throw new ForbiddenException('Only Cafe Admin can access this resource');
    }

    if (!worker.cafeId) {
      throw new ForbiddenException('Cafe Admin must be assigned to a cafe');
    }

    return worker;
  }

  /**
   * Validate that a resource belongs to the cafe admin's cafe
   */
  validateCafeAccess(resourceCafeId: string, adminCafeId: string): void {
    if (resourceCafeId !== adminCafeId) {
      throw new ForbiddenException('Resource does not belong to your cafe');
    }
  }
}
