import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  Transaction,
  TransactionType,
  TransactionStatus,
} from '@prisma/client';

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findByUserId(
    userId: string,
    limit = 50,
    offset = 0,
  ): Promise<Transaction[]> {
    return this.prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        card: {
          select: {
            id: true,
            last4Digits: true,
            cardType: true,
          },
        },
      },
    });
  }

  async findById(
    transactionId: string,
    userId: string,
  ): Promise<Transaction | null> {
    return this.prisma.transaction.findFirst({
      where: {
        id: transactionId,
        userId,
      },
      include: {
        card: {
          select: {
            id: true,
            last4Digits: true,
            cardType: true,
          },
        },
      },
    });
  }

  async createPayment(
    userId: string,
    cardId: string,
    amount: number,
    orderId?: string,
    description?: string,
  ): Promise<Transaction> {
    const card = await this.prisma.paymentCard.findFirst({
      where: {
        id: cardId,
        userId,
        deletedAt: null,
        isActive: true,
      },
    });

    if (!card) {
      throw new NotFoundException('Payment card not found');
    }

    if (amount <= 0) {
      throw new BadRequestException('Amount must be greater than 0');
    }

    const transaction = await this.prisma.transaction.create({
      data: {
        userId,
        type: TransactionType.PAYMENT,
        status: TransactionStatus.PENDING,
        amount,
        currency: 'BYN',
        cardId,
        orderId,
        description:
          description || `Payment using card ending in ${card.last4Digits}`,
        provider: 'stripe',
        providerTransactionId: `ch_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      },
    });

    this.logger.log(`Payment transaction created: ${transaction.id}`);

    await this.processPayment(transaction.id);

    const result = await this.findById(transaction.id, userId);
    if (!result) {
      throw new NotFoundException('Transaction not found after creation');
    }
    return result;
  }

  private async processPayment(transactionId: string): Promise<void> {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) {
      return;
    }

    await this.prisma.transaction.update({
      where: { id: transactionId },
      data: { status: TransactionStatus.PROCESSING },
    });

    await new Promise((resolve) => setTimeout(resolve, 500));

    const success = true;

    if (success) {
      await this.prisma.transaction.update({
        where: { id: transactionId },
        data: {
          status: TransactionStatus.COMPLETED,
          providerTransactionId: `ch_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        },
      });
      this.logger.log(`Payment completed: ${transactionId}`);
    } else {
      await this.prisma.transaction.update({
        where: { id: transactionId },
        data: { status: TransactionStatus.FAILED },
      });
      this.logger.warn(`Payment failed: ${transactionId}`);
    }
  }

  async createRefund(
    userId: string,
    originalTransactionId: string,
    amount?: number,
    description?: string,
  ): Promise<Transaction> {
    const originalTransaction = await this.prisma.transaction.findFirst({
      where: {
        id: originalTransactionId,
        userId,
        type: TransactionType.PAYMENT,
        status: TransactionStatus.COMPLETED,
      },
    });

    if (!originalTransaction) {
      throw new NotFoundException('Original transaction not found');
    }

    const originalAmount = Number(originalTransaction.amount);
    const refundAmount = amount ? Number(amount) : originalAmount;

    if (refundAmount > originalAmount) {
      throw new BadRequestException(
        'Refund amount cannot exceed original payment amount',
      );
    }

    const transaction = await this.prisma.transaction.create({
      data: {
        userId,
        type: TransactionType.REFUND,
        status: TransactionStatus.PENDING,
        amount: -Math.abs(refundAmount),
        currency: originalTransaction.currency,
        orderId: originalTransaction.orderId,
        cardId: originalTransaction.cardId,
        description:
          description || `Refund for transaction ${originalTransactionId}`,
        provider: originalTransaction.provider,
        metadata: {
          originalTransactionId,
        },
      },
    });

    this.logger.log(`Refund transaction created: ${transaction.id}`);

    await this.processRefund(transaction.id);

    const result = await this.findById(transaction.id, userId);
    if (!result) {
      throw new NotFoundException('Transaction not found after creation');
    }
    return result;
  }

  private async processRefund(transactionId: string): Promise<void> {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) {
      return;
    }

    await this.prisma.transaction.update({
      where: { id: transactionId },
      data: { status: TransactionStatus.PROCESSING },
    });

    await new Promise((resolve) => setTimeout(resolve, 500));

    const success = true;

    if (success) {
      await this.prisma.transaction.update({
        where: { id: transactionId },
        data: {
          status: TransactionStatus.COMPLETED,
          providerTransactionId: `re_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        },
      });
      this.logger.log(`Refund completed: ${transactionId}`);
    } else {
      await this.prisma.transaction.update({
        where: { id: transactionId },
        data: { status: TransactionStatus.FAILED },
      });
      this.logger.warn(`Refund failed: ${transactionId}`);
    }
  }
}
