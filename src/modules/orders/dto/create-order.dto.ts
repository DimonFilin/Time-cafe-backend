import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsUUID,
  IsEnum,
  IsOptional,
  IsArray,
  ValidateNested,
  IsPhoneNumber,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateOrderItemDto } from './create-order-item.dto';
import { DeliveryType, PaymentMethod } from '@prisma/client';

export class CreateOrderDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Cafe ID',
  })
  @IsUUID()
  cafeId: string;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440001',
    description: 'Appointment ID (if order is for a reservation)',
  })
  @IsOptional()
  @IsUUID()
  appointmentId?: string;

  @ApiProperty({
    example: [
      {
        itemName: 'Cappuccino',
        quantity: 2,
        unitPrice: 250.0,
        notes: 'Extra shot',
      },
    ],
    description: 'Order items',
    type: [CreateOrderItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];

  @ApiProperty({
    example: 'IN_CAFE',
    description: 'Delivery type',
    enum: DeliveryType,
    default: DeliveryType.IN_CAFE,
  })
  @IsEnum(DeliveryType)
  @IsOptional()
  deliveryType?: DeliveryType;

  @ApiPropertyOptional({
    example: 'Минск, проспект Независимости, 1',
    description: 'Delivery address (required if deliveryType is DELIVERY)',
  })
  @IsOptional()
  @IsString()
  @MinLength(5)
  deliveryAddress?: string;

  @ApiProperty({
    example: '+375 (29) 123-45-67',
    description: 'Contact phone number',
  })
  @IsString()
  @IsPhoneNumber('BY')
  contactPhone: string;

  @ApiPropertyOptional({
    example: 'Please bring to table 5',
    description: 'Additional notes for the order',
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({
    example: 'CARD',
    description: 'Payment method',
    enum: PaymentMethod,
    default: PaymentMethod.CARD,
  })
  @IsEnum(PaymentMethod)
  @IsOptional()
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440002',
    description: 'Payment card ID (required if paymentMethod is CARD)',
  })
  @IsOptional()
  @IsUUID()
  cardId?: string;
}
