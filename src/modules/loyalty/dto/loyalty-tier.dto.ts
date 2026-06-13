import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateLoyaltyTierDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  bonusPercent: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateLoyaltyTierDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  bonusPercent?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ReorderLoyaltyTiersDto {
  @ApiProperty({ type: [String] })
  @IsUUID('4', { each: true })
  orderedIds: string[];
}

export class DeactivateLoyaltyTierDto {
  @ApiProperty()
  @IsUUID()
  migrateToTierId: string;
}

export class ChangeGuestTierDto {
  @ApiProperty()
  @IsUUID()
  tierId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  reason: string;
}
