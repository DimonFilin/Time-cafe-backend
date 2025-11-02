import { Injectable } from '@nestjs/common';

@Injectable()
export class MetricsService {
  private requestCount = 0;
  private successCount = 0;
  private errorCount = 0;
  private responseTimes: number[] = [];

  recordRequest(type: 'success' | 'error', responseTime: number): void {
    this.requestCount++;
    if (type === 'success') {
      this.successCount++;
    } else {
      this.errorCount++;
    }
    this.responseTimes.push(responseTime);
    if (this.responseTimes.length > 1000) {
      this.responseTimes.shift();
    }
  }

  getMetrics() {
    const avgResponseTime =
      this.responseTimes.length > 0
        ? Math.round(
            this.responseTimes.reduce((a, b) => a + b, 0) /
              this.responseTimes.length,
          )
        : 0;

    return {
      total: this.requestCount,
      successful: this.successCount,
      errors: this.errorCount,
      avgResponseTime,
    };
  }

  reset(): void {
    this.requestCount = 0;
    this.successCount = 0;
    this.errorCount = 0;
    this.responseTimes = [];
  }
}

