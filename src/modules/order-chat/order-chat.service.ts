import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityAction,
  ActivityCategory,
  ChatAttachmentStatus,
  ChatAuthorType,
  ChatMessageType,
  ChatNotificationMode,
  Prisma,
  WorkerRole,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import {
  ChatListQueryDto,
  ChatMessageDto,
  ChatSummaryDto,
  MarkChatReadDto,
  SendChatMessageDto,
  UpdateChatSettingsDto,
} from './dto';

type Actor =
  | { kind: 'user'; id: string; keycloakId: string }
  | {
      kind: 'worker';
      id: string;
      keycloakId: string;
      email: string;
      role: WorkerRole;
      cafeId: string | null;
      brandId: string | null;
    };

const orderChatMessageInclude = {
  attachments: { orderBy: { sortOrder: 'asc' as const } },
  authorWorker: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      avatar: true,
      cafe: { select: { name: true } },
    },
  },
};

@Injectable()
export class OrderChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly activityLogsService: ActivityLogsService,
  ) {}

  private async logWorkerActivity(
    actor: Actor,
    params: {
      action: ActivityAction;
      category: ActivityCategory;
      resourceType?: string;
      resourceId?: string;
      details?: Prisma.InputJsonValue;
    },
  ): Promise<void> {
    if (actor.kind !== 'worker') return;
    await this.activityLogsService.log({
      workerId: actor.id,
      workerEmail: actor.email,
      workerRole: actor.role,
      brandId: actor.brandId ?? undefined,
      cafeId: actor.cafeId ?? undefined,
      action: params.action,
      category: params.category,
      resourceType: params.resourceType ?? 'ORDER_CHAT',
      resourceId: params.resourceId,
      details: params.details,
    });
  }

  private async resolveAttachmentUrl(
    bucket: string,
    path: string,
  ): Promise<string> {
    // Presigned host выбирается в StorageService (STORAGE_PUBLIC_ENDPOINT / BACKEND_FILE_SYSTEM_* / LAN при localhost).
    return this.storageService.getFileUrl(bucket, path);
  }

  private parseStorageRef(
    input: string,
  ): { bucket: string; key: string } | null {
    const raw = String(input || '').trim();
    if (!raw) return null;
    const direct = raw.match(/^(users|public|brands|cafes)\/(.+)$/);
    if (direct) return { bucket: direct[1], key: direct[2] };
    const urlMatch = raw.match(/\/(users|public|brands|cafes)\/(.+)$/);
    if (urlMatch)
      return { bucket: urlMatch[1], key: decodeURIComponent(urlMatch[2]) };
    return null;
  }

  private async resolveUserAvatarUrl(
    avatar: string | null,
  ): Promise<string | null> {
    if (!avatar) return null;
    const ref = this.parseStorageRef(avatar);
    if (!ref) {
      return /^https?:\/\//i.test(avatar) ? avatar : null;
    }
    try {
      return await this.resolveAttachmentUrl(ref.bucket, ref.key);
    } catch {
      return null;
    }
  }

  async resolveActorByKeycloakId(keycloakId: string): Promise<Actor> {
    const worker = await this.prisma.workerAccount.findFirst({
      where: {
        deletedAt: null,
        OR: [{ keycloakId }, { id: keycloakId }],
      },
      select: {
        id: true,
        keycloakId: true,
        email: true,
        role: true,
        cafeId: true,
        brandId: true,
      },
    });
    if (worker) {
      return {
        kind: 'worker',
        id: worker.id,
        keycloakId: worker.keycloakId,
        email: worker.email,
        role: worker.role,
        cafeId: worker.cafeId,
        brandId: worker.brandId,
      };
    }

    const user = await this.prisma.user.findFirst({
      where: {
        deletedAt: null,
        OR: [{ keycloakId }, { id: keycloakId }],
      },
      select: { id: true, keycloakId: true },
    });
    if (user) {
      return { kind: 'user', id: user.id, keycloakId: user.keycloakId };
    }

    throw new ForbiddenException('Account not found');
  }

  parseTcAccountIdFromCookie(cookieHeader?: string): string | undefined {
    if (!cookieHeader || typeof cookieHeader !== 'string') return undefined;
    const part = cookieHeader
      .split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith('tc_account_id='));
    const raw = part?.split('=').slice(1).join('=');
    return raw ? decodeURIComponent(raw).trim() : undefined;
  }

  async resolveActorByAccountId(accountId: string): Promise<Actor> {
    const worker = await this.prisma.workerAccount.findFirst({
      where: { id: accountId, deletedAt: null },
      select: {
        id: true,
        keycloakId: true,
        email: true,
        role: true,
        cafeId: true,
        brandId: true,
      },
    });
    if (worker) {
      return {
        kind: 'worker',
        id: worker.id,
        keycloakId: worker.keycloakId,
        email: worker.email,
        role: worker.role,
        cafeId: worker.cafeId,
        brandId: worker.brandId,
      };
    }

    const user = await this.prisma.user.findFirst({
      where: { id: accountId, deletedAt: null },
      select: { id: true, keycloakId: true },
    });
    if (user) {
      return { kind: 'user', id: user.id, keycloakId: user.keycloakId };
    }

    throw new ForbiddenException('Account not found');
  }

  async resolveActorFromRequest(req: {
    headers?: { cookie?: string };
    user?: { sub?: string };
  }): Promise<Actor> {
    const accountId = this.parseTcAccountIdFromCookie(req.headers?.cookie);
    if (accountId) {
      return this.resolveActorByAccountId(accountId);
    }
    const keycloakId = req.user?.sub;
    if (!keycloakId) {
      throw new BadRequestException('User ID not found in token');
    }
    return this.resolveActorByKeycloakId(keycloakId);
  }

  private async ensureChatAccess(chatId: string, actor: Actor) {
    const chat = await this.prisma.orderChat.findUnique({
      where: { id: chatId },
      include: {
        order: { select: { id: true, userId: true, cafeId: true } },
        cafe: { select: { chatSettings: true } },
      },
    });
    if (!chat) throw new NotFoundException('Chat not found');

    if (actor.kind === 'user') {
      if (chat.userId !== actor.id) throw new ForbiddenException('Forbidden');
      return chat;
    }

    if (actor.role === WorkerRole.SYSTEM_ADMIN) return chat;
    if (actor.role === WorkerRole.BRAND_ADMIN) {
      if (!actor.brandId || actor.brandId !== chat.brandId) {
        throw new ForbiddenException('Forbidden');
      }
      return chat;
    }

    if (!actor.cafeId || actor.cafeId !== chat.cafeId) {
      throw new ForbiddenException('Forbidden');
    }
    return chat;
  }

  private resolveCafeChatEnabled(chatSettings: unknown): boolean {
    if (!chatSettings || typeof chatSettings !== 'object') return true;
    const raw = (chatSettings as Record<string, unknown>).enabled;
    return typeof raw === 'boolean' ? raw : true;
  }

  private async toAuthorWorkerDto(
    worker:
      | {
          id: string;
          firstName: string;
          lastName: string;
          avatar: string | null;
          cafe?: { name: string } | null;
        }
      | null
      | undefined,
  ) {
    if (!worker) return null;
    return {
      id: worker.id,
      firstName: worker.firstName,
      lastName: worker.lastName,
      avatarUrl: await this.resolveUserAvatarUrl(worker.avatar),
      cafeName: worker.cafe?.name ?? null,
    };
  }

  private async toMessageDto(message: {
    id: string;
    chatId: string;
    authorType: ChatAuthorType;
    authorUserId: string | null;
    authorWorkerId: string | null;
    messageType: ChatMessageType;
    text: string | null;
    createdAt: Date;
    authorWorker?: {
      id: string;
      firstName: string;
      lastName: string;
      avatar: string | null;
      cafe?: { name: string } | null;
    } | null;
    attachments?: Array<{
      id: string;
      bucket?: string;
      path?: string;
      url: string;
      mimeType: string;
      size: number;
      sortOrder: number;
    }>;
  }): Promise<ChatMessageDto> {
    const resolvedAttachments = await Promise.all(
      (message.attachments || []).map(async (a) => {
        let url = a.url;
        if (a.bucket && a.path) {
          try {
            url = await this.resolveAttachmentUrl(a.bucket, a.path);
          } catch {
            // keep persisted URL as fallback
          }
        }
        return {
          id: a.id,
          url,
          mimeType: a.mimeType,
          size: a.size,
          sortOrder: a.sortOrder,
        };
      }),
    );
    return {
      id: message.id,
      chatId: message.chatId,
      authorType: message.authorType,
      authorUserId: message.authorUserId,
      authorWorkerId: message.authorWorkerId,
      authorWorker: await this.toAuthorWorkerDto(message.authorWorker),
      messageType: message.messageType,
      text: message.text,
      createdAt: message.createdAt,
      attachments: resolvedAttachments,
    };
  }

  private async resolveWorkerRecipients(chat: {
    cafeId: string;
    notificationMode: ChatNotificationMode;
    notificationRoles: WorkerRole[];
    notificationWorkerIds: string[];
  }): Promise<string[]> {
    if (chat.notificationMode === ChatNotificationMode.SPECIFIC_WORKERS) {
      return [...new Set(chat.notificationWorkerIds || [])];
    }

    const where: Prisma.WorkerAccountWhereInput = {
      deletedAt: null,
      cafeId: chat.cafeId,
      role: {
        in:
          chat.notificationMode === ChatNotificationMode.ROLE_BASED &&
          (chat.notificationRoles || []).length
            ? chat.notificationRoles
            : [WorkerRole.WORKER, WorkerRole.CAFE_ADMIN],
      },
    };

    const workers = await this.prisma.workerAccount.findMany({
      where,
      select: { id: true },
    });
    return workers.map((w) => w.id);
  }

  private async cleanupExpiredOrphanAttachments(chatId: string) {
    const threshold = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await this.prisma.orderChatAttachment.deleteMany({
      where: {
        chatId,
        messageId: null,
        createdAt: { lt: threshold },
      },
    });
  }

  async getOrCreateByOrder(orderId: string, actor: Actor) {
    let order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        cafe: { select: { id: true, brandId: true, chatSettings: true } },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            avatar: true,
          },
        },
        appointment: {
          select: {
            id: true,
            dateTime: true,
            duration: true,
            status: true,
            notes: true,
            orders: {
              select: {
                id: true,
                orderNumber: true,
                status: true,
                totalAmount: true,
                createdAt: true,
              },
              orderBy: { createdAt: 'desc' },
            },
          },
        },
      },
    });
    if (!order) {
      // Fallback: allow passing booking/appointment id for chat entry from booking screen
      order = await this.prisma.order.findFirst({
        where: { appointmentId: orderId },
        orderBy: { createdAt: 'desc' },
        include: {
          cafe: { select: { id: true, brandId: true, chatSettings: true } },
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              avatar: true,
            },
          },
          appointment: {
            select: {
              id: true,
              dateTime: true,
              duration: true,
              status: true,
              notes: true,
              orders: {
                select: {
                  id: true,
                  orderNumber: true,
                  status: true,
                  totalAmount: true,
                  createdAt: true,
                },
                orderBy: { createdAt: 'desc' },
              },
            },
          },
        },
      });
    }
    if (!order) throw new NotFoundException('Order not found');

    if (actor.kind === 'user' && order.userId !== actor.id) {
      throw new ForbiddenException('Forbidden');
    }
    if (
      actor.kind === 'worker' &&
      actor.role !== WorkerRole.SYSTEM_ADMIN &&
      actor.role === WorkerRole.BRAND_ADMIN &&
      actor.brandId !== order.cafe.brandId
    ) {
      throw new ForbiddenException('Forbidden');
    }
    if (
      actor.kind === 'worker' &&
      actor.role !== WorkerRole.SYSTEM_ADMIN &&
      actor.role !== WorkerRole.BRAND_ADMIN &&
      actor.cafeId !== order.cafeId
    ) {
      throw new ForbiddenException('Forbidden');
    }

    let chat = await this.prisma.orderChat.findUnique({
      where: { orderId: order.id },
      include: {
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          include: orderChatMessageInclude,
        },
      },
    });
    if (!chat) {
      try {
        chat = await this.prisma.orderChat.create({
          data: {
            orderId: order.id,
            cafeId: order.cafeId,
            userId: order.userId,
            brandId: order.cafe.brandId,
          },
          include: {
            messages: {
              take: 1,
              orderBy: { createdAt: 'desc' },
              include: orderChatMessageInclude,
            },
          },
        });
      } catch (error) {
        // Race-safe get-or-create: if another request created chat concurrently, fetch it.
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          chat = await this.prisma.orderChat.findUniqueOrThrow({
            where: { orderId: order.id },
            include: {
              messages: {
                take: 1,
                orderBy: { createdAt: 'desc' },
                include: orderChatMessageInclude,
              },
            },
          });
        } else {
          throw error;
        }
      }
    }

    const avatarUrl = await this.resolveUserAvatarUrl(order.user.avatar);
    await this.logWorkerActivity(actor, {
      action: ActivityAction.VIEW_DETAIL,
      category: ActivityCategory.VIEW,
      resourceType: 'ORDER_CHAT',
      resourceId: chat.id,
      details: { orderId: order.id },
    });
    return {
      id: chat.id,
      orderId: chat.orderId,
      cafeId: chat.cafeId,
      userId: chat.userId,
      isEnabled: this.resolveCafeChatEnabled(order.cafe.chatSettings),
      notificationMode: chat.notificationMode,
      unreadCount: 0,
      updatedAt: chat.updatedAt,
      user: {
        id: order.user.id,
        firstName: order.user.firstName,
        lastName: order.user.lastName,
        email: order.user.email,
        phone: order.user.phone,
        avatarUrl,
      },
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        totalAmount: order.totalAmount ? String(order.totalAmount) : null,
        createdAt: order.createdAt,
        appointmentId: order.appointmentId,
      },
      appointment: order.appointment
        ? {
            id: order.appointment.id,
            dateTime: order.appointment.dateTime,
            duration: order.appointment.duration,
            status: order.appointment.status,
            notes: order.appointment.notes,
            orders: order.appointment.orders.map((o) => ({
              id: o.id,
              orderNumber: o.orderNumber,
              status: o.status,
              totalAmount: o.totalAmount ? String(o.totalAmount) : null,
              createdAt: o.createdAt,
            })),
          }
        : null,
      lastMessage: chat.messages[0]
        ? await this.toMessageDto(chat.messages[0])
        : null,
    };
  }

  async list(actor: Actor, query: ChatListQueryDto) {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 20);
    const skip = (page - 1) * limit;

    const where: Prisma.OrderChatWhereInput = {};
    if (query.cafeId) where.cafeId = query.cafeId;
    if (query.orderId) where.orderId = query.orderId;
    if (query.status || query.from || query.to) {
      const orderIs: Prisma.OrderWhereInput = {};
      if (query.status) {
        orderIs.status = query.status;
      }
      if (query.from || query.to) {
        const createdAtFilter: Prisma.DateTimeFilter = {};
        if (query.from) createdAtFilter.gte = new Date(query.from);
        if (query.to) {
          const end = new Date(query.to);
          end.setHours(23, 59, 59, 999);
          createdAtFilter.lte = end;
        }
        orderIs.createdAt = createdAtFilter;
      }
      where.order = { is: orderIs };
    }

    if (actor.kind === 'user') {
      where.userId = actor.id;
    } else if (actor.role === WorkerRole.BRAND_ADMIN) {
      where.brandId = actor.brandId || '__none__';
    } else if (actor.role !== WorkerRole.SYSTEM_ADMIN) {
      where.cafeId = actor.cafeId || '__none__';
    }

    if (query.search?.trim()) {
      where.messages = {
        some: {
          text: {
            contains: query.search.trim(),
            mode: 'insensitive',
          },
        },
      };
    }

    const readWhere =
      actor.kind === 'user' ? { userId: actor.id } : { workerId: actor.id };

    const [items, total] = await Promise.all([
      this.prisma.orderChat.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
        include: {
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: orderChatMessageInclude,
          },
          readStates: { where: readWhere, take: 1 },
          cafe: { select: { chatSettings: true } },
          order: {
            select: {
              id: true,
              orderNumber: true,
              status: true,
              totalAmount: true,
              createdAt: true,
              appointmentId: true,
              roomSnapshot: true,
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  phone: true,
                  avatar: true,
                },
              },
              appointment: {
                select: {
                  id: true,
                  dateTime: true,
                  duration: true,
                  status: true,
                  notes: true,
                  orders: {
                    select: {
                      id: true,
                      orderNumber: true,
                      status: true,
                      totalAmount: true,
                      createdAt: true,
                    },
                    orderBy: { createdAt: 'desc' },
                  },
                },
              },
            },
          },
        },
      }),
      this.prisma.orderChat.count({ where }),
    ]);

    const mapped: ChatSummaryDto[] = await Promise.all(
      items.map(async (chat) => {
        const avatarUrl = await this.resolveUserAvatarUrl(
          chat.order.user.avatar,
        );
        return {
          id: chat.id,
          orderId: chat.orderId,
          cafeId: chat.cafeId,
          userId: chat.userId,
          isEnabled: this.resolveCafeChatEnabled(chat.cafe.chatSettings),
          notificationMode: chat.notificationMode,
          unreadCount: chat.readStates[0]?.unreadCount || 0,
          user: {
            id: chat.order.user.id,
            firstName: chat.order.user.firstName,
            lastName: chat.order.user.lastName,
            email: chat.order.user.email,
            phone: chat.order.user.phone,
            avatarUrl,
          },
          order: {
            id: chat.order.id,
            orderNumber: chat.order.orderNumber,
            status: chat.order.status,
            totalAmount: chat.order.totalAmount
              ? String(chat.order.totalAmount)
              : null,
            createdAt: chat.order.createdAt,
            appointmentId: chat.order.appointmentId,
          },
          appointment: chat.order.appointment
            ? {
                id: chat.order.appointment.id,
                dateTime: chat.order.appointment.dateTime,
                duration: chat.order.appointment.duration,
                status: chat.order.appointment.status,
                notes: chat.order.appointment.notes,
                orders: chat.order.appointment.orders.map((o) => ({
                  id: o.id,
                  orderNumber: o.orderNumber,
                  status: o.status,
                  totalAmount: o.totalAmount ? String(o.totalAmount) : null,
                  createdAt: o.createdAt,
                })),
              }
            : null,
          lastMessage: chat.messages[0]
            ? await this.toMessageDto(chat.messages[0])
            : null,
          updatedAt: chat.updatedAt,
        };
      }),
    );
    const filtered = mapped.filter((chat) =>
      query.unreadOnly === 'true' ? chat.unreadCount > 0 : true,
    );

    await this.logWorkerActivity(actor, {
      action: ActivityAction.VIEW_LIST,
      category: ActivityCategory.VIEW,
      resourceType: 'ORDER_CHAT',
      details: {
        page,
        limit,
        cafeId: query.cafeId,
        orderId: query.orderId,
        unreadOnly: query.unreadOnly,
      },
    });

    return {
      items: filtered,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getMessages(chatId: string, actor: Actor, page = 1, limit = 50) {
    await this.ensureChatAccess(chatId, actor);
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.orderChatMessage.findMany({
        where: { chatId, isDeleted: false },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: orderChatMessageInclude,
      }),
      this.prisma.orderChatMessage.count({
        where: { chatId, isDeleted: false },
      }),
    ]);

    const messageDtos = await Promise.all(
      items.map((m) => this.toMessageDto(m)),
    );
    await this.logWorkerActivity(actor, {
      action: ActivityAction.VIEW_LIST,
      category: ActivityCategory.VIEW,
      resourceType: 'ORDER_CHAT_MESSAGE',
      resourceId: chatId,
      details: { page, limit },
    });
    return {
      items: messageDtos,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async sendMessage(chatId: string, actor: Actor, dto: SendChatMessageDto) {
    const chat = await this.ensureChatAccess(chatId, actor);
    if (!this.resolveCafeChatEnabled(chat.cafe.chatSettings)) {
      throw new BadRequestException('Chat is disabled');
    }

    const text = dto.text?.trim() || undefined;
    const attachmentIds = dto.attachmentIds || [];

    if (!text && attachmentIds.length === 0) {
      throw new BadRequestException('Message text or attachments required');
    }
    if (attachmentIds.length > 4) {
      throw new BadRequestException('Maximum 4 attachments per message');
    }

    const attachments = attachmentIds.length
      ? await this.prisma.orderChatAttachment.findMany({
          where: { id: { in: attachmentIds }, chatId },
        })
      : [];
    if (attachments.length !== attachmentIds.length) {
      throw new BadRequestException(
        'Some attachments are missing or unavailable',
      );
    }

    if (attachments.some((a) => a.status === ChatAttachmentStatus.UPLOADING)) {
      throw new BadRequestException(
        'Please wait until attachments finish uploading',
      );
    }

    const messageType: ChatMessageType =
      text && attachments.length
        ? ChatMessageType.MIXED
        : attachments.length
          ? ChatMessageType.IMAGE
          : ChatMessageType.TEXT;

    const recipientWorkerIds = await this.resolveWorkerRecipients(chat);

    const created = await this.prisma.$transaction(async (tx) => {
      const message = await tx.orderChatMessage.create({
        data: {
          chatId,
          orderId: chat.orderId,
          cafeId: chat.cafeId,
          authorType:
            actor.kind === 'user' ? ChatAuthorType.USER : ChatAuthorType.WORKER,
          authorUserId: actor.kind === 'user' ? actor.id : null,
          authorWorkerId: actor.kind === 'worker' ? actor.id : null,
          messageType,
          text: text || null,
        },
      });

      if (attachments.length) {
        await tx.orderChatAttachment.updateMany({
          where: { id: { in: attachments.map((a) => a.id) } },
          data: { messageId: message.id, updatedAt: new Date() },
        });
      }

      await tx.orderChat.update({
        where: { id: chatId },
        data: { updatedAt: new Date() },
      });

      // increment unread counters for opposite side
      if (actor.kind === 'user') {
        await Promise.all(
          recipientWorkerIds.map((workerId) =>
            tx.orderChatReadState.upsert({
              where: { chatId_workerId: { chatId, workerId } },
              update: { unreadCount: { increment: 1 } },
              create: { chatId, workerId, unreadCount: 1 },
            }),
          ),
        );
      } else {
        await tx.orderChatReadState.upsert({
          where: { chatId_userId: { chatId, userId: chat.userId } },
          update: { unreadCount: { increment: 1 } },
          create: { chatId, userId: chat.userId, unreadCount: 1 },
        });
        await Promise.all(
          recipientWorkerIds
            .filter((workerId) => workerId !== actor.id)
            .map((workerId) =>
              tx.orderChatReadState.upsert({
                where: { chatId_workerId: { chatId, workerId } },
                update: { unreadCount: { increment: 1 } },
                create: { chatId, workerId, unreadCount: 1 },
              }),
            ),
        );
      }

      return tx.orderChatMessage.findUniqueOrThrow({
        where: { id: message.id },
        include: orderChatMessageInclude,
      });
    });

    await this.logWorkerActivity(actor, {
      action: ActivityAction.CREATE,
      category: ActivityCategory.DATA,
      resourceType: 'ORDER_CHAT_MESSAGE',
      resourceId: created.id,
      details: { chatId, orderId: chat.orderId },
    });

    return {
      message: await this.toMessageDto(created),
      routing: {
        userId: chat.userId,
        workerIds: recipientWorkerIds,
        brandId: chat.brandId,
      },
    };
  }

  async uploadAttachment(
    chatId: string,
    actor: Actor,
    file: {
      buffer: Buffer;
      mimetype: string;
      size: number;
      originalname?: string;
    },
  ) {
    const chat = await this.ensureChatAccess(chatId, actor);
    await this.cleanupExpiredOrphanAttachments(chatId);
    if (!this.resolveCafeChatEnabled(chat.cafe.chatSettings)) {
      throw new BadRequestException('Chat is disabled');
    }
    if (!file) throw new BadRequestException('File is required');
    if (file.size > 10 * 1024 * 1024) {
      throw new BadRequestException('Attachment size must be <= 10MB');
    }
    const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
    if (!allowedMimeTypes.has(file.mimetype)) {
      throw new BadRequestException('Only jpeg/png/webp images are allowed');
    }

    const created = await this.prisma.orderChatAttachment.create({
      data: {
        chatId,
        messageId: null,
        bucket: 'cafes',
        path: '',
        url: '',
        mimeType: file.mimetype,
        size: file.size,
        status: ChatAttachmentStatus.UPLOADING,
      },
    });

    const ext =
      file.originalname && file.originalname.includes('.')
        ? file.originalname.substring(file.originalname.lastIndexOf('.'))
        : '';
    const path = `${chat.cafeId}/order-chats/${chatId}/attachments/${created.id}${ext}`;
    const uploaded = await this.storageService.uploadFile('cafes', path, file);
    const signedUrl = await this.resolveAttachmentUrl('cafes', path);

    const updated = await this.prisma.orderChatAttachment.update({
      where: { id: created.id },
      data: {
        path,
        url: signedUrl || uploaded.url,
        status: ChatAttachmentStatus.UPLOADED,
      },
    });

    await this.logWorkerActivity(actor, {
      action: ActivityAction.FILE_UPLOAD,
      category: ActivityCategory.DATA,
      resourceType: 'ORDER_CHAT_ATTACHMENT',
      resourceId: updated.id,
      details: { chatId, mimeType: updated.mimeType },
    });

    return {
      id: updated.id,
      chatId: updated.chatId,
      url: updated.url,
      mimeType: updated.mimeType,
      size: updated.size,
      status: updated.status,
      sortOrder: updated.sortOrder,
    };
  }

  async streamAttachmentFile(
    chatId: string,
    attachmentId: string,
    actor: Actor,
  ): Promise<{ data: Buffer; contentType: string }> {
    await this.ensureChatAccess(chatId, actor);
    const attachment = await this.prisma.orderChatAttachment.findFirst({
      where: { id: attachmentId, chatId },
    });
    if (!attachment?.path) {
      throw new NotFoundException('Attachment not found');
    }
    if (attachment.status === ChatAttachmentStatus.UPLOADING) {
      throw new BadRequestException('Attachment is still uploading');
    }
    const { data, contentType } = await this.storageService.getObjectBytes(
      attachment.bucket,
      attachment.path,
    );
    return { data, contentType };
  }

  async markRead(chatId: string, actor: Actor, dto: MarkChatReadDto) {
    await this.ensureChatAccess(chatId, actor);

    const where =
      actor.kind === 'user'
        ? { chatId_userId: { chatId, userId: actor.id } }
        : { chatId_workerId: { chatId, workerId: actor.id } };
    const create =
      actor.kind === 'user'
        ? { chatId, userId: actor.id }
        : { chatId, workerId: actor.id };

    await this.prisma.orderChatReadState.upsert({
      where,
      update: {
        unreadCount: 0,
        lastReadAt: new Date(),
        ...(dto.messageId ? { lastReadMessageId: dto.messageId } : {}),
      },
      create: {
        ...create,
        unreadCount: 0,
        lastReadAt: new Date(),
        ...(dto.messageId ? { lastReadMessageId: dto.messageId } : {}),
      },
    });

    await this.logWorkerActivity(actor, {
      action: ActivityAction.UPDATE,
      category: ActivityCategory.DATA,
      resourceType: 'ORDER_CHAT_READ_STATE',
      resourceId: chatId,
      details: { messageId: dto.messageId },
    });

    return { ok: true };
  }

  async updateSettings(
    chatId: string,
    actor: Actor,
    dto: UpdateChatSettingsDto,
  ) {
    const chat = await this.ensureChatAccess(chatId, actor);
    if (actor.kind === 'user') {
      throw new ForbiddenException('Only staff can change chat settings');
    }
    if (actor.role === WorkerRole.WORKER) {
      throw new ForbiddenException(
        'Only cafe/brand/system admins can change chat settings',
      );
    }
    if (
      actor.role !== WorkerRole.SYSTEM_ADMIN &&
      actor.role === WorkerRole.BRAND_ADMIN &&
      actor.brandId !== chat.brandId
    ) {
      throw new ForbiddenException('Forbidden');
    }
    if (
      actor.role !== WorkerRole.SYSTEM_ADMIN &&
      actor.role !== WorkerRole.BRAND_ADMIN &&
      actor.cafeId !== chat.cafeId
    ) {
      throw new ForbiddenException('Forbidden');
    }

    if (dto.isEnabled !== undefined) {
      const cafe = await this.prisma.cafe.findUnique({
        where: { id: chat.cafeId },
        select: { chatSettings: true },
      });
      const currentSettings =
        cafe?.chatSettings && typeof cafe.chatSettings === 'object'
          ? (cafe.chatSettings as Record<string, unknown>)
          : {};
      await this.prisma.cafe.update({
        where: { id: chat.cafeId },
        data: {
          chatSettings: {
            ...currentSettings,
            enabled: dto.isEnabled,
          } as Prisma.InputJsonValue,
        },
      });
    }

    const updated = await this.prisma.orderChat.update({
      where: { id: chatId },
      data: {
        ...(dto.notificationMode
          ? { notificationMode: dto.notificationMode }
          : {}),
        ...(dto.notificationRoles
          ? { notificationRoles: dto.notificationRoles }
          : {}),
        ...(dto.notificationWorkerIds
          ? { notificationWorkerIds: dto.notificationWorkerIds }
          : {}),
        ...(dto.theme !== undefined
          ? { theme: dto.theme as Prisma.InputJsonValue }
          : {}),
      },
    });

    await this.logWorkerActivity(actor, {
      action: ActivityAction.UPDATE_SETTINGS,
      category: ActivityCategory.CONFIG,
      resourceType: 'ORDER_CHAT',
      resourceId: chatId,
      details: {
        isEnabled: dto.isEnabled,
        notificationMode: dto.notificationMode,
        hasTheme: dto.theme !== undefined,
      },
    });

    return updated;
  }

  async setTyping(chatId: string, actor: Actor, isTyping: boolean) {
    await this.ensureChatAccess(chatId, actor);
    if (!isTyping) {
      await this.prisma.orderChatTypingState.deleteMany({
        where:
          actor.kind === 'user'
            ? { chatId, userId: actor.id }
            : { chatId, workerId: actor.id },
      });
      return { typing: false };
    }

    const expiresAt = new Date(Date.now() + 10_000);
    const existing = await this.prisma.orderChatTypingState.findFirst({
      where:
        actor.kind === 'user'
          ? { chatId, userId: actor.id }
          : { chatId, workerId: actor.id },
      select: { id: true },
    });
    if (existing) {
      await this.prisma.orderChatTypingState.update({
        where: { id: existing.id },
        data: { expiresAt },
      });
    } else {
      await this.prisma.orderChatTypingState.create({
        data:
          actor.kind === 'user'
            ? { chatId, userId: actor.id, expiresAt }
            : { chatId, workerId: actor.id, expiresAt },
      });
    }
    return { typing: true, expiresAt };
  }
}
