import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus, DeliveryType, PaymentMethod } from '@prisma/client';
import { OrderItemResponseDto } from './order-item-response.dto';

export class OrderResponseDto {
  @ApiProperty({ example: 'uuid', description: 'Order ID' })
  id: string;

  @ApiProperty({
    example: 'ORD-2025-001234',
    description: 'Unique order number',
  })
  orderNumber: string;

  @ApiProperty({ example: 'uuid', description: 'User ID' })
  userId: string;

  @ApiProperty({ example: 'uuid', description: 'Cafe ID' })
  cafeId: string;

  @ApiPropertyOptional({
    example: 'Coffee House Downtown',
    description: 'Cafe name',
  })
  cafeName?: string;

  @ApiPropertyOptional({
    example: 'uuid',
    description: 'Appointment ID (if order is for a reservation)',
  })
  appointmentId?: string;

  @ApiProperty({
    example: 'PENDING',
    description: 'Order status',
    enum: OrderStatus,
  })
  status: OrderStatus;

  @ApiProperty({ example: 1000.0, description: 'Total amount in BYN' })
  totalAmount: number;

  @ApiProperty({
    example: 'IN_CAFE',
    description: 'Delivery type',
    enum: DeliveryType,
  })
  deliveryType: DeliveryType;

  @ApiPropertyOptional({
    example: 'Минск, проспект Независимости, 1',
    description: 'Delivery address',
  })
  deliveryAddress?: string;

  @ApiProperty({ example: '+375 (29) 123-45-67', description: 'Contact phone' })
  contactPhone: string;

  @ApiPropertyOptional({
    example: 'Please bring to table 5',
    description: 'Additional notes',
  })
  notes?: string;

  @ApiProperty({
    example: 'CARD',
    description: 'Payment method',
    enum: PaymentMethod,
  })
  paymentMethod: PaymentMethod;

  @ApiPropertyOptional({ description: 'Payment date' })
  paidAt?: Date;

  @ApiPropertyOptional({ description: 'Confirmation date' })
  confirmedAt?: Date;

  @ApiPropertyOptional({ description: 'Completion date' })
  completedAt?: Date;

  @ApiPropertyOptional({ description: 'Cancellation date' })
  cancelledAt?: Date;

  @ApiPropertyOptional({
    example: 'Out of stock',
    description: 'Cancellation reason',
  })
  cancellationReason?: string;

  @ApiProperty({
    type: [OrderItemResponseDto],
    description: 'Order items',
  })
  items: OrderItemResponseDto[];

  @ApiProperty({ description: 'Creation date' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update date' })
  updatedAt: Date;
}
