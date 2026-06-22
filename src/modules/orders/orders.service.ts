import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  OrderStatus,
  Prisma,
  WorkerRole,
  DeliveryType,
  PaymentMethod,
} from '@prisma/client';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderResponseDto } from './dto/order-response.dto';
import { OrderListQueryDto } from './dto/order-list-query.dto';
import { OrderListResponseDto } from './dto/order-list-response.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { UsersService } from '../users/users.service';
import { TransactionsService } from '../payments/services/transactions.service';
import { WorkersService } from '../workers/workers.service';
import { CafeRealtimeGateway } from '../cafe-realtime/cafe-realtime.gateway';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly transactionsService: TransactionsService,
    private readonly workersService: WorkersService,
    private readonly cafeRealtime: CafeRealtimeGateway,
  ) {}

  private publishOrderUpdate(cafeId: string, order: OrderResponseDto) {
    try {
      this.cafeRealtime.emitOrderUpdated(cafeId, order);
    } catch (error) {
      this.logger.warn(`Failed to emit order update: ${String(error)}`);
    }
  }

  /**
   * Generate unique order number
   */
  private generateOrderNumber(): string {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 1000000)
      .toString()
      .padStart(6, '0');
    return `ORD-${year}-${random}`;
  }

  /**
   * Calculate total amount for order items
   */
  private calculateTotal(items: CreateOrderDto['items']): number {
    return items.reduce((total, item) => {
      const itemTotal = item.unitPrice * item.quantity;
      return total + itemTotal;
    }, 0);
  }

  /**
   * Check if user has access to cafe (for workers)
   */
  private async checkCafeAccess(
    cafeId: string,
    keycloakId: string,
  ): Promise<void> {
    const worker = await this.workersService.findByKeycloakId(keycloakId);
    if (!worker) {
      throw new ForbiddenException('Worker account not found');
    }

    if (worker.role === WorkerRole.SYSTEM_ADMIN) {
      return;
    }

    if (worker.role === WorkerRole.CAFE_ADMIN && worker.cafeId === cafeId) {
      return;
    }

    if (worker.role === WorkerRole.WORKER && worker.cafeId === cafeId) {
      return;
    }

    throw new ForbiddenException(
      'Only SYSTEM_ADMIN, CAFE_ADMIN, or WORKER of this cafe can perform this action',
    );
  }

  /**
   * Create order
   */
  async create(
    keycloakId: string,
    createOrderDto: CreateOrderDto,
  ): Promise<OrderResponseDto> {
    const user = await this.usersService.findByKeycloakId(keycloakId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Validate cafe exists and is active
    const cafe = await this.prisma.cafe.findFirst({
      where: {
        id: createOrderDto.cafeId,
        deletedAt: null,
      },
      include: {
        brand: {
          select: {
            status: true,
            isVerified: true,
          },
        },
      },
    });

    if (!cafe) {
      throw new NotFoundException('Cafe not found');
    }

    if (cafe.brand.status !== 'ACTIVE' || !cafe.brand.isVerified) {
      throw new BadRequestException('Cafe is not available for orders');
    }

    // Validate appointment if provided
    if (createOrderDto.appointmentId) {
      const appointment = await this.prisma.appointment.findFirst({
        where: {
          id: createOrderDto.appointmentId,
          userId: user.id,
          cafeId: createOrderDto.cafeId,
        },
      });

      if (!appointment) {
        throw new NotFoundException('Appointment not found');
      }

      if (
        appointment.status !== 'pending' &&
        appointment.status !== 'confirmed'
      ) {
        throw new BadRequestException(
          'Appointment is not available for ordering',
        );
      }
    }

    // Validate delivery address if needed
    if (
      createOrderDto.deliveryType === 'DELIVERY' &&
      !createOrderDto.deliveryAddress
    ) {
      throw new BadRequestException(
        'Delivery address is required for delivery orders',
      );
    }

    // Validate payment method
    const paymentMethod = createOrderDto.paymentMethod || 'CARD';
    if (paymentMethod === 'CARD' && !createOrderDto.cardId) {
      throw new BadRequestException('Card ID is required for card payment');
    }

    // Calculate total amount
    if (!createOrderDto.items || createOrderDto.items.length === 0) {
      throw new BadRequestException('Order must contain at least one item');
    }

    const totalAmount = this.calculateTotal(createOrderDto.items);

    if (totalAmount <= 0) {
      throw new BadRequestException('Order total must be greater than 0');
    }

    // Create order first (always PENDING)
    let orderNumber = this.generateOrderNumber();
    let exists = await this.prisma.order.findFirst({
      where: { orderNumber },
    });
    while (exists) {
      orderNumber = this.generateOrderNumber();
      exists = await this.prisma.order.findFirst({
        where: { orderNumber },
      });
    }

    const order = await this.prisma.order.create({
      data: {
        orderNumber,
        userId: user.id,
        cafeId: createOrderDto.cafeId,
        appointmentId: createOrderDto.appointmentId || null,
        status: OrderStatus.PENDING,
        totalAmount,
        deliveryType: createOrderDto.deliveryType || 'IN_CAFE',
        deliveryAddress: createOrderDto.deliveryAddress || null,
        contactPhone: createOrderDto.contactPhone,
        notes: createOrderDto.notes || null,
        paymentMethod: paymentMethod,
        items: {
          create: createOrderDto.items.map((item) => ({
            itemName: item.itemName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.unitPrice * item.quantity,
            notes: item.notes || null,
          })),
        },
      },
      include: {
        items: true,
        cafe: {
          select: {
            name: true,
          },
        },
      },
    });

    // Process payment
    if (paymentMethod === 'CARD' && createOrderDto.cardId) {
      // Initiate card payment asynchronously
      void this.initiateCardPayment(
        order.id,
        user.id,
        createOrderDto.cardId,
        totalAmount,
        orderNumber,
      );
    } else if (paymentMethod === 'BALANCE') {
      // Process balance payment synchronously
      await this.initiateBalancePayment(
        order.id,
        user.id,
        totalAmount,
        orderNumber,
      );
      // Refresh order data after payment processing
      const updatedOrder = await this.prisma.order.findUnique({
        where: { id: order.id },
        include: {
          items: true,
          cafe: { select: { name: true } },
        },
      });
      const result = this.mapToResponseDto(updatedOrder || order);
      this.publishOrderUpdate(createOrderDto.cafeId, result);
      return result;
    }
    // For CASH payment, order remains PENDING until payment is made

    const result = this.mapToResponseDto(order);
    this.publishOrderUpdate(createOrderDto.cafeId, result);
    return result;
  }

  /**
   * Get orders for user
   */
  async findAll(
    keycloakId: string,
    query: OrderListQueryDto,
  ): Promise<OrderListResponseDto> {
    const user = await this.usersService.findByKeycloakId(keycloakId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.OrderWhereInput = {
      userId: user.id,
    };

    if (query.status) {
      where.status = query.status;
    }

    if (query.cafeId) {
      where.cafeId = query.cafeId;
    }

    if (query.appointmentId) {
      where.appointmentId = query.appointmentId;
    }

    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) {
        where.createdAt.gte = new Date(query.from);
      }
      if (query.to) {
        const toDate = new Date(query.to);
        toDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = toDate;
      }
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          items: true,
          cafe: {
            select: {
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }) as Promise<any[]>,
      this.prisma.order.count({ where }),
    ]);

    return {
      items: orders.map((order) => this.mapToResponseDto(order)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get order by ID
   */
  async findOne(
    orderId: string,
    keycloakId: string,
  ): Promise<OrderResponseDto> {
    const user = await this.usersService.findByKeycloakId(keycloakId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        userId: user.id,
      },
      include: {
        items: true,
        cafe: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return this.mapToResponseDto(order);
  }

  /**
   * Update order status (for cafe workers)
   */
  async updateStatus(
    orderId: string,
    keycloakId: string,
    updateDto: UpdateOrderStatusDto,
  ): Promise<OrderResponseDto> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        cafe: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Check access

    await this.checkCafeAccess(order.cafeId, keycloakId);

    // Validate status transition
    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
      [OrderStatus.CONFIRMED]: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
      [OrderStatus.COMPLETED]: [],
      [OrderStatus.CANCELLED]: [],
    };

    if (!validTransitions[order.status].includes(updateDto.status)) {
      throw new BadRequestException(
        `Cannot change status from ${order.status} to ${updateDto.status}`,
      );
    }

    // Business rules validation
    const orderWithPayment = order as typeof order & {
      paidAt?: Date;
      paymentMethod?: string;
      confirmedAt?: Date;
      completedAt?: Date;
      cancelledAt?: Date;
      cancellationReason?: string;
    };

    if (updateDto.status === OrderStatus.CONFIRMED) {
      // Can only confirm orders that are paid or cash orders
      if (
        orderWithPayment.paymentMethod !== 'CASH' &&
        !orderWithPayment.paidAt
      ) {
        throw new BadRequestException(
          'Cannot confirm order without successful payment. Please wait for payment to complete.',
        );
      }
    }

    if (updateDto.status === OrderStatus.COMPLETED) {
      // Can only complete orders that are paid and confirmed
      if (!orderWithPayment.paidAt) {
        throw new BadRequestException(
          'Cannot complete unpaid order. Payment must be successful before completion.',
        );
      }
      if (order.status !== OrderStatus.CONFIRMED) {
        throw new BadRequestException(
          'Cannot complete order that is not confirmed. Order must be confirmed first.',
        );
      }
    }

    // Validate cancellation reason
    if (
      updateDto.status === OrderStatus.CANCELLED &&
      !updateDto.cancellationReason
    ) {
      throw new BadRequestException(
        'Cancellation reason is required when cancelling order',
      );
    }

    // Update order
    const updateData: Prisma.OrderUpdateInput = {
      status: updateDto.status,
    };

    if (
      updateDto.status === OrderStatus.CONFIRMED &&
      !orderWithPayment.confirmedAt
    ) {
      updateData.confirmedAt = new Date();
    }

    if (updateDto.status === OrderStatus.COMPLETED) {
      updateData.completedAt = new Date();
    }

    if (updateDto.status === OrderStatus.CANCELLED) {
      updateData.cancelledAt = new Date();
      updateData.cancellationReason = updateDto.cancellationReason;
    }

    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: updateData,
      include: {
        items: true,
        cafe: {
          select: {
            name: true,
          },
        },
      },
    });

    // If cancelled and paid, create refund
    if (
      updateDto.status === OrderStatus.CANCELLED &&
      order.paidAt &&
      order.paymentMethod !== 'CASH'
    ) {
      try {
        // Find original payment transaction
        const originalTransaction = await this.prisma.transaction.findFirst({
          where: {
            orderId: orderId,
            userId: order.userId,
            type: 'PAYMENT',
            status: 'COMPLETED',
          },
          orderBy: { createdAt: 'desc' },
        });

        if (originalTransaction) {
          if (order.paymentMethod === 'BALANCE') {
            // Refund to balance
            await this.prisma.$transaction(async (tx) => {
              await tx.transaction.create({
                data: {
                  userId: order.userId,
                  type: 'REFUND',
                  status: 'COMPLETED',

                  amount: -Number(order.totalAmount),
                  currency: 'BYN',
                  orderId: orderId,

                  description: `Refund for cancelled order ${order.orderNumber}`,
                  provider: 'balance',
                },
              });

              await tx.user.update({
                where: { id: order.userId },
                data: {
                  balance: {
                    increment: Number(order.totalAmount),
                  },
                },
              });
            });
          } else {
            // Refund to card
            await this.transactionsService.createRefund(
              order.userId,
              originalTransaction.id,

              Number(order.totalAmount),

              `Refund for cancelled order ${order.orderNumber}`,
            );
          }
        }
      } catch (error) {
        this.logger.error(
          `Failed to create refund for order ${orderId}: ${error}`,
        );
      }
    }

    const result = this.mapToResponseDto(updatedOrder);
    this.publishOrderUpdate(order.cafeId, result);
    return result;
  }

  /**
   * Cancel order (for user)
   */
  async cancel(
    orderId: string,
    keycloakId: string,
    reason?: string,
  ): Promise<OrderResponseDto> {
    const user = await this.usersService.findByKeycloakId(keycloakId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        userId: user.id,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // User can only cancel PENDING orders
    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException(
        'Only pending orders can be cancelled by user',
      );
    }

    // Update order
    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.CANCELLED,
        cancelledAt: new Date(),
        cancellationReason: reason || 'Cancelled by user',
      },
      include: {
        items: true,
        cafe: {
          select: {
            name: true,
          },
        },
      },
    });

    // If paid, create refund
    const orderWithPayment = order;
    if (orderWithPayment.paidAt && order.paymentMethod !== 'CASH') {
      try {
        // Find original payment transaction
        const originalTransaction = await this.prisma.transaction.findFirst({
          where: {
            orderId: orderId,
            userId: user.id,
            type: 'PAYMENT',
            status: 'COMPLETED',
          },
          orderBy: { createdAt: 'desc' },
        });

        if (originalTransaction) {
          if (order.paymentMethod === 'BALANCE') {
            // Refund to balance
            await this.prisma.$transaction(async (tx) => {
              await tx.transaction.create({
                data: {
                  userId: user.id,
                  type: 'REFUND',
                  status: 'COMPLETED',
                  amount: -Number(order.totalAmount),
                  currency: 'BYN',
                  orderId: orderId,
                  description: `Refund for cancelled order ${order.orderNumber}`,
                  provider: 'balance',
                },
              });

              await tx.user.update({
                where: { id: user.id },
                data: {
                  balance: {
                    increment: Number(order.totalAmount),
                  },
                },
              });
            });
          } else {
            // Refund to card
            await this.transactionsService.createRefund(
              user.id,
              originalTransaction.id,
              Number(order.totalAmount),
              `Refund for cancelled order ${order.orderNumber}`,
            );
          }
        }
      } catch (error) {
        this.logger.error(
          `Failed to create refund for order ${orderId}: ${error}`,
        );
      }
    }

    const result = this.mapToResponseDto(updatedOrder);
    this.publishOrderUpdate(order.cafeId, result);
    return result;
  }

  /**
   * Get orders for cafe (for workers)
   */
  async findCafeOrders(
    cafeId: string,
    keycloakId: string,
    query: OrderListQueryDto,
  ): Promise<OrderListResponseDto> {
    // Check access
    await this.checkCafeAccess(cafeId, keycloakId);

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.OrderWhereInput = {
      cafeId,
    };

    if (query.status) {
      where.status = query.status;
    }

    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) {
        where.createdAt.gte = new Date(query.from);
      }
      if (query.to) {
        const toDate = new Date(query.to);
        toDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = toDate;
      }
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          items: true,
          cafe: {
            select: {
              name: true,
            },
          },
          user: {
            select: {
              firstName: true,
              lastName: true,
              phone: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }) as Promise<any[]>,
      this.prisma.order.count({ where }),
    ]);

    return {
      items: orders.map((order) => this.mapToResponseDto(order)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get order by ID for cafe workers
   */
  async findCafeOrder(
    orderId: string,
    keycloakId: string,
  ): Promise<OrderResponseDto> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        cafe: {
          select: {
            name: true,
          },
        },
        user: {
          select: {
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Check access
    await this.checkCafeAccess(order.cafeId, keycloakId);

    return this.mapToResponseDto(order);
  }

  /**
   * Initiate card payment asynchronously
   */
  private async initiateCardPayment(
    orderId: string,
    userId: string,
    cardId: string,
    amount: number,
    orderNumber: string,
  ): Promise<void> {
    try {
      // Check card exists
      const card = await this.prisma.paymentCard.findFirst({
        where: {
          id: cardId,
          userId,
          deletedAt: null,
          isActive: true,
        },
      });

      if (!card) {
        this.logger.error(`Card not found for order ${orderId}`);
        return;
      }

      // Create payment transaction (will be processed asynchronously)
      await this.transactionsService.createPayment(
        userId,
        cardId,
        amount,
        orderId,
        `Payment for order ${orderNumber}`,
      );

      this.logger.log(`Card payment initiated for order ${orderId}`);
    } catch (error) {
      this.logger.error(
        `Failed to initiate card payment for order ${orderId}: ${error}`,
      );
    }
  }

  /**
   * Initiate balance payment asynchronously
   */
  private async initiateBalancePayment(
    orderId: string,
    userId: string,
    amount: number,
    orderNumber: string,
  ): Promise<void> {
    try {
      // Check balance
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { balance: true },
      });

      if (!user || Number(user.balance) < amount) {
        this.logger.error(`Insufficient balance for order ${orderId}`);
        return;
      }

      // Create balance payment (synchronous - assume success)
      await this.prisma.$transaction(async (tx) => {
        // Create transaction
        await tx.transaction.create({
          data: {
            userId,
            type: 'PAYMENT',
            status: 'COMPLETED', // Balance payment is immediate
            amount,
            currency: 'BYN',
            orderId,
            description: `Payment from balance for order ${orderNumber}`,
            provider: 'balance',
          },
        });

        // Deduct from balance
        await tx.user.update({
          where: { id: userId },
          data: {
            balance: {
              decrement: amount,
            },
          },
        });

        // Update order status to CONFIRMED
        await tx.order.update({
          where: { id: orderId },
          data: {
            status: OrderStatus.CONFIRMED,
            paidAt: new Date(),
            confirmedAt: new Date(),
          },
        });
      });

      this.logger.log(`Balance payment completed for order ${orderId}`);
    } catch (error) {
      this.logger.error(
        `Failed to process balance payment for order ${orderId}: ${error}`,
      );
    }
  }

  /**
   * Map order to response DTO
   */
  private mapToResponseDto(order: unknown): OrderResponseDto {
    const ord = order as {
      id: string;
      orderNumber: string;
      userId: string;
      cafeId: string;
      cafe?: { name?: string };
      appointmentId?: string;
      status: OrderStatus;
      totalAmount: unknown;
      deliveryType?: DeliveryType;
      deliveryAddress?: string;
      contactPhone?: string;
      notes?: string;
      paymentMethod?: PaymentMethod;
      paidAt?: Date;
      confirmedAt?: Date;
      completedAt?: Date;
      cancelledAt?: Date;
      cancellationReason?: string;
      items?: Array<{
        id: string;
        itemName: string;
        quantity: number;
        unitPrice: unknown;
        totalPrice: unknown;
        notes?: string;
        createdAt: Date;
        updatedAt: Date;
      }>;
      createdAt: Date;
      updatedAt: Date;
    };

    return {
      id: ord.id,
      orderNumber: ord.orderNumber || '',
      userId: ord.userId,
      cafeId: ord.cafeId,
      cafeName: ord.cafe?.name,
      appointmentId: ord.appointmentId || undefined,
      status: ord.status,
      totalAmount:
        typeof ord.totalAmount === 'number'
          ? ord.totalAmount
          : typeof ord.totalAmount === 'string'
            ? parseFloat(ord.totalAmount)
            : ord.totalAmount &&
                typeof ord.totalAmount === 'object' &&
                'toNumber' in ord.totalAmount
              ? (ord.totalAmount as { toNumber(): number }).toNumber()
              : 0,
      deliveryType: ord.deliveryType || 'IN_CAFE',
      deliveryAddress: ord.deliveryAddress || undefined,
      contactPhone: ord.contactPhone || '',
      notes: ord.notes || undefined,
      paymentMethod: ord.paymentMethod || 'CARD',
      paidAt: ord.paidAt || undefined,
      confirmedAt: ord.confirmedAt || undefined,
      completedAt: ord.completedAt || undefined,
      cancelledAt: ord.cancelledAt || undefined,
      cancellationReason: ord.cancellationReason || undefined,
      items: (ord.items || []).map((item) => ({
        id: item.id,
        itemName: item.itemName,
        quantity: item.quantity,
        unitPrice:
          typeof item.unitPrice === 'number'
            ? item.unitPrice
            : typeof item.unitPrice === 'string'
              ? parseFloat(item.unitPrice)
              : item.unitPrice &&
                  typeof item.unitPrice === 'object' &&
                  'toNumber' in item.unitPrice
                ? (item.unitPrice as { toNumber(): number }).toNumber()
                : 0,
        totalPrice:
          typeof item.totalPrice === 'number'
            ? item.totalPrice
            : typeof item.totalPrice === 'string'
              ? parseFloat(item.totalPrice)
              : item.totalPrice &&
                  typeof item.totalPrice === 'object' &&
                  'toNumber' in item.totalPrice
                ? (item.totalPrice as { toNumber(): number }).toNumber()
                : 0,
        notes: item.notes || undefined,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
      createdAt: ord.createdAt,
      updatedAt: ord.updatedAt,
    };
  }
}
