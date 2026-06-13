import {
  IsString,
  IsOptional,
  IsNumber,
  MinLength,
  MaxLength,
  Min,
  Max,
  IsBoolean,
  IsEnum,
  IsArray,
  IsUUID,
  Matches,
  IsIn,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ChatNotificationMode, WorkerRole } from '@prisma/client';
import {
  CAFE_OCCUPANCY_MODES,
  CAFE_PHONE_FORMAT_HINT,
  CAFE_PHONE_REGEX,
  IsCafeEmail,
} from '../../../common/cafe/cafe-field-validators';

export class UpdateCafeDto {
  @ApiProperty({
    description: 'Cafe name',
    example: 'Coffee House',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @ApiProperty({
    description: 'Cafe description',
    example: 'Cozy coffee shop in the city center',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({
    description: 'Street address',
    example: '123 Main St',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @ApiProperty({
    description: 'City',
    example: 'New York',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiProperty({
    description: 'Street line (optional, separate from address)',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  street?: string;

  @ApiProperty({
    description: 'Public cafe API base URL',
    example: 'https://api.example.com',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  cafeApiUrl?: string;

  @ApiProperty({
    description: 'Latitude',
    example: 40.7128,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiProperty({
    description: 'Longitude',
    example: -74.006,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiProperty({
    description: CAFE_PHONE_FORMAT_HINT,
    example: '+375-29-123-45-67',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Matches(CAFE_PHONE_REGEX, {
    message: CAFE_PHONE_FORMAT_HINT,
  })
  phone?: string;

  @ApiProperty({
    description: 'Email address (exactly one @)',
    example: 'cafe@example.com',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @IsCafeEmail()
  email?: string;

  @ApiProperty({
    description: 'Occupancy display mode for mobile apps',
    enum: CAFE_OCCUPANCY_MODES,
    required: false,
  })
  @IsOptional()
  @IsIn([...CAFE_OCCUPANCY_MODES])
  occupancyMode?: string;

  @ApiProperty({
    required: false,
    description: 'Default cafe chat enabled flag',
  })
  @IsOptional()
  @IsBoolean()
  chatEnabled?: boolean;

  @ApiProperty({
    required: false,
    description: 'Cafe-level chat notification mode',
    enum: ChatNotificationMode,
  })
  @IsOptional()
  @IsEnum(ChatNotificationMode)
  chatNotificationMode?: ChatNotificationMode;

  @ApiProperty({
    required: false,
    description: 'Cafe-level role routing for chat notifications',
    enum: WorkerRole,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsEnum(WorkerRole, { each: true })
  chatNotificationRoles?: WorkerRole[];

  @ApiProperty({
    required: false,
    description: 'Cafe-level explicit worker routing for chat notifications',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  chatNotificationWorkerIds?: string[];

  @ApiProperty({
    required: false,
    description: 'Optional chat color override',
    example: '#22c55e',
  })
  @IsOptional()
  @IsString()
  chatThemePrimaryColor?: string;
}
