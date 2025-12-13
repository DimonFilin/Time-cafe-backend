import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { MetricsService } from '../metrics.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<{ url: string }>();
    const url = request.url;

    if (url?.startsWith('/system/metrics')) {
      return next.handle();
    }

    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const responseTime = Date.now() - startTime;
          this.metricsService.recordRequest('success', responseTime);
        },
        error: () => {
          const responseTime = Date.now() - startTime;
          this.metricsService.recordRequest('error', responseTime);
        },
      }),
    );
  }
}
