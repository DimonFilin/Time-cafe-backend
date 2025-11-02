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

  async getMetrics() {
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();

    let databaseConnections = 0;
    try {
      const result = await this.prisma
        .$queryRaw`SELECT count(*) as count FROM pg_stat_activity WHERE datname = current_database()`;
      databaseConnections =
        Array.isArray(result) && result[0] && typeof result[0] === 'object'
          ? Number((result[0] as any).count)
          : 0;
    } catch (error) {
      // If query fails, set to 0
      databaseConnections = 0;
    }

    return {
      uptime: Math.floor(uptime),
      memory: {
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        rss: memoryUsage.rss,
        external: memoryUsage.external,
      },
      database: {
        activeConnections: databaseConnections,
      },
      requests: {
        total: 0,
        successful: 0,
        errors: 0,
      },
      timestamp: new Date().toISOString(),
    };
  }
}

