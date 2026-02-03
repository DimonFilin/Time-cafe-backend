import { ApiProperty } from '@nestjs/swagger';

import { AdminCafeListItemDto } from './admin-cafe-list-item.dto';

export class AdminCafeListResponseDto {
  @ApiProperty({
    type: [AdminCafeListItemDto],
    description: 'List of cafes (admin view)',
  })
  items: AdminCafeListItemDto[];

  @ApiProperty({ example: 100, description: 'Total number of cafes' })
  total: number;

  @ApiProperty({ example: 1, description: 'Current page number' })
  page: number;

  @ApiProperty({ example: 20, description: 'Items per page' })
  limit: number;

  @ApiProperty({ example: 5, description: 'Total number of pages' })
  totalPages: number;
}
