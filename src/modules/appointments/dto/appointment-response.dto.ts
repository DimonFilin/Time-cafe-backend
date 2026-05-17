import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AppointmentUserDto {
  @ApiProperty({ description: 'Имя', example: 'Иван' })
  firstName: string;

  @ApiProperty({ description: 'Фамилия', example: 'Иванов' })
  lastName: string;

  @ApiPropertyOptional({ description: 'Email', example: 'user@example.com' })
  email?: string;

  @ApiPropertyOptional({ description: 'Телефон', example: '+79990000000' })
  phone?: string;
}

export class AppointmentResponseDto {
  @ApiProperty({
    description: 'Уникальный идентификатор бронирования',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'ID пользователя',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  userId: string;

  @ApiPropertyOptional({
    description: 'Краткие данные пользователя (для выдачи сотрудникам кафе)',
    type: AppointmentUserDto,
  })
  user?: AppointmentUserDto;

  @ApiProperty({
    description: 'ID кофейни',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  cafeId: string;

  @ApiPropertyOptional({
    description: 'ID комнаты',
    example: '550e8400-e29b-41d4-a716-446655440005',
  })
  roomId?: string;

  @ApiPropertyOptional({
    description: 'Название комнаты',
    example: 'Main Hall',
  })
  roomName?: string;

  @ApiPropertyOptional({
    description: 'Название кофейни',
    example: 'Starbucks Central',
  })
  cafeName?: string;

  @ApiProperty({
    description: 'Дата и время бронирования',
    example: '2025-01-15T14:30:00.000Z',
  })
  dateTime: Date;

  @ApiProperty({
    description: 'Продолжительность в минутах',
    example: 60,
  })
  duration: number;

  @ApiProperty({
    description: 'Статус бронирования',
    example: 'confirmed',
    enum: ['pending', 'confirmed', 'cancelled', 'completed'],
  })
  status: string;

  @ApiPropertyOptional({
    description: 'QR код для подтверждения',
    example: 'ABC123XYZ',
  })
  qrCode?: string;

  @ApiPropertyOptional({
    description: 'Общая стоимость',
    example: '25.50',
  })
  totalAmount?: string;

  @ApiPropertyOptional({
    description: 'Способ оплаты',
    example: 'CARD',
    enum: ['CARD', 'BALANCE', 'CASH', 'FREE'],
  })
  paymentMethod?: string;

  @ApiPropertyOptional({
    description: 'ID транзакции оплаты',
    example: '550e8400-e29b-41d4-a716-446655440003',
  })
  transactionId?: string;

  @ApiPropertyOptional({
    description: 'ID связанного заказа',
    example: '550e8400-e29b-41d4-a716-446655440004',
  })
  orderId?: string;

  @ApiPropertyOptional({
    description: 'IDs связанных заказов (если заказов несколько)',
    type: [String],
  })
  orderIds?: string[];

  @ApiPropertyOptional({
    description: 'Комментарии к бронированию',
    example: 'Столик у окна для 4 человек',
  })
  notes?: string;

  @ApiPropertyOptional({
    description: 'Снимок данных комнаты на момент брони',
    type: Object,
  })
  roomSnapshot?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Выбранные дополнительные предметы',
    type: Object,
  })
  selectedAssets?: Record<string, unknown>;

  @ApiProperty({
    description: 'Дата создания',
    example: '2025-01-10T10:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Дата последнего обновления',
    example: '2025-01-10T10:00:00.000Z',
  })
  updatedAt: Date;
}
