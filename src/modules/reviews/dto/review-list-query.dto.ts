import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsUUID, IsInt, Min, Max, IsNumber } from 'class-validator';

export class ReviewListQueryDto {
  @ApiPropertyOptional({
    example: 'cafe-uuid-123',
    description: 'Filter by cafe ID',
  })
  @IsOptional()
  @IsUUID()
  cafeId?: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'Page number',
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    example: 20,
    description: 'Items per page',
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    example: 4.0,
    description: 'Minimum rating filter',
    minimum: 0,
    maximum: 5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(5)
  minRating?: number;

  @ApiPropertyOptional({
    example: true,
    description: 'Show only verified reviews',
  })
  @IsOptional()
  @Type(() => Boolean)
  verifiedOnly?: boolean;
}
