import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsInt, IsNumber, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateOrderItemDto {
  @ApiProperty({
    example: 'Cappuccino',
    description: 'Item name',
  })
  @IsString()
  itemName: string;

  @ApiProperty({
    example: 2,
    description: 'Quantity',
    minimum: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiProperty({
    example: 250.0,
    description: 'Unit price in BYN',
    minimum: 0.01,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  unitPrice: number;

  @ApiProperty({
    example: 'Extra shot of espresso',
    description: 'Additional notes for this item',
    required: false,
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
