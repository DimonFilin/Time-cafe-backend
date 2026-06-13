import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  channelId?: string;
  priority?: 'default' | 'normal' | 'high';
};

@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async sendToUser(
    userId: string,
    message: Omit<ExpoPushMessage, 'to'>,
  ): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { pushToken: true },
    });
    const token = user?.pushToken?.trim();
    if (!token) return false;
    return this.sendExpo(token, message);
  }

  async sendExpo(
    token: string,
    message: Omit<ExpoPushMessage, 'to'>,
  ): Promise<boolean> {
    if (
      !token.startsWith('ExponentPushToken[') &&
      !token.startsWith('ExpoPushToken')
    ) {
      this.logger.warn(`Skipping non-Expo push token: ${token.slice(0, 12)}…`);
      return false;
    }
    try {
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          to: token,
          title: message.title,
          body: message.body,
          data: message.data,
          channelId: message.channelId ?? 'default',
          priority: message.priority ?? 'high',
        }),
      });
      if (!res.ok) {
        this.logger.warn(`Expo push HTTP ${res.status}`);
        return false;
      }
      const json = (await res.json()) as {
        data?: { status?: string; message?: string }[];
      };
      const ticket = json.data?.[0];
      if (ticket?.status === 'error') {
        this.logger.warn(`Expo push error: ${ticket.message}`);
        return false;
      }
      return true;
    } catch (e) {
      this.logger.warn(`Expo push failed: ${e}`);
      return false;
    }
  }
}
