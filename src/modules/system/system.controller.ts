import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SystemService } from './system.service';

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
    schema: {
      example: {
        status: 'healthy',
        timestamp: '2025-11-02T11:31:22.542Z',
        checks: {
          database: {
            status: 'ok',
            responseTime: 4,
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 503,
    description: 'Service is unhealthy',
    schema: {
      example: {
        status: 'unhealthy',
        timestamp: '2025-11-02T11:31:22.542Z',
        checks: {
          database: {
            status: 'error',
            message: 'Connection timeout',
            responseTime: 5000,
          },
        },
      },
    },
  })
  async healthCheck() {
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
    schema: {
      example: {
        status: 'ok',
        message: 'pong',
        timestamp: '2025-11-02T11:31:22.542Z',
      },
    },
  })
  ping() {
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
    schema: {
      example: {
        uptime: 3600,
        memory: {
          heapUsed: 45678912,
          heapTotal: 67108864,
          rss: 123456789,
        },
        database: {
          activeConnections: 5,
        },
        requests: {
          total: 1500,
          successful: 1450,
          errors: 50,
        },
        timestamp: '2025-11-02T11:31:22.542Z',
      },
    },
  })
  async metrics() {
    return this.systemService.getMetrics();
  }
}

