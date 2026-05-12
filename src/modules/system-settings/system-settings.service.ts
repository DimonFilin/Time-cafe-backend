import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  UpdateSystemSettingsDto,
  SystemSettingsResponseDto,
  PlatformSettingsDto,
  SecuritySettingsDto,
  ModerationSettingsDto,
  NotificationSettingsDto,
  IntegrationSettingsDto,
  LimitsSettingsDto,
} from './dto/system-settings.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class SystemSettingsService {
  private readonly logger = new Logger(SystemSettingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get default system settings
   */
  private getDefaultSettings(): {
    platform: PlatformSettingsDto;
    security: SecuritySettingsDto;
    moderation: ModerationSettingsDto;
    notifications: NotificationSettingsDto;
    integrations: IntegrationSettingsDto;
    limits: LimitsSettingsDto;
  } {
    return {
      platform: {
        commissionPercentage: 5,
        minOrderAmount: 100,
        maxBrandsPerAccount: 10,
        maxCafesPerBrand: 100,
      },
      security: {
        accessTokenLifetimeMinutes: 15,
        refreshTokenLifetimeDays: 30,
        minPasswordLength: 8,
        requirePasswordComplexity: true,
      },
      moderation: {
        autoModerateReviews: true,
        requiredDocumentTypes: ['REGISTRATION', 'LICENSE', 'CONTRACT'],
        documentVerificationDays: 7,
      },
      notifications: {
        emailEnabled: true,
        smsEnabled: false,
        pushEnabled: true,
      },
      integrations: {
        defaultGeocodingService: 'nominatim',
        stripeTestKey: '',
        stripeLiveKey: '',
        yandexMapsApiKey: '',
        googleMapsApiKey: '',
      },
      limits: {
        maxFileSizeMB: 10,
        maxDocumentsPerBrand: 20,
      },
    };
  }

  /**
   * Get all system settings
   */
  async findAll(): Promise<SystemSettingsResponseDto> {
    let settings = await this.prisma.systemSettings.findUnique({
      where: { id: 'system' },
    });

    // If settings don't exist, create with defaults
    if (!settings) {
      const defaultSettings = this.getDefaultSettings();
      settings = await this.prisma.systemSettings.create({
        data: {
          id: 'system',
          settings: defaultSettings as unknown as Prisma.InputJsonValue,
        },
      });
      this.logger.log('Created default system settings');
    }

    const settingsData = settings.settings as unknown as {
      platform: PlatformSettingsDto;
      security: SecuritySettingsDto;
      moderation: ModerationSettingsDto;
      notifications: NotificationSettingsDto;
      integrations: IntegrationSettingsDto;
      limits: LimitsSettingsDto;
    };

    // Merge with defaults to ensure all fields are present
    const defaultSettings = this.getDefaultSettings();
    const mergedSettings = {
      platform: { ...defaultSettings.platform, ...settingsData.platform },
      security: { ...defaultSettings.security, ...settingsData.security },
      moderation: {
        ...defaultSettings.moderation,
        ...settingsData.moderation,
      },
      notifications: {
        ...defaultSettings.notifications,
        ...settingsData.notifications,
      },
      integrations: {
        ...defaultSettings.integrations,
        ...settingsData.integrations,
      },
      limits: { ...defaultSettings.limits, ...settingsData.limits },
    };

    return {
      ...mergedSettings,
      updatedAt: settings.updatedAt,
      updatedBy: settings.updatedBy || undefined,
    };
  }

  /**
   * Update system settings
   */
  async update(
    updateDto: UpdateSystemSettingsDto,
    updatedBy: string,
  ): Promise<SystemSettingsResponseDto> {
    const currentSettings = await this.prisma.systemSettings.findUnique({
      where: { id: 'system' },
    });

    const defaultSettings = this.getDefaultSettings();
    let currentSettingsData: {
      platform: PlatformSettingsDto;
      security: SecuritySettingsDto;
      moderation: ModerationSettingsDto;
      notifications: NotificationSettingsDto;
      integrations: IntegrationSettingsDto;
      limits: LimitsSettingsDto;
    };

    if (currentSettings) {
      currentSettingsData = currentSettings.settings as unknown as {
        platform: PlatformSettingsDto;
        security: SecuritySettingsDto;
        moderation: ModerationSettingsDto;
        notifications: NotificationSettingsDto;
        integrations: IntegrationSettingsDto;
        limits: LimitsSettingsDto;
      };
    } else {
      currentSettingsData = defaultSettings;
    }

    // Merge updates with current settings
    const updatedSettings = {
      platform: {
        ...defaultSettings.platform,
        ...currentSettingsData.platform,
        ...updateDto.platform,
      },
      security: {
        ...defaultSettings.security,
        ...currentSettingsData.security,
        ...updateDto.security,
      },
      moderation: {
        ...defaultSettings.moderation,
        ...currentSettingsData.moderation,
        ...updateDto.moderation,
      },
      notifications: {
        ...defaultSettings.notifications,
        ...currentSettingsData.notifications,
        ...updateDto.notifications,
      },
      integrations: {
        ...defaultSettings.integrations,
        ...currentSettingsData.integrations,
        ...updateDto.integrations,
      },
      limits: {
        ...defaultSettings.limits,
        ...currentSettingsData.limits,
        ...updateDto.limits,
      },
    };

    // Upsert settings
    const result = await this.prisma.systemSettings.upsert({
      where: { id: 'system' },
      update: {
        settings: updatedSettings as unknown as Prisma.InputJsonValue,
        updatedBy,
      },
      create: {
        id: 'system',
        settings: updatedSettings as unknown as Prisma.InputJsonValue,
        updatedBy,
      },
    });

    this.logger.log(`System settings updated by ${updatedBy}`);

    return {
      ...updatedSettings,
      updatedAt: result.updatedAt,
      updatedBy: result.updatedBy || undefined,
    };
  }

  /**
   * Get a specific setting section
   */
  async findOne(
    section: string,
  ): Promise<
    | PlatformSettingsDto
    | SecuritySettingsDto
    | ModerationSettingsDto
    | NotificationSettingsDto
    | IntegrationSettingsDto
    | LimitsSettingsDto
  > {
    const settings = await this.findAll();

    const sectionMap: Record<
      string,
      | PlatformSettingsDto
      | SecuritySettingsDto
      | ModerationSettingsDto
      | NotificationSettingsDto
      | IntegrationSettingsDto
      | LimitsSettingsDto
    > = {
      platform: settings.platform,
      security: settings.security,
      moderation: settings.moderation,
      notifications: settings.notifications,
      integrations: settings.integrations,
      limits: settings.limits,
    };

    if (!sectionMap[section]) {
      throw new NotFoundException(`Setting section '${section}' not found`);
    }

    return sectionMap[section];
  }
}
