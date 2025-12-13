import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { HealthCheckResponseDto } from './dto/health-check.response.dto';
import { PingResponseDto } from './dto/ping.response.dto';
import { MetricsResponseDto } from './dto/metrics.response.dto';
import { MetricsService } from './metrics.service';

@Injectable()
export class SystemService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metricsService: MetricsService,
  ) {}

  async healthCheck(): Promise<HealthCheckResponseDto> {
    const checks: HealthCheckResponseDto['checks'] = {
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

  ping(): PingResponseDto {
    return {
      status: 'ok',
      message: 'pong',
      timestamp: new Date().toISOString(),
    };
  }

  async getMetrics(): Promise<MetricsResponseDto> {
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();

    let databaseConnections = 0;
    try {
      const result = await this.prisma.$queryRaw<
        Array<{ count: bigint }>
      >`SELECT count(*) as count FROM pg_stat_activity WHERE datname = current_database()`;
      databaseConnections =
        Array.isArray(result) && result[0] && typeof result[0] === 'object'
          ? Number(result[0].count)
          : 0;
    } catch {
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
      requests: this.metricsService.getMetrics(),
      timestamp: new Date().toISOString(),
    };
  }
}
