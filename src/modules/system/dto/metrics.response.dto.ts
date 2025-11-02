import { ApiProperty } from '@nestjs/swagger';

class MemoryMetricsDto {
  @ApiProperty({ example: 45678912, description: 'Used heap memory in bytes' })
  heapUsed: number;

  @ApiProperty({ example: 67108864, description: 'Total heap memory in bytes' })
  heapTotal: number;

  @ApiProperty({ example: 123456789, description: 'Resident set size in bytes' })
  rss: number;

  @ApiProperty({
    example: 2222404,
    description: 'External memory used in bytes',
  })
  external: number;
}

class DatabaseMetricsDto {
  @ApiProperty({
    example: 5,
    description: 'Number of active database connections',
  })
  activeConnections: number;
}

class RequestMetricsDto {
  @ApiProperty({ example: 1500, description: 'Total number of requests' })
  total: number;

  @ApiProperty({
    example: 1450,
    description: 'Number of successful requests',
  })
  successful: number;

  @ApiProperty({ example: 50, description: 'Number of error requests' })
  errors: number;

  @ApiProperty({
    example: 12,
    description: 'Average response time in milliseconds',
  })
  avgResponseTime: number;
}

export class MetricsResponseDto {
  @ApiProperty({
    example: 3600,
    description: 'Server uptime in seconds',
  })
  uptime: number;

  @ApiProperty({ type: MemoryMetricsDto, description: 'Memory usage metrics' })
  memory: MemoryMetricsDto;

  @ApiProperty({
    type: DatabaseMetricsDto,
    description: 'Database connection metrics',
  })
  database: DatabaseMetricsDto;

  @ApiProperty({
    type: RequestMetricsDto,
    description: 'Request statistics metrics',
  })
  requests: RequestMetricsDto;

  @ApiProperty({
    example: '2025-11-02T11:31:22.542Z',
    description: 'Timestamp of the metrics',
  })
  timestamp: string;
}

