import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SystemService } from './system.service';
import { HealthCheckResponseDto } from './dto/health-check.response.dto';
import { PingResponseDto } from './dto/ping.response.dto';
import { MetricsResponseDto } from './dto/metrics.response.dto';

@ApiTags('System')
@Controller('system')
export class SystemController {
  constructor(private readonly systemService: SystemService) {}

  @Get('health-check')
  @ApiOperation({
    summary: 'Health check endpoint',
    description: 'Check the health status of the service and all dependencies (database, etc.)',
  })
  @ApiResponse({
    status: 200,
    description: 'Service is healthy',
    type: HealthCheckResponseDto,
  })
  @ApiResponse({
    status: 503,
    description: 'Service is unhealthy',
    type: HealthCheckResponseDto,
  })
  async healthCheck(): Promise<HealthCheckResponseDto> {
    return this.systemService.healthCheck();
  }

  @Get('ping')
  @ApiOperation({
    summary: 'Ping endpoint',
    description: 'Simple ping to check if server is responding. No database checks.',
  })
  @ApiResponse({
    status: 200,
    description: 'Server is responding',
    type: PingResponseDto,
  })
  ping(): PingResponseDto {
    return this.systemService.ping();
  }

  @Get('metrics')
  @ApiOperation({
    summary: 'Metrics endpoint',
    description: 'Get system metrics including request counts, response times, memory usage, and database connections',
  })
  @ApiResponse({
    status: 200,
    description: 'Metrics retrieved successfully',
    type: MetricsResponseDto,
  })
  async metrics(): Promise<MetricsResponseDto> {
    return this.systemService.getMetrics();
  }
}
