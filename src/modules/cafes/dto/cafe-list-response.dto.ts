import { ApiProperty } from '@nestjs/swagger';
import { CafeListItemDto } from './cafe-list-item.dto';

export class CafeListResponseDto {
  @ApiProperty({
    type: [CafeListItemDto],
    description: 'List of cafes',
  })
  items: CafeListItemDto[];

  @ApiProperty({
    example: 100,
    description: 'Total number of cafes',
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
