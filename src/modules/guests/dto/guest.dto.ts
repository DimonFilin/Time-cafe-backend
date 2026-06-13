import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { Gender, GuestStatus } from '@prisma/client';

export class CreateNetworkGuestDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  registrationCafeId?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  patronymic?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @ApiPropertyOptional({ enum: Gender })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateNetworkGuestDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  patronymic?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @ApiPropertyOptional({ enum: Gender })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional({ enum: GuestStatus })
  @IsOptional()
  @IsEnum(GuestStatus)
  status?: GuestStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  accessCardNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  refusedReason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class GuestLookupQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  accessCardNumber?: string;

  @ApiPropertyOptional({ description: 'Raw SCUD QR JSON or card number' })
  @IsOptional()
  @IsString()
  payload?: string;
}

export class ConfirmPhoneVerifyDto {
  @ApiProperty({ example: '48291' })
  @IsString()
  @IsNotEmpty()
  code: string;
}

export class RefuseGuestDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  refusedReason: string;
}
