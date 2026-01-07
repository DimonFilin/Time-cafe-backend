/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OrderStatus, Prisma, WorkerRole } from '@prisma/client';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderResponseDto } from './dto/order-response.dto';
import { OrderListQueryDto } from './dto/order-list-query.dto';
import { OrderListResponseDto } from './dto/order-list-response.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { UsersService } from '../users/users.service';
import { TransactionsService } from '../payments/services/transactions.service';
import { WorkersService } from '../workers/workers.service';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly transactionsService: TransactionsService,
    private readonly workersService: WorkersService,
  ) {}

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

    // Create order in transaction
    // Prisma transaction types are complex, using 'as any' for compatibility with extended Order model

    const order = await this.prisma.$transaction(async (tx) => {
      // Generate order number
      let orderNumber = this.generateOrderNumber();

      let exists = await (tx.order as any).findFirst({
        where: { orderNumber: orderNumber as any },
      });
      while (exists) {
        orderNumber = this.generateOrderNumber();

        exists = await (tx.order as any).findFirst({
          where: { orderNumber: orderNumber as any },
        });
      }

      // Create order

      const newOrder = await (tx.order as any).create({
        data: {
          orderNumber,
          userId: user.id,
          cafeId: createOrderDto.cafeId,
          appointmentId: createOrderDto.appointmentId || null,
          status: OrderStatus.PENDING,
          totalAmount,

          deliveryType: (createOrderDto.deliveryType as any) || 'IN_CAFE',
          deliveryAddress: createOrderDto.deliveryAddress || null,
          contactPhone: createOrderDto.contactPhone,
          notes: createOrderDto.notes || null,

          paymentMethod: paymentMethod as any,
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

      // Process payment if needed
      if (paymentMethod === 'CARD' && createOrderDto.cardId) {
        try {
          // Check card exists
          const card = await tx.paymentCard.findFirst({
            where: {
              id: createOrderDto.cardId,
              userId: user.id,
              deletedAt: null,
              isActive: true,
            },
          });

          if (!card) {
            throw new BadRequestException('Payment card not found');
          }

          // Create transaction within the same DB transaction
          await tx.transaction.create({
            data: {
              userId: user.id,
              type: 'PAYMENT',
              status: 'COMPLETED',
              amount: totalAmount,
              currency: 'BYN',
              cardId: createOrderDto.cardId,
              orderId: newOrder.id,
              description: `Payment for order ${orderNumber}`,
              provider: 'stripe',
              providerTransactionId: `ch_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            },
          });

          // Update order status and return updated order

          const updatedOrder = await (tx.order as any).update({
            where: { id: newOrder.id },
            data: {
              status: OrderStatus.CONFIRMED,
              paidAt: new Date(),
              confirmedAt: new Date(),
            } as any,
            include: {
              items: true,
              cafe: {
                select: {
                  name: true,
                },
              },
            },
          });
          return updatedOrder;
        } catch (error) {
          this.logger.error(
            `Payment failed for order ${newOrder.id}: ${error}`,
          );
          // Order remains PENDING, payment can be retried
        }
      } else if (paymentMethod === 'BALANCE') {
        // Check balance
        const currentBalance = await tx.user.findUnique({
          where: { id: user.id },
          select: { balance: true },
        });

        if (!currentBalance || Number(currentBalance.balance) < totalAmount) {
          throw new BadRequestException('Insufficient balance');
        }

        // Create transaction
        await tx.transaction.create({
          data: {
            userId: user.id,
            type: 'PAYMENT',
            status: 'COMPLETED',
            amount: totalAmount,
            currency: 'BYN',
            orderId: newOrder.id,
            description: `Payment from balance for order ${orderNumber}`,
            provider: 'balance',
          },
        });

        // Update user balance
        await tx.user.update({
          where: { id: user.id },
          data: {
            balance: {
              decrement: totalAmount,
            },
          },
        });

        // Update order status

        const updatedOrder = await (tx.order as any).update({
          where: { id: newOrder.id },
          data: {
            status: OrderStatus.CONFIRMED,
            paidAt: new Date(),
            confirmedAt: new Date(),
          } as any,
          include: {
            items: true,
            cafe: {
              select: {
                name: true,
              },
            },
          },
        });

        return updatedOrder;
      }

      return newOrder;
    });

    return this.mapToResponseDto(order);
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
      (this.prisma.order as any).findMany({
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
      }),
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

    const order = await (this.prisma.order as any).findFirst({
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
    const order = await (this.prisma.order as any).findUnique({
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

    if (
      !validTransitions[order.status as OrderStatus].includes(updateDto.status)
    ) {
      throw new BadRequestException(
        `Cannot change status from ${order.status} to ${updateDto.status}`,
      );
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

    if (updateDto.status === OrderStatus.CONFIRMED && !order.confirmedAt) {
      (updateData as any).confirmedAt = new Date();
    }

    if (updateDto.status === OrderStatus.COMPLETED) {
      (updateData as any).completedAt = new Date();
    }

    if (updateDto.status === OrderStatus.CANCELLED) {
      (updateData as any).cancelledAt = new Date();

      (updateData as any).cancellationReason = updateDto.cancellationReason;
    }

    const updatedOrder = await (this.prisma.order as any).update({
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

    return this.mapToResponseDto(updatedOrder);
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

    const order = await (this.prisma.order as any).findFirst({
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
    const updatedOrder = await (this.prisma.order as any).update({
      where: { id: orderId },
      data: {
        status: OrderStatus.CANCELLED,
        cancelledAt: new Date(),
        cancellationReason: reason || 'Cancelled by user',
      } as any,
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

    return this.mapToResponseDto(updatedOrder);
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
      (this.prisma.order as any).findMany({
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
      }),
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
    const order = await (this.prisma.order as any).findUnique({
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
   * Map order to response DTO
   */
  private mapToResponseDto(order: any): OrderResponseDto {
    return {
      id: order.id,
      orderNumber: order.orderNumber || '',
      userId: order.userId,
      cafeId: order.cafeId,
      cafeName: order.cafe?.name,
      appointmentId: order.appointmentId || undefined,
      status: order.status,
      totalAmount: Number(order.totalAmount),
      deliveryType: order.deliveryType || 'IN_CAFE',
      deliveryAddress: order.deliveryAddress || undefined,
      contactPhone: order.contactPhone || '',
      notes: order.notes || undefined,
      paymentMethod: order.paymentMethod || 'CARD',
      paidAt: order.paidAt || undefined,
      confirmedAt: order.confirmedAt || undefined,
      completedAt: order.completedAt || undefined,
      cancelledAt: order.cancelledAt || undefined,
      cancellationReason: order.cancellationReason || undefined,
      items: (order.items || []).map((item: any) => ({
        id: item.id,
        itemName: item.itemName,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.totalPrice),
        notes: item.notes || undefined,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }
}
