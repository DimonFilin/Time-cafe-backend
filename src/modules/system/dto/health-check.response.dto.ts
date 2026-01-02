import { ApiProperty } from '@nestjs/swagger';

export class HealthCheckResponseDto {
  @ApiProperty({
    example: 'healthy',
    description: 'Overall health status of the service',
    enum: ['healthy', 'unhealthy'],
  })
  status: 'healthy' | 'unhealthy';

  @ApiProperty({
    example: '2025-11-02T11:31:22.542Z',
    description: 'Timestamp of the health check',
  })
  timestamp: string;

  @ApiProperty({
    example: {
      database: {
        status: 'ok',
        responseTime: 4,
      },
      storage: {
        status: 'ok',
        responseTime: 2,
      },
    },
    description: 'Status of all health checks',
  })
  checks: {
    database: {
      status: 'ok' | 'error';
      message?: string;
      responseTime?: number;
    };
    storage?: {
      status: 'ok' | 'error';
      message?: string;
      responseTime?: number;
    };
    [key: string]:
      | {
          status: 'ok' | 'error';
          message?: string;
          responseTime?: number;
        }
      | undefined;
  };
}
