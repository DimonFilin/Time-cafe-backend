import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

import { CafeListQueryDto } from './cafe-list-query.dto';

export class AdminCafeListQueryDto extends CafeListQueryDto {
  @ApiPropertyOptional({
    example: false,
    description: 'Include soft-deleted cafes (SYSTEM_ADMIN only)',
    default: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeDeleted?: boolean;
}
