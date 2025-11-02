import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  checks: {
    database: {
      status: 'ok' | 'error';
      message?: string;
      responseTime?: number;
    };
    [key: string]: {
      status: 'ok' | 'error';
      message?: string;
      responseTime?: number;
    };
  };
}

@Injectable()
export class SystemService {
  constructor(private readonly prisma: PrismaService) {}

  async healthCheck(): Promise<HealthStatus> {
    const checks: HealthStatus['checks'] = {
      database: await this.checkDatabase(),
    };

    const allHealthy = Object.values(checks).every(
      (check) => check.status === 'ok',
    );

    return {
      status: allHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      checks,
    };
  }

  private async checkDatabase(): Promise<{
    status: 'ok' | 'error';
    message?: string;
    responseTime?: number;
  }> {
    const startTime = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      const responseTime = Date.now() - startTime;
      return {
        status: 'ok',
        responseTime,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
        responseTime,
      };
    }
  }

  ping() {
    return {
      status: 'ok',
      message: 'pong',
      timestamp: new Date().toISOString(),
    };
  }
}

