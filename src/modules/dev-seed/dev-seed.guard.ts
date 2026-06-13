import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class DevSeedGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    if (this.config.get<string>('NODE_ENV') === 'production') {
      throw new ForbiddenException(
        'Dev seed endpoints are disabled in production',
      );
    }

    const secret = this.config.get<string>('DEV_SEED_SECRET');
    if (!secret) {
      throw new ForbiddenException('DEV_SEED_SECRET is not configured');
    }

    const req = context.switchToHttp().getRequest<Request>();
    const header = req.headers['x-dev-seed-secret'];
    if (header !== secret) {
      throw new ForbiddenException('Invalid dev seed secret');
    }

    return true;
  }
}
