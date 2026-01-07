import { ApiProperty } from '@nestjs/swagger';
import { BrandStatus } from '@prisma/client';

export class BrandReportCafeDto {
  @ApiProperty({ example: 'uuid', description: 'Cafe ID' })
  id: string;

  @ApiProperty({ example: 'Coffee House', description: 'Cafe name' })
  name: string;

  @ApiProperty({
    example: 'Moscow, Red Square, 1',
    description: 'Cafe address',
  })
  address: string;

  @ApiProperty({ example: 'Moscow', description: 'City' })
  city: string;

  @ApiProperty({ example: 4.5, description: 'Cafe rating' })
  rating: number;

  @ApiProperty({ example: 25, description: 'Number of reviews' })
  reviewsCount: number;

  @ApiProperty({ description: 'Creation date' })
  createdAt: Date;
}

export class BrandReportDto {
  @ApiProperty({
    description: 'Brand information',
    type: 'object',
    properties: {
      id: { type: 'string', example: 'uuid' },
      name: { type: 'string', example: 'Coffee Brand' },
      status: { type: 'string', enum: Object.values(BrandStatus) },
      isVerified: { type: 'boolean', example: true },
    },
  })
  brand: {
    id: string;
    name: string;
    status: BrandStatus;
    isVerified: boolean;
  };

  @ApiProperty({
    description: 'Brand statistics',
    type: 'object',
    properties: {
      totalCafes: { type: 'number', example: 10 },
      activeCafes: { type: 'number', example: 10 },
      averageRating: { type: 'number', example: 4.5 },
      totalReviews: { type: 'number', example: 150 },
    },
  })
  statistics: {
    totalCafes: number;
    activeCafes: number;
    averageRating: number;
    totalReviews: number;
  };

  @ApiProperty({
    type: [BrandReportCafeDto],
    description: 'List of cafes',
  })
  cafes: BrandReportCafeDto[];

  @ApiProperty({ description: 'Report generation timestamp' })
  generatedAt: Date;
}
