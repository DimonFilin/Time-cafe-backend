import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { TransactionsService } from './transactions.service';
import { PaymentCardsService } from './payment-cards.service';

export interface BalanceResponse {
  balance: string;
  currency: string;
}

export interface TopUpBalanceDto {
  cardId: string;
  amount: number;
}

export interface BalanceTransaction {
  id: string;
  type: 'TOP_UP' | 'PAYMENT' | 'REFUND';
  amount: string;
  description: string;
  createdAt: Date;
  cardId?: string;
  cardLast4Digits?: string;
}

@Injectable()
export class BalanceService {
  private readonly logger = new Logger(BalanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly transactionsService: TransactionsService,
    private readonly paymentCardsService: PaymentCardsService,
  ) {}

  /**
   * Get user balance
   */
  async getBalance(userId: string): Promise<BalanceResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { balance: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      balance: user.balance.toString(),
      currency: 'BYN',
    };
  }

  /**
   * Top up balance using a payment card
   */
  async topUpBalance(
    userId: string,
    dto: TopUpBalanceDto,
  ): Promise<BalanceResponse> {
    const { cardId, amount } = dto;

    if (amount <= 0) {
      throw new BadRequestException('Amount must be greater than 0');
    }

    // Check if card exists and belongs to user
    const card = await this.paymentCardsService.findById(cardId, userId);
    if (!card) {
      throw new NotFoundException('Payment card not found');
    }

    // Create payment transaction (will be processed asynchronously)
    await this.transactionsService.createPayment(
      userId,
      cardId,
      amount,
      undefined, // no orderId for balance top-up
      `Balance top-up using card ending in ${card.last4Digits}`,
    );

    // Wait for transaction to complete (in real app this would be handled by webhooks)
    // For now, we simulate immediate completion
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Get updated balance
    return this.getBalance(userId);
  }

  /**
   * Get balance transaction history
   */
  async getBalanceHistory(
    userId: string,
    limit = 50,
    offset = 0,
  ): Promise<BalanceTransaction[]> {
    // Get transactions that affect balance
    const transactionRecords = await this.prisma.transaction.findMany({
      where: {
        userId,
        OR: [
          { type: 'PAYMENT', orderId: null }, // Balance top-ups (payments without order)
          { type: 'PAYMENT', orderId: { not: null } }, // Order payments (affect balance)
          { type: 'REFUND' }, // Refunds (affect balance)
        ],
      },
      include: {
        card: {
          select: {
            last4Digits: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    return transactionRecords.map((record) => ({
      id: record.id,
      type: this.mapTransactionType(record.type, record.orderId),
      amount: record.amount.toString(),
      description: record.description || '',
      createdAt: record.createdAt,
      cardId: record.cardId || undefined,
      cardLast4Digits: record.card?.last4Digits,
    }));
  }

  /**
   * Deduct from balance (used by orders)
   */
  async deductFromBalance(userId: string, amount: number): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { balance: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const currentBalance = Number(user.balance);
    if (currentBalance < amount) {
      throw new BadRequestException('Insufficient balance');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        balance: {
          decrement: amount,
        },
      },
    });

    this.logger.log(
      `Deducted ${String(amount)} BYN from user ${userId} balance`,
    );
  }

  /**
   * Add to balance (used by refunds)
   */
  async addToBalance(userId: string, amount: number): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        balance: {
          increment: amount,
        },
      },
    });

    this.logger.log(`Added ${String(amount)} BYN to user ${userId} balance`);
  }

  private mapTransactionType(
    transactionType: string,
    orderId: string | null,
  ): 'TOP_UP' | 'PAYMENT' | 'REFUND' {
    if (transactionType === 'REFUND') {
      return 'REFUND';
    }
    if (transactionType === 'PAYMENT' && orderId) {
      return 'PAYMENT';
    }
    if (transactionType === 'PAYMENT' && !orderId) {
      return 'TOP_UP';
    }
    return 'PAYMENT'; // fallback
  }
}
