import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsDateString,
  IsInt,
  Min,
  Max,
  IsString,
} from 'class-validator';

export class UpdateAppointmentDto {
  @ApiPropertyOptional({
    description: 'Новые дата и время бронирования (ISO 8601)',
    example: '2025-01-15T16:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  dateTime?: string;

  @ApiPropertyOptional({
    description: 'Новая продолжительность в минутах',
    example: 90,
    minimum: 15,
    maximum: 480,
  })
  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(480)
  duration?: number;

  @ApiPropertyOptional({
    description: 'Комментарии к бронированию',
    example: 'Изменили время на вечер',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
