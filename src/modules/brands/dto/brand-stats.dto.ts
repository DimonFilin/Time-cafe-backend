import { ApiProperty } from '@nestjs/swagger';

export class BrandStatsDto {
  @ApiProperty({
    example: 10,
    description: 'Total number of cafes',
  })
  totalCafes: number;

  @ApiProperty({
    example: 10,
    description: 'Number of active cafes (non-deleted)',
  })
  activeCafes: number;

  @ApiProperty({
    example: 4.5,
    description: 'Average rating across all cafes',
  })
  averageRating: number;

  @ApiProperty({
    example: 150,
    description: 'Total number of reviews',
  })
  totalReviews: number;

  @ApiProperty({
    example: { Moscow: 5, 'Saint Petersburg': 3, Kazan: 2 },
    description: 'Number of cafes by city',
  })
  cafesByCity: Record<string, number>;

  @ApiProperty({
    example: { 'Moscow Region': 5, 'Saint Petersburg Region': 3 },
    description: 'Number of cafes by region',
  })
  cafesByRegion: Record<string, number>;
}
