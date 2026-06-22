import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { ForbiddenException, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { WorkerRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

type SocketCtx = {
  keycloakId?: string;
  workerId?: string;
  role?: WorkerRole;
  cafeId?: string | null;
  brandId?: string | null;
};

@WebSocketGateway({
  namespace: '/cafe-realtime',
  cors: {
    origin: true,
    credentials: true,
  },
})
export class CafeRealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(CafeRealtimeGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(private readonly prisma: PrismaService) {}

  emitOrderUpdated(cafeId: string, order: unknown) {
    this.server.to(`cafe:${cafeId}`).emit('order:updated', order);
  }

  emitAppointmentUpdated(cafeId: string, appointment: unknown) {
    this.server.to(`cafe:${cafeId}`).emit('appointment:updated', appointment);
  }

  private extractBearerToken(client: Socket): string | null {
    const authToken: unknown = client.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken.trim()) {
      return authToken.replace(/^Bearer\s+/i, '').trim();
    }
    const rawHeader =
      client.handshake.headers.authorization ||
      client.handshake.headers.Authorization;
    if (typeof rawHeader === 'string' && rawHeader.trim()) {
      return rawHeader.replace(/^Bearer\s+/i, '').trim();
    }

    const cookieHeader = client.handshake.headers.cookie;
    if (typeof cookieHeader !== 'string' || !cookieHeader.trim()) return null;
    const cookies = cookieHeader.split(';').map((part) => part.trim());
    const accessCookie =
      cookies.find((c) => c.startsWith('tc_access=')) ||
      cookies.find((c) => c.startsWith('KEYCLOAK_JWT='));
    if (!accessCookie) return null;
    return decodeURIComponent(accessCookie.split('=').slice(1).join('='));
  }

  private extractSubFromJwt(token: string): string | null {
    try {
      const parts = token.split('.');
      if (parts.length < 2) return null;
      const payload = Buffer.from(parts[1], 'base64url').toString('utf-8');
      const parsed = JSON.parse(payload) as { sub?: string };
      return parsed.sub ?? null;
    } catch {
      return null;
    }
  }

  private async resolveWorker(keycloakId: string) {
    return this.prisma.workerAccount.findFirst({
      where: {
        deletedAt: null,
        OR: [{ keycloakId }, { id: keycloakId }],
      },
      select: {
        id: true,
        role: true,
        cafeId: true,
        brandId: true,
      },
    });
  }

  private async canAccessCafe(
    worker: NonNullable<Awaited<ReturnType<typeof this.resolveWorker>>>,
    cafeId: string,
  ): Promise<boolean> {
    if (worker.role === WorkerRole.SYSTEM_ADMIN) return true;
    if (worker.role === WorkerRole.BRAND_ADMIN) {
      const cafe = await this.prisma.cafe.findUnique({
        where: { id: cafeId },
        select: { brandId: true },
      });
      return !!cafe && cafe.brandId === worker.brandId;
    }
    if (
      worker.role === WorkerRole.CAFE_ADMIN ||
      worker.role === WorkerRole.WORKER
    ) {
      return worker.cafeId === cafeId;
    }
    return false;
  }

  async handleConnection(client: Socket) {
    const token = this.extractBearerToken(client);
    const keycloakId = token ? this.extractSubFromJwt(token) : null;
    if (!keycloakId) {
      client.disconnect(true);
      return;
    }

    const worker = await this.resolveWorker(keycloakId);
    if (!worker) {
      client.disconnect(true);
      return;
    }

    (client.data as SocketCtx).keycloakId = keycloakId;
    (client.data as SocketCtx).workerId = worker.id;
    (client.data as SocketCtx).role = worker.role;
    (client.data as SocketCtx).cafeId = worker.cafeId;
    (client.data as SocketCtx).brandId = worker.brandId;
  }

  handleDisconnect() {
    // no-op
  }

  @SubscribeMessage('cafe:join')
  async joinCafe(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { cafeId?: string },
  ) {
    const cafeId = String(payload?.cafeId ?? '').trim();
    const ctx = client.data as SocketCtx;
    if (!cafeId || !ctx.workerId || !ctx.role) {
      return { ok: false };
    }

    const worker = await this.resolveWorker(ctx.keycloakId!);
    if (!worker) return { ok: false };

    const allowed = await this.canAccessCafe(worker, cafeId);
    if (!allowed) {
      throw new ForbiddenException('No access to cafe');
    }

    await client.join(`cafe:${cafeId}`);
    return { ok: true, cafeId };
  }
}
