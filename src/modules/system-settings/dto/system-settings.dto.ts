import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsNumber,
  IsBoolean,
  IsString,
  Min,
  Max,
  IsObject,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PlatformSettingsDto {
  @ApiPropertyOptional({
    example: 5,
    description: 'Platform commission percentage',
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  commissionPercentage?: number;

  @ApiPropertyOptional({
    example: 100,
    description: 'Minimum order amount',
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minOrderAmount?: number;

  @ApiPropertyOptional({
    example: 10,
    description: 'Maximum number of brands per account',
    minimum: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxBrandsPerAccount?: number;

  @ApiPropertyOptional({
    example: 100,
    description: 'Maximum number of cafes per brand',
    minimum: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxCafesPerBrand?: number;
}

export class SecuritySettingsDto {
  @ApiPropertyOptional({
    example: 15,
    description: 'Access token lifetime in minutes',
    minimum: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  accessTokenLifetimeMinutes?: number;

  @ApiPropertyOptional({
    example: 30,
    description: 'Refresh token lifetime in days',
    minimum: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  refreshTokenLifetimeDays?: number;

  @ApiPropertyOptional({
    example: 8,
    description: 'Minimum password length',
    minimum: 6,
    maximum: 128,
  })
  @IsOptional()
  @IsNumber()
  @Min(6)
  @Max(128)
  minPasswordLength?: number;

  @ApiPropertyOptional({
    example: true,
    description:
      'Require password complexity (uppercase, lowercase, numbers, special chars)',
  })
  @IsOptional()
  @IsBoolean()
  requirePasswordComplexity?: boolean;
}

export class ModerationSettingsDto {
  @ApiPropertyOptional({
    example: true,
    description: 'Enable automatic review moderation',
  })
  @IsOptional()
  @IsBoolean()
  autoModerateReviews?: boolean;

  @ApiPropertyOptional({
    example: ['REGISTRATION', 'LICENSE', 'CONTRACT'],
    description: 'Required document types for brand verification',
    type: [String],
  })
  @IsOptional()
  @IsString({ each: true })
  requiredDocumentTypes?: string[];

  @ApiPropertyOptional({
    example: 7,
    description: 'Document verification time limit in days',
    minimum: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  documentVerificationDays?: number;
}

export class NotificationSettingsDto {
  @ApiPropertyOptional({
    example: true,
    description: 'Enable email notifications',
  })
  @IsOptional()
  @IsBoolean()
  emailEnabled?: boolean;

  @ApiPropertyOptional({
    example: false,
    description: 'Enable SMS notifications',
  })
  @IsOptional()
  @IsBoolean()
  smsEnabled?: boolean;

  @ApiPropertyOptional({
    example: true,
    description: 'Enable push notifications',
  })
  @IsOptional()
  @IsBoolean()
  pushEnabled?: boolean;
}

export class IntegrationSettingsDto {
  @ApiPropertyOptional({
    example: 'sk_test_...',
    description: 'Stripe test API key',
  })
  @IsOptional()
  @IsString()
  stripeTestKey?: string;

  @ApiPropertyOptional({
    example: 'sk_live_...',
    description: 'Stripe live API key',
  })
  @IsOptional()
  @IsString()
  stripeLiveKey?: string;

  @ApiPropertyOptional({
    example: 'nominatim',
    description: 'Default geocoding service (nominatim, yandex, google)',
  })
  @IsOptional()
  @IsString()
  defaultGeocodingService?: string;

  @ApiPropertyOptional({
    example: 'your-yandex-api-key',
    description: 'Yandex Maps API key',
  })
  @IsOptional()
  @IsString()
  yandexMapsApiKey?: string;

  @ApiPropertyOptional({
    example: 'your-google-api-key',
    description: 'Google Maps API key',
  })
  @IsOptional()
  @IsString()
  googleMapsApiKey?: string;
}

export class LimitsSettingsDto {
  @ApiPropertyOptional({
    example: 10,
    description: 'Maximum file upload size in MB',
    minimum: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxFileSizeMB?: number;

  @ApiPropertyOptional({
    example: 20,
    description: 'Maximum number of documents per brand',
    minimum: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxDocumentsPerBrand?: number;
}

export class UpdateSystemSettingsDto {
  @ApiPropertyOptional({ type: PlatformSettingsDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PlatformSettingsDto)
  platform?: PlatformSettingsDto;

  @ApiPropertyOptional({ type: SecuritySettingsDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => SecuritySettingsDto)
  security?: SecuritySettingsDto;

  @ApiPropertyOptional({ type: ModerationSettingsDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ModerationSettingsDto)
  moderation?: ModerationSettingsDto;

  @ApiPropertyOptional({ type: NotificationSettingsDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => NotificationSettingsDto)
  notifications?: NotificationSettingsDto;

  @ApiPropertyOptional({ type: IntegrationSettingsDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => IntegrationSettingsDto)
  integrations?: IntegrationSettingsDto;

  @ApiPropertyOptional({ type: LimitsSettingsDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => LimitsSettingsDto)
  limits?: LimitsSettingsDto;
}

export class SystemSettingsResponseDto {
  @ApiProperty({ type: PlatformSettingsDto })
  platform: PlatformSettingsDto;

  @ApiProperty({ type: SecuritySettingsDto })
  security: SecuritySettingsDto;

  @ApiProperty({ type: ModerationSettingsDto })
  moderation: ModerationSettingsDto;

  @ApiProperty({ type: NotificationSettingsDto })
  notifications: NotificationSettingsDto;

  @ApiProperty({ type: IntegrationSettingsDto })
  integrations: IntegrationSettingsDto;

  @ApiProperty({ type: LimitsSettingsDto })
  limits: LimitsSettingsDto;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  updatedAt: Date;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174000' })
  updatedBy?: string;
}
