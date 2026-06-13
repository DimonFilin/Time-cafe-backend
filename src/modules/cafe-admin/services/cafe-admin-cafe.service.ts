import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { UpdateCafeDto } from '../dto/update-cafe.dto';
import { UpdateCafeScheduleDto } from '../dto/update-cafe-schedule.dto';
import {
  scheduleDtoToJson,
  validateCafeSchedule,
} from '../../../common/cafe/cafe-schedule.lib';

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
    const hasChatSettingsUpdate =
      dto.chatEnabled !== undefined ||
      dto.chatNotificationMode !== undefined ||
      dto.chatNotificationRoles !== undefined ||
      dto.chatNotificationWorkerIds !== undefined ||
      dto.chatThemePrimaryColor !== undefined;

    const currentChatSettings =
      existing.chatSettings && typeof existing.chatSettings === 'object'
        ? (existing.chatSettings as Record<string, unknown>)
        : {};

    const chatSettings = hasChatSettingsUpdate
      ? {
          ...currentChatSettings,
          ...(dto.chatEnabled !== undefined
            ? { enabled: dto.chatEnabled }
            : {}),
          ...(dto.chatNotificationMode !== undefined
            ? { notificationMode: dto.chatNotificationMode }
            : {}),
          ...(dto.chatNotificationRoles !== undefined
            ? { notificationRoles: dto.chatNotificationRoles }
            : {}),
          ...(dto.chatNotificationWorkerIds !== undefined
            ? { notificationWorkerIds: dto.chatNotificationWorkerIds }
            : {}),
          ...(dto.chatThemePrimaryColor !== undefined
            ? {
                theme: {
                  ...(currentChatSettings.theme as Record<string, unknown>),
                  primaryColor: dto.chatThemePrimaryColor,
                },
              }
            : {}),
        }
      : undefined;

    const updated = await this.prisma.cafe.update({
      where: { id: cafeId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.address && { address: dto.address }),
        ...(dto.city && { city: dto.city }),
        ...(dto.street !== undefined && { street: dto.street }),
        ...(dto.cafeApiUrl !== undefined && { cafeApiUrl: dto.cafeApiUrl }),
        ...(dto.latitude !== undefined && { latitude: dto.latitude }),
        ...(dto.longitude !== undefined && { longitude: dto.longitude }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.occupancyMode !== undefined && {
          occupancyMode: dto.occupancyMode,
        }),
        ...(chatSettings !== undefined && {
          chatSettings: chatSettings as Prisma.InputJsonValue,
        }),
      },
    });

    this.logger.log(`Cafe updated: ${updated.name} (${updated.id})`);

    return updated;
  }

  async updateCafeSchedule(cafeId: string, dto: UpdateCafeScheduleDto) {
    validateCafeSchedule(dto);

    const existing = await this.prisma.cafe.findUnique({
      where: { id: cafeId },
    });
    if (!existing) {
      throw new NotFoundException('Cafe not found');
    }

    const openingHours = scheduleDtoToJson(dto);

    await this.prisma.cafe.update({
      where: { id: cafeId },
      data: { openingHours },
    });

    this.logger.log(`Cafe opening hours updated (${cafeId})`);

    return this.getMyCafe(cafeId);
  }
}
