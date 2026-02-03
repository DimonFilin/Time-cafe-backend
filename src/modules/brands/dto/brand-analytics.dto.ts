import { ApiProperty } from '@nestjs/swagger';

export class BrandOrdersAnalyticsDto {
  @ApiProperty({
    example: 150,
    description: 'Total number of orders',
  })
  totalOrders: number;

  @ApiProperty({
    example: 12500.5,
    description: 'Total revenue',
  })
  totalRevenue: number;

  @ApiProperty({
    example: 2500.1,
    description: 'Revenue for the current period',
  })
  periodRevenue: number;

  @ApiProperty({
    example: 35,
    description: 'Number of orders for the current period',
  })
  periodOrders: number;

  @ApiProperty({
    example: [
      { date: '2024-01-01', orders: 5, revenue: 500.0 },
      { date: '2024-01-02', orders: 8, revenue: 800.0 },
    ],
    description: 'Daily orders and revenue trend',
  })
  dailyTrends: Array<{
    date: string;
    orders: number;
    revenue: number;
  }>;

  @ApiProperty({
    example: [
      { month: 'January', orders: 120, revenue: 12000.0 },
      { month: 'February', orders: 130, revenue: 13000.0 },
    ],
    description: 'Monthly orders and revenue trend',
  })
  monthlyTrends: Array<{
    month: string;
    orders: number;
    revenue: number;
  }>;
}

export class BrandPopularItemsDto {
  @ApiProperty({
    example: [
      { name: 'Espresso', count: 250, percentage: 35.5 },
      { name: 'Cappuccino', count: 180, percentage: 25.6 },
      { name: 'Croissant', count: 120, percentage: 17.0 },
    ],
    description: 'Most popular items ordered',
  })
  popularItems: Array<{
    name: string;
    count: number;
    percentage: number;
  }>;

  @ApiProperty({
    example: [
      { cafeId: 'uuid', cafeName: 'Main Street Cafe', totalOrders: 45 },
      { cafeId: 'uuid2', cafeName: 'Downtown Cafe', totalOrders: 32 },
    ],
    description: 'Orders distribution by cafe',
  })
  cafePerformance: Array<{
    cafeId: string;
    cafeName: string;
    totalOrders: number;
  }>;
}

export class BrandAnalyticsResponseDto {
  @ApiProperty({
    description: 'Basic brand statistics',
    type: 'object',
    additionalProperties: true,
  })
  basicStats: any; // Will reference BrandStatsDto

  @ApiProperty({
    description: 'Order analytics',
    type: BrandOrdersAnalyticsDto,
  })
  orders: BrandOrdersAnalyticsDto;

  @ApiProperty({
    description: 'Popular items analytics',
    type: BrandPopularItemsDto,
  })
  popularItems: BrandPopularItemsDto;

  @ApiProperty({
    description: 'Generated timestamp',
  })
  generatedAt: Date;
}
