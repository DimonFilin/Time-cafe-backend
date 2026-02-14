import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { UpdateCafeDto } from '../dto/update-cafe.dto';
import { UpdateCafeScheduleDto } from '../dto/update-cafe-schedule.dto';

@Injectable()
export class CafeAdminCafeService {
  private readonly logger = new Logger(CafeAdminCafeService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getMyCafe(cafeId: string) {
    const cafe = await this.prisma.cafe.findUnique({
      where: { id: cafeId },
      include: {
        region: true,
        brand: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!cafe) {
      throw new NotFoundException('Cafe not found');
    }

    return cafe;
  }

  async updateMyCafe(cafeId: string, dto: UpdateCafeDto) {
    // Verify cafe exists
    const existing = await this.prisma.cafe.findUnique({
      where: { id: cafeId },
    });

    if (!existing) {
      throw new NotFoundException('Cafe not found');
    }

    // Update cafe
    const updated = await this.prisma.cafe.update({
      where: { id: cafeId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.address && { address: dto.address }),
        ...(dto.city && { city: dto.city }),
        ...(dto.latitude !== undefined && { latitude: dto.latitude }),
        ...(dto.longitude !== undefined && { longitude: dto.longitude }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.capacity !== undefined && { capacity: dto.capacity }),
      },
    });

    this.logger.log(`Cafe updated: ${updated.name} (${updated.id})`);

    return updated;
  }

  updateCafeSchedule(cafeId: string, dto: UpdateCafeScheduleDto) {
    this.validateSchedule(dto);
    this.logger.warn(
      `updateCafeSchedule is not implemented yet (cafeId=${cafeId}). Add schedule field to Cafe model.`,
    );
    // TODO: Add schedule field to Cafe model in Prisma schema
    // For now, return error
    throw new BadRequestException(
      'Schedule management not yet implemented. Please add schedule field to Cafe model.',
    );
  }

  private validateSchedule(dto: UpdateCafeScheduleDto) {
    const days = [
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
      'sunday',
    ] as const;

    for (const day of days) {
      const schedule = dto[day];
      if (!schedule) continue;

      // Skip validation if closed
      if (schedule.closed) continue;

      // Both open and close must be provided if not closed
      if (schedule.open && schedule.close) {
        // Validate open < close
        if (schedule.open >= schedule.close) {
          throw new BadRequestException(
            `Opening time must be before closing time for ${day}`,
          );
        }
      } else if (schedule.open || schedule.close) {
        throw new BadRequestException(
          `Both opening and closing times must be provided for ${day}`,
        );
      }
    }
  }
}
