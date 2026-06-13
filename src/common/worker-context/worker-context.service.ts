import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { Request } from 'express';

export type WorkerRequestUser = {
  sub?: string;
  workerId?: string;
  email?: string;
  role?: string;
  brandId?: string;
  cafeId?: string;
};

function parseTcAccountCookie(req: Request): string | undefined {
  const cookiesJar: unknown = (req as { cookies?: unknown }).cookies;
  if (
    cookiesJar &&
    typeof cookiesJar === 'object' &&
    !Array.isArray(cookiesJar)
  ) {
    const raw = (cookiesJar as Record<string, unknown>).tc_account_id;
    if (typeof raw === 'string' && raw.trim()) {
      return raw.trim();
    }
  }
  const cookieHeader = req.headers?.cookie;
  if (typeof cookieHeader !== 'string') return undefined;
  const part = cookieHeader
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith('tc_account_id='));
  return part?.split('=')[1]?.trim();
}

function decodeJwtSub(authHeader: unknown): string | undefined {
  if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    return undefined;
  }
  const token = authHeader.slice(7);
  const parts = token.split('.');
  if (parts.length < 2) return undefined;
  try {
    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64').toString('utf8'),
    ) as { sub?: string };
    return typeof payload.sub === 'string' ? payload.sub : undefined;
  } catch {
    return undefined;
  }
}

@Injectable()
export class WorkerContextService {
  constructor(private readonly prisma: PrismaService) {}

  /** URL paths where we enrich req.user for @LogActivity / client beacon POST */
  shouldEnrichPath(urlPath: string): boolean {
    if (!urlPath) return false;
    if (urlPath.startsWith('/cafe-worker')) return true;
    if (urlPath.startsWith('/worker/reception')) return true;
    if (urlPath.startsWith('/worker/guests')) return true;
    if (urlPath.startsWith('/admin/guests')) return true;
    if (urlPath.startsWith('/cafe-admin/tasks')) return true;
    if (urlPath.startsWith('/cafe-worker/tasks')) return true;
    if (urlPath.startsWith('/admin/cafes')) return true;
    if (urlPath.startsWith('/order-chats')) return true;
    if (urlPath.startsWith('/brands')) return true;
    if (urlPath.startsWith('/appointments')) return true;
    if (urlPath.startsWith('/admin/transactions')) return true;
    if (urlPath.startsWith('/activity-logs')) return true;
    return false;
  }

  /**
   * Merges workerId, email, role, brandId, cafeId into req.user for activity logging.
   */
  async attachWorkerToRequest(req: Request): Promise<void> {
    const path = (req.path || req.url || '').split('?')[0];
    if (!this.shouldEnrichPath(path)) return;

    const existing = (req as Request & { user?: WorkerRequestUser }).user;
    if (existing?.workerId) return;

    const workerIdCookie = parseTcAccountCookie(req);
    if (workerIdCookie) {
      const worker = await this.prisma.workerAccount.findFirst({
        where: { id: workerIdCookie, deletedAt: null },
        select: {
          id: true,
          email: true,
          role: true,
          brandId: true,
          cafeId: true,
          keycloakId: true,
        },
      });
      if (worker) {
        (req as Request & { user?: WorkerRequestUser }).user = {
          ...existing,
          sub: existing?.sub ?? worker.keycloakId,
          workerId: worker.id,
          email: worker.email,
          role: worker.role,
          brandId: worker.brandId ?? undefined,
          cafeId: worker.cafeId ?? undefined,
        };
        return;
      }
    }

    const keycloakId =
      existing?.sub ??
      decodeJwtSub(req.headers?.authorization) ??
      decodeJwtSub(req.headers?.Authorization);

    if (!keycloakId) return;

    const worker = await this.prisma.workerAccount.findFirst({
      where: { keycloakId, deletedAt: null },
      select: {
        id: true,
        email: true,
        role: true,
        brandId: true,
        cafeId: true,
        keycloakId: true,
      },
    });

    if (!worker) return;

    (req as Request & { user?: WorkerRequestUser }).user = {
      ...existing,
      sub: keycloakId,
      workerId: worker.id,
      email: worker.email,
      role: worker.role,
      brandId: worker.brandId ?? undefined,
      cafeId: worker.cafeId ?? undefined,
    };
  }
}
