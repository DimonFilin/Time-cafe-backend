import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
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
        ...(chatSettings !== undefined && {
          chatSettings: chatSettings as Prisma.InputJsonValue,
        }),
      },
    });

    this.logger.log(`Cafe updated: ${updated.name} (${updated.id})`);

    return updated;
  }

  async updateCafeSchedule(cafeId: string, dto: UpdateCafeScheduleDto) {
    this.validateSchedule(dto);

    const existing = await this.prisma.cafe.findUnique({
      where: { id: cafeId },
    });
    if (!existing) {
      throw new NotFoundException('Cafe not found');
    }

    const openingHours = this.scheduleDtoToJson(dto);

    await this.prisma.cafe.update({
      where: { id: cafeId },
      data: { openingHours },
    });

    this.logger.log(`Cafe opening hours updated (${cafeId})`);

    return this.getMyCafe(cafeId);
  }

  private scheduleDtoToJson(dto: UpdateCafeScheduleDto): Prisma.InputJsonValue {
    const days = [
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
      'sunday',
    ] as const;

    const out: Record<
      string,
      { open?: string; close?: string; closed?: boolean }
    > = {};
    for (const day of days) {
      const s = dto[day];
      if (!s) continue;
      out[day] = {
        ...(s.open !== undefined ? { open: s.open } : {}),
        ...(s.close !== undefined ? { close: s.close } : {}),
        ...(s.closed !== undefined ? { closed: s.closed } : {}),
      };
    }
    return out;
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
      if (!schedule) {
        throw new BadRequestException(`Missing schedule for ${day}`);
      }

      if (schedule.closed === true) {
        continue;
      }

      if (!schedule.open || !schedule.close) {
        throw new BadRequestException(
          `Open and close times are required for ${day} when the cafe is not closed`,
        );
      }

      if (schedule.open >= schedule.close) {
        throw new BadRequestException(
          `Opening time must be before closing time for ${day}`,
        );
      }
    }
  }
}
