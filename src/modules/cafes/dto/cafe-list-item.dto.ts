import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CafeListItemDto {
  @ApiProperty({ example: 'uuid', description: 'Cafe ID' })
  id: string;

  @ApiProperty({ example: 'Coffee House Downtown', description: 'Cafe name' })
  name: string;

  @ApiProperty({
    example: 'Минск, проспект Независимости, 1',
    description: 'Full address',
  })
  address: string;

  @ApiProperty({ example: 'Минск', description: 'City name' })
  city: string;

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
    description: 'Brand name',
  })
  brandName?: string;

  @ApiPropertyOptional({
    example: 1.5,
    description: 'Distance in kilometers (if location provided)',
  })
  distance?: number;
}
