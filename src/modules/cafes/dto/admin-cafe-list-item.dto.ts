import { ApiPropertyOptional } from '@nestjs/swagger';

import { CafeListItemDto } from './cafe-list-item.dto';

export class AdminCafeListItemDto extends CafeListItemDto {
  @ApiPropertyOptional({
    example: '2026-01-01T00:00:00.000Z',
    description: 'Soft delete timestamp (if cafe is deleted)',
    nullable: true,
  })
  deletedAt?: Date | null;
}
