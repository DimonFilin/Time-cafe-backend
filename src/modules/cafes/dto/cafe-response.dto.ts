import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CafeResponseDto {
  @ApiProperty({ example: 'uuid', description: 'Cafe ID' })
  id: string;

  @ApiProperty({ example: 'Coffee House Downtown', description: 'Cafe name' })
  name: string;

  @ApiPropertyOptional({
    example: 'Cozy coffee shop in the city center',
    description: 'Cafe description',
  })
  description?: string;

  @ApiProperty({
    example: 'Moscow, Red Square, 1',
    description: 'Full address',
  })
  address: string;

  @ApiProperty({ example: 'Moscow', description: 'City name' })
  city: string;

  @ApiPropertyOptional({
    example: 'Red Square',
    description: 'Street name',
  })
  street?: string;

  @ApiProperty({
    example: 55.7539,
    description: 'Latitude',
  })
  latitude: number;

  @ApiProperty({
    example: 37.6208,
    description: 'Longitude',
  })
  longitude: number;

  @ApiProperty({
    example: ['http://example.com/photo1.jpg'],
    description: 'Array of photo URLs',
    type: [String],
  })
  photos: string[];

  @ApiProperty({
    example: 4.5,
    description: 'Average rating (0-5)',
  })
  rating: number;

  @ApiProperty({
    example: 42,
    description: 'Number of reviews',
  })
  reviewsCount: number;

  @ApiProperty({ example: 'uuid', description: 'Brand ID' })
  brandId: string;

  @ApiPropertyOptional({
    example: 'Brand Name',
    description: 'Brand name (if included)',
  })
  brandName?: string;

  @ApiProperty({ example: 'uuid', description: 'Region ID' })
  regionId: string;

  @ApiPropertyOptional({
    example: 'Moscow Region',
    description: 'Region name (if included)',
  })
  regionName?: string;

  @ApiPropertyOptional({
    example: 'http://localhost:3001',
    description: 'URL to local cafe service',
  })
  cafeApiUrl?: string;

  @ApiProperty({
    example: '2025-01-01T00:00:00.000Z',
    description: 'Creation date',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2025-01-01T00:00:00.000Z',
    description: 'Last update date',
  })
  updatedAt: Date;
}
