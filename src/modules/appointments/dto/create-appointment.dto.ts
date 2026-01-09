import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsDateString,
  IsInt,
  IsOptional,
  IsIn,
  Min,
  Max,
  IsUUID,
} from 'class-validator';

export class CreateAppointmentDto {
  @ApiProperty({
    description: 'ID кофейни для бронирования',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  cafeId: string;

  @ApiProperty({
    description: 'Дата и время бронирования (ISO 8601)',
    example: '2025-01-15T14:30:00.000Z',
  })
  @IsDateString()
  dateTime: string;

  @ApiProperty({
    description: 'Продолжительность бронирования в минутах',
    example: 60,
    minimum: 15,
    maximum: 480,
  })
  @IsInt()
  @Min(15)
  @Max(480)
  duration: number;

  @ApiPropertyOptional({
    description: 'Способ оплаты (если платное бронирование)',
    example: 'CARD',
    enum: ['CARD', 'BALANCE', 'CASH', 'FREE'],
  })
  @IsOptional()
  @IsIn(['CARD', 'BALANCE', 'CASH', 'FREE'])
  paymentMethod?: 'CARD' | 'BALANCE' | 'CASH' | 'FREE';

  @ApiPropertyOptional({
    description: 'ID карты для оплаты (если paymentMethod = CARD)',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsOptional()
  @IsUUID()
  cardId?: string;

  @ApiPropertyOptional({
    description: 'Комментарии к бронированию',
    example: 'Столик у окна для 4 человек',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
