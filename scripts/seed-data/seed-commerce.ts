import {
  ChatAuthorType,
  ChatMessageType,
  DeliveryType,
  OrderStatus,
  PaymentMethod,
  PrismaClient,
  TransactionStatus,
  TransactionType,
} from '@prisma/client';
import { IMG } from './fixtures';
import type { SeedContext } from './types';

export async function seedCommerce(
  prisma: PrismaClient,
  ctx: SeedContext,
): Promise<void> {
  console.log('\n🛒 Appointments, orders, reviews...');

  const { acc1, acc2, acc3 } = ctx.users;
  const { minskNezavisimosti, minskOktyabrskaya, brestCenter } = ctx.cafes;

  const aptAcc1Pending = await prisma.appointment.create({
    data: {
      userId: acc1.id,
      cafeId: minskNezavisimosti.id,
      dateTime: daysFromNow(3, 14),
      duration: 120,
      status: 'pending',
      totalAmount: 24,
      paymentMethod: 'CARD',
      notes: 'У окна',
    },
  });

  const aptAcc1Confirmed = await prisma.appointment.create({
    data: {
      userId: acc1.id,
      cafeId: minskNezavisimosti.id,
      dateTime: daysFromNow(5, 18),
      duration: 90,
      status: 'confirmed',
      qrCode: 'BY-APT-ACC1-01',
      totalAmount: 18,
      paymentMethod: 'CARD',
    },
  });

  await prisma.appointment.create({
    data: {
      userId: acc2.id,
      cafeId: minskOktyabrskaya.id,
      dateTime: daysFromNow(2, 12),
      duration: 60,
      status: 'cancelled',
      totalAmount: 12,
      notes: 'Отмена клиентом',
    },
  });

  const aptAcc2Confirmed = await prisma.appointment.create({
    data: {
      userId: acc2.id,
      cafeId: minskOktyabrskaya.id,
      dateTime: daysFromNow(4, 16),
      duration: 120,
      status: 'confirmed',
      qrCode: 'BY-APT-ACC2-01',
      totalAmount: 24,
    },
  });

  await prisma.appointment.createMany({
    data: [
      {
        userId: acc3.id,
        cafeId: brestCenter.id,
        dateTime: daysFromNow(1, 11),
        duration: 180,
        status: 'confirmed',
        qrCode: 'BY-APT-ACC3-01',
        totalAmount: 36,
      },
      {
        userId: acc3.id,
        cafeId: minskNezavisimosti.id,
        dateTime: daysFromNow(6, 19),
        duration: 120,
        status: 'confirmed',
        qrCode: 'BY-APT-ACC3-02',
        totalAmount: 24,
      },
    ],
  });

  const orderAcc1Done = await prisma.order.create({
    data: {
      orderNumber: 'BY-ORD-2026-001',
      userId: acc1.id,
      cafeId: minskNezavisimosti.id,
      appointmentId: aptAcc1Confirmed.id,
      status: OrderStatus.COMPLETED,
      totalAmount: 22.5,
      deliveryType: DeliveryType.IN_CAFE,
      paymentMethod: PaymentMethod.CARD,
      paidAt: daysFromNow(-2, 14),
      confirmedAt: daysFromNow(-2, 14),
      completedAt: daysFromNow(-2, 16),
    },
  });

  const orderAcc1Pending = await prisma.order.create({
    data: {
      orderNumber: 'BY-ORD-2026-002',
      userId: acc1.id,
      cafeId: minskNezavisimosti.id,
      status: OrderStatus.PENDING,
      totalAmount: 14,
      deliveryType: DeliveryType.IN_CAFE,
      paymentMethod: PaymentMethod.CARD,
    },
  });

  const orderAcc2Confirmed = await prisma.order.create({
    data: {
      orderNumber: 'BY-ORD-2026-003',
      userId: acc2.id,
      cafeId: minskOktyabrskaya.id,
      appointmentId: aptAcc2Confirmed.id,
      status: OrderStatus.CONFIRMED,
      totalAmount: 16.5,
      deliveryType: DeliveryType.IN_CAFE,
      paymentMethod: PaymentMethod.BALANCE,
      confirmedAt: new Date(),
    },
  });

  const orderAcc3Done = await prisma.order.create({
    data: {
      orderNumber: 'BY-ORD-2026-004',
      userId: acc3.id,
      cafeId: brestCenter.id,
      status: OrderStatus.COMPLETED,
      totalAmount: 28,
      deliveryType: DeliveryType.IN_CAFE,
      paymentMethod: PaymentMethod.CARD,
      paidAt: daysFromNow(-1, 12),
      completedAt: daysFromNow(-1, 14),
    },
  });

  const orderAcc3Cancelled = await prisma.order.create({
    data: {
      orderNumber: 'BY-ORD-2026-005',
      userId: acc3.id,
      cafeId: minskNezavisimosti.id,
      status: OrderStatus.CANCELLED,
      totalAmount: 10,
      deliveryType: DeliveryType.TAKEOUT,
      paymentMethod: PaymentMethod.CARD,
      cancelledAt: new Date(),
      cancellationReason: 'Нет ингредиентов',
    },
  });

  void aptAcc1Pending;

  await prisma.orderItem.createMany({
    data: [
      {
        orderId: orderAcc1Done.id,
        itemName: 'Латте',
        quantity: 2,
        unitPrice: 8.5,
        totalPrice: 17,
      },
      {
        orderId: orderAcc1Done.id,
        itemName: 'Печенье',
        quantity: 1,
        unitPrice: 4.5,
        totalPrice: 4.5,
      },
      {
        orderId: orderAcc1Pending.id,
        itemName: 'Чай',
        quantity: 2,
        unitPrice: 5,
        totalPrice: 10,
      },
      {
        orderId: orderAcc2Confirmed.id,
        itemName: 'Капучино',
        quantity: 2,
        unitPrice: 8,
        totalPrice: 16,
      },
      {
        orderId: orderAcc3Done.id,
        itemName: 'Маффин',
        quantity: 4,
        unitPrice: 6,
        totalPrice: 24,
      },
      {
        orderId: orderAcc3Cancelled.id,
        itemName: 'Чай',
        quantity: 2,
        unitPrice: 5,
        totalPrice: 10,
      },
    ],
  });

  const card1 = await prisma.paymentCard.findFirst({
    where: { userId: acc1.id },
  });

  await prisma.transaction.create({
    data: {
      userId: acc1.id,
      type: TransactionType.PAYMENT,
      status: TransactionStatus.COMPLETED,
      amount: 22.5,
      currency: 'BYN',
      orderId: orderAcc1Done.id,
      cardId: card1?.id,
      description: 'Оплата BY-ORD-2026-001',
    },
  });

  await prisma.review.createMany({
    data: [
      {
        userId: acc1.id,
        cafeId: minskNezavisimosti.id,
        orderId: orderAcc1Done.id,
        rating: 5,
        comment: 'Отличное место для работы',
        pros: ['Wi‑Fi', 'Тишина'],
        cons: [],
        photos: [IMG.review],
        isVerified: true,
        verifiedAt: new Date(),
      },
      {
        userId: acc3.id,
        cafeId: brestCenter.id,
        orderId: orderAcc3Done.id,
        rating: 4.5,
        comment: 'Уютно и вкусно',
        pros: ['Персонал'],
        cons: ['Мало розеток'],
        photos: [IMG.review],
        isVerified: true,
        verifiedAt: new Date(),
      },
    ],
  });

  const chat = await prisma.orderChat.create({
    data: {
      orderId: orderAcc1Pending.id,
      cafeId: minskNezavisimosti.id,
      userId: acc1.id,
      brandId: ctx.brands.timeCafeBy.id,
      isEnabled: true,
    },
  });

  const msg = await prisma.orderChatMessage.create({
    data: {
      chatId: chat.id,
      orderId: orderAcc1Pending.id,
      cafeId: minskNezavisimosti.id,
      authorType: ChatAuthorType.USER,
      authorUserId: acc1.id,
      messageType: ChatMessageType.TEXT,
      text: 'Можно без сахара?',
    },
  });

  await prisma.orderChatMessage.create({
    data: {
      chatId: chat.id,
      orderId: orderAcc1Pending.id,
      cafeId: minskNezavisimosti.id,
      authorType: ChatAuthorType.WORKER,
      authorWorkerId: ctx.workers.multiacc[3].id,
      messageType: ChatMessageType.TEXT,
      text: 'Конечно, сделаем!',
    },
  });

  await prisma.orderChatReadState.create({
    data: {
      chatId: chat.id,
      userId: acc1.id,
      unreadCount: 1,
      lastReadMessageId: msg.id,
      lastReadAt: new Date(),
    },
  });
}

function daysFromNow(days: number, hour = 12): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d;
}
