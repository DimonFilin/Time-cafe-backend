import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class UpdateWorkerProfileDto {
  @ApiPropertyOptional({ example: 'Иван' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Петров' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  lastName?: string;

  @ApiPropertyOptional({ example: 'public/workers/uuid/avatar/123.jpg' })
  @IsOptional()
  @IsString()
  avatar?: string;

  @ApiPropertyOptional({
    example: '1995-06-15',
    description: 'ISO date YYYY-MM-DD',
  })
  @IsOptional()
  @ValidateIf(
    (_, value) => value !== null && value !== undefined && value !== '',
  )
  @IsDateString()
  birthDate?: string | null;
}
