import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsInt,
  Min,
  Max,
  IsNumber,
  IsEnum,
} from 'class-validator';

export enum CafeSortBy {
  RATING = 'rating',
  DISTANCE = 'distance',
  CREATED_AT = 'createdAt',
  REVIEWS_COUNT = 'reviewsCount',
}

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export class CafeListQueryDto {
  @ApiPropertyOptional({
    example: 'uuid',
    description: 'Filter by brand ID',
  })
  @IsOptional()
  @IsString()
  brandId?: string;

  @ApiPropertyOptional({
    example: 'uuid',
    description: 'Filter by region ID',
  })
  @IsOptional()
  @IsString()
  regionId?: string;

  @ApiPropertyOptional({
    example: 'Moscow',
    description: 'Filter by city name',
  })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({
    example: 'Russia',
    description: 'Filter by country (through region)',
  })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({
    example: 'coffee',
    description: 'Full-text search in name, address, description',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'Page number (starts from 1)',
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
    example: 'rating',
    description: 'Sort by field',
    enum: CafeSortBy,
  })
  @IsOptional()
  @IsEnum(CafeSortBy)
  sortBy?: CafeSortBy;

  @ApiPropertyOptional({
    example: 'desc',
    description: 'Sort order',
    enum: SortOrder,
  })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder;

  @ApiPropertyOptional({
    example: 55.7539,
    description: 'Latitude for distance calculation',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({
    example: 37.6208,
    description: 'Longitude for distance calculation',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiPropertyOptional({
    example: 5,
    description: 'Search radius in kilometers',
    minimum: 0.1,
    maximum: 1000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  @Max(1000)
  radius?: number;
}
