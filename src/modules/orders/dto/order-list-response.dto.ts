import { ApiProperty } from '@nestjs/swagger';
import { OrderResponseDto } from './order-response.dto';

export class OrderListResponseDto {
  @ApiProperty({
    type: [OrderResponseDto],
    description: 'List of orders',
  })
  items: OrderResponseDto[];

  @ApiProperty({
    example: 100,
    description: 'Total number of orders',
  })
  total: number;

  @ApiProperty({
    example: 1,
    description: 'Current page number',
  })
  page: number;

  @ApiProperty({
    example: 20,
    description: 'Items per page',
  })
  limit: number;

  @ApiProperty({
    example: 5,
    description: 'Total number of pages',
  })
  totalPages: number;
}
