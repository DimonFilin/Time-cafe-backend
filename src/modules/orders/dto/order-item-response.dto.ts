import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OrderItemResponseDto {
  @ApiProperty({ example: 'uuid', description: 'Order item ID' })
  id: string;

  @ApiProperty({ example: 'Cappuccino', description: 'Item name' })
  itemName: string;

  @ApiProperty({ example: 2, description: 'Quantity' })
  quantity: number;

  @ApiProperty({ example: 250.0, description: 'Unit price in BYN' })
  unitPrice: number;

  @ApiProperty({ example: 500.0, description: 'Total price for this item' })
  totalPrice: number;

  @ApiPropertyOptional({
    example: 'Extra shot of espresso',
    description: 'Additional notes',
  })
  notes?: string;

  @ApiProperty({ description: 'Creation date' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update date' })
  updatedAt: Date;
}
