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
  OrderStatus,
  Prisma,
} from '@prisma/client';
import { AdminTransactionListQueryDto } from '../dto/admin-transaction-list-query.dto';

enum PaymentMode {
  GOOD = 'good', // Платеж проходит моментально
  WAIT_5 = 'wait-5', // Платеж проходит через 5 секунд
  STOP = 'stop', // Платеж не проходит
}

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

    // Get payment mode from environment
    const paymentMode = (process.env.PAYMENT_MODE || 'good') as PaymentMode;

    let waitTime = 0;
    let success = true;

    switch (paymentMode) {
      case PaymentMode.GOOD:
        waitTime = 100; // Very fast
        success = true;
        break;
      case PaymentMode.WAIT_5:
        waitTime = 5000; // 5 seconds
        success = true;
        break;
      case PaymentMode.STOP:
        waitTime = 1000; // 1 second
        success = false;
        break;
      default:
        waitTime = 100;
        success = true;
    }

    await new Promise((resolve) => setTimeout(resolve, waitTime));

    if (success) {
      await this.prisma.transaction.update({
        where: { id: transactionId },
        data: {
          status: TransactionStatus.COMPLETED,
          providerTransactionId: `ch_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        },
      });
      this.logger.log(
        `Payment completed: ${transactionId} (mode: ${paymentMode})`,
      );

      // If payment was for an order, update order status
      if (transaction.orderId) {
        await this.updateOrderStatusOnPaymentSuccess(transaction.orderId);
      }
    } else {
      // Payment failed - check if we can retry
      const currentTransaction = await this.prisma.transaction.findUnique({
        where: { id: transactionId },
      });

      if (
        currentTransaction &&
        currentTransaction.retryCount < (currentTransaction.maxRetries || 3)
      ) {
        // Create retry transaction
        await this.retryPayment(transactionId);
      } else {
        // Mark as failed
        await this.prisma.transaction.update({
          where: { id: transactionId },
          data: { status: TransactionStatus.FAILED },
        });
        this.logger.warn(
          `Payment failed permanently: ${transactionId} (mode: ${paymentMode})`,
        );
      }
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

    // Refunds are always successful for simulation
    await new Promise((resolve) => setTimeout(resolve, 100));

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

  /**
   * Retry payment with increased retry count
   */
  private async retryPayment(originalTransactionId: string): Promise<void> {
    const originalTransaction = await this.prisma.transaction.findUnique({
      where: { id: originalTransactionId },
    });

    if (!originalTransaction) {
      return;
    }

    // Increment retry count
    const newRetryCount = originalTransaction.retryCount + 1;

    await this.prisma.transaction.update({
      where: { id: originalTransactionId },
      data: {
        retryCount: newRetryCount,
        status: TransactionStatus.PENDING,
      },
    });

    this.logger.log(
      `Retrying payment ${originalTransactionId}, attempt ${newRetryCount}`,
    );

    // Process payment again
    await this.processPayment(originalTransactionId);
  }

  /**
   * Update order status when payment succeeds
   */
  private async updateOrderStatusOnPaymentSuccess(
    orderId: string,
  ): Promise<void> {
    try {
      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.CONFIRMED,
          paidAt: new Date(),
          confirmedAt: new Date(),
        },
      });
      this.logger.log(`Order ${orderId} confirmed after successful payment`);
    } catch (error) {
      this.logger.error(
        `Failed to update order status for ${orderId}: ${error}`,
      );
    }
  }

  /**
   * Get all transactions for SYSTEM_ADMIN
   */
  async findAllAdmin(query: AdminTransactionListQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.TransactionWhereInput = {};

    if (query.userId) {
      where.userId = query.userId;
    }

    if (query.type) {
      where.type = query.type;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.orderId) {
      where.orderId = query.orderId;
    }

    const [transactions, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
        include: {
          card: {
            select: {
              id: true,
              last4Digits: true,
              cardType: true,
            },
          },
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return {
      items: transactions,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get transaction by ID for SYSTEM_ADMIN
   */
  async findOneAdmin(transactionId: string): Promise<Transaction | null> {
    return this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        card: {
          select: {
            id: true,
            last4Digits: true,
            cardType: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
          },
        },
      },
    });
  }

  /**
   * Create refund for SYSTEM_ADMIN (can refund any transaction)
   */
  async createRefundAdmin(
    originalTransactionId: string,
    amount?: number,
    description?: string,
  ): Promise<Transaction> {
    const originalTransaction = await this.prisma.transaction.findFirst({
      where: {
        id: originalTransactionId,
        type: TransactionType.PAYMENT,
        status: TransactionStatus.COMPLETED,
      },
    });

    if (!originalTransaction) {
      throw new NotFoundException('Original transaction not found');
    }

    const originalAmount = Number(originalTransaction.amount);
    const refundAmount = amount ? Number(amount) : originalAmount;

    if (refundAmount <= 0) {
      throw new BadRequestException('Refund amount must be greater than 0');
    }

    if (refundAmount > originalAmount) {
      throw new BadRequestException(
        'Refund amount cannot exceed original payment amount',
      );
    }

    const refund = await this.prisma.transaction.create({
      data: {
        userId: originalTransaction.userId,
        type: TransactionType.REFUND,
        status: TransactionStatus.COMPLETED,
        amount: refundAmount,
        currency: originalTransaction.currency,
        orderId: originalTransaction.orderId,
        cardId: originalTransaction.cardId,
        description:
          description ||
          `Refund for transaction ${originalTransaction.id.substring(0, 8)}`,
        provider: originalTransaction.provider,
        providerTransactionId: `re_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      },
    });

    this.logger.log(
      `Refund created: ${refund.id} for transaction ${originalTransactionId}`,
    );

    return refund;
  }
}
