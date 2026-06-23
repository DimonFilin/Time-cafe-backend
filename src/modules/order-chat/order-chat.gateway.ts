import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { OrderChatService } from './order-chat.service';
import { SendChatMessageDto } from './dto';
import { WorkerRole } from '@prisma/client';

type SocketCtx = {
  keycloakId?: string;
  actor?: {
    kind: 'user' | 'worker';
    id: string;
    brandId?: string | null;
    role?: WorkerRole;
  };
  chatId?: string;
};

@WebSocketGateway({
  namespace: '/order-chats',
  cors: {
    origin: true,
    credentials: true,
  },
})
export class OrderChatGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(private readonly orderChatService: OrderChatService) {}

  emitChatListUpdate(
    chatId: string,
    routing: {
      userId: string;
      workerIds: string[];
      brandId: string | null;
      cafeId: string;
    },
  ) {
    this.server
      .to(`user:${routing.userId}`)
      .emit('chat:list:update', { chatId });
    routing.workerIds.forEach((workerId) => {
      this.server.to(`worker:${workerId}`).emit('chat:list:update', { chatId });
    });
    this.server
      .to(`cafe:${routing.cafeId}`)
      .emit('chat:list:update', { chatId });
    if (routing.brandId) {
      this.server
        .to(`brand:${routing.brandId}`)
        .emit('chat:list:update', { chatId });
    }
  }

  emitMessageCreated(
    chatId: string,
    payload: {
      message: unknown;
      routing: {
        userId: string;
        workerIds: string[];
        brandId: string | null;
        cafeId: string;
      };
    },
  ) {
    this.server.to(`chat:${chatId}`).emit('chat:message:new', payload.message);
    this.server
      .to(`user:${payload.routing.userId}`)
      .emit('chat:unread:update', { chatId });
    payload.routing.workerIds.forEach((workerId) => {
      this.server
        .to(`worker:${workerId}`)
        .emit('chat:unread:update', { chatId });
    });
    this.emitChatListUpdate(chatId, payload.routing);
  }

  emitUnreadUpdate(
    chatId: string,
    actor: {
      kind: 'user' | 'worker';
      id: string;
      brandId?: string | null;
    },
  ) {
    if (actor.kind === 'user') {
      this.server.to(`user:${actor.id}`).emit('chat:unread:update', { chatId });
      return;
    }
    this.server.to(`worker:${actor.id}`).emit('chat:unread:update', { chatId });
  }

  private extractTcAccountId(client: Socket): string | null {
    const cookieHeader = client.handshake.headers.cookie;
    if (typeof cookieHeader !== 'string' || !cookieHeader.trim()) return null;
    const cookies = cookieHeader.split(';').map((part) => part.trim());
    const accountCookie = cookies.find((c) => c.startsWith('tc_account_id='));
    if (!accountCookie) return null;
    return (
      decodeURIComponent(accountCookie.split('=').slice(1).join('=')).trim() ||
      null
    );
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

  private async resolveActorFromSocket(client: Socket) {
    const accountId = this.extractTcAccountId(client);
    if (accountId) {
      return this.orderChatService.resolveActorByAccountId(accountId);
    }
    const token = this.extractBearerToken(client);
    const keycloakId = token ? this.extractSubFromJwt(token) : null;
    if (!keycloakId) {
      throw new Error('Unauthorized');
    }
    return this.orderChatService.resolveActorByKeycloakId(keycloakId);
  }

  async handleConnection(client: Socket) {
    try {
      const actor = await this.resolveActorFromSocket(client);
      (client.data as SocketCtx).keycloakId = actor.keycloakId;
      (client.data as SocketCtx).actor = {
        kind: actor.kind,
        id: actor.id,
        brandId: actor.kind === 'worker' ? actor.brandId : null,
        role: actor.kind === 'worker' ? actor.role : undefined,
      };

      if (actor.kind === 'user') {
        await client.join(`user:${actor.id}`);
      } else {
        await client.join(`worker:${actor.id}`);
        if (actor.brandId) {
          await client.join(`brand:${actor.brandId}`);
        }
        if (actor.cafeId) {
          await client.join(`cafe:${actor.cafeId}`);
        }
      }
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    const chatId = (client.data as SocketCtx).chatId;
    if (chatId) {
      this.server.to(`chat:${chatId}`).emit('chat:typing', {
        chatId,
        typing: false,
      });
    }
  }

  @SubscribeMessage('chat:join')
  async joinChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { chatId: string },
  ) {
    const actorCtx = (client.data as SocketCtx).actor;
    if (!actorCtx) return { ok: false };
    const actor = await this.resolveActorFromSocket(client);
    await this.orderChatService.getMessages(payload.chatId, actor, 1, 1);
    await client.join(`chat:${payload.chatId}`);
    (client.data as SocketCtx).chatId = payload.chatId;
    return { ok: true };
  }

  @SubscribeMessage('chat:leave')
  async leaveChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { chatId: string },
  ) {
    await client.leave(`chat:${payload.chatId}`);
    (client.data as SocketCtx).chatId = undefined;
    return { ok: true };
  }

  @SubscribeMessage('chat:message')
  async sendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { chatId: string; dto: SendChatMessageDto },
  ) {
    const actorCtx = (client.data as SocketCtx).actor;
    if (!actorCtx) return { ok: false };
    const actor = await this.resolveActorFromSocket(client);
    const result = await this.orderChatService.sendMessage(
      payload.chatId,
      actor,
      payload.dto,
    );
    this.emitMessageCreated(payload.chatId, result);
    return { ok: true, message: result.message };
  }

  @SubscribeMessage('chat:typing')
  async typing(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { chatId: string; typing: boolean },
  ) {
    const actorCtx = (client.data as SocketCtx).actor;
    if (!actorCtx) return { ok: false };
    const actor = await this.resolveActorFromSocket(client);
    const typingState = await this.orderChatService.setTyping(
      payload.chatId,
      actor,
      payload.typing,
    );
    client.to(`chat:${payload.chatId}`).emit('chat:typing', {
      chatId: payload.chatId,
      typing: typingState.typing,
      actorType: actor.kind,
      actorId: actor.id,
    });
    return { ok: true };
  }
}
