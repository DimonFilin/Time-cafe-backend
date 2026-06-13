import { OrderStatus, PrismaClient } from '@prisma/client';
import type { ShowcaseCore } from './seed-showcase-core';
import type { ShowcaseUsers } from './seed-showcase-users';

/** Бронь + заказ для демо Марии на Независимости */
export async function seedShowcaseDemoBooking(
  prisma: PrismaClient,
  core: ShowcaseCore,
  users: ShowcaseUsers,
): Promise<void> {
  console.log('\n📅 Demo appointment + order (maria @ nezavisimosti)...');

  const maria = users.maria;
  const cafeId = core.cafes.nezavisimosti.id;
  const room = await prisma.cafeRoom.findFirst({
    where: { cafeId },
    orderBy: { createdAt: 'asc' },
  });
  if (!room) return;

  const dateTime = new Date();
  dateTime.setHours(dateTime.getHours() + 3, 0, 0, 0);

  const apt = await prisma.appointment.create({
    data: {
      userId: maria.id,
      cafeId,
      roomId: room.id,
      dateTime,
      duration: 120,
      status: 'confirmed',
      qrCode: 'DEMO-MARIA-APT-01',
      totalAmount: 24,
      paymentMethod: 'CARD',
      notes: 'Демо-бронь для защиты',
      roomSnapshot: {
        roomId: room.id,
        name: room.name,
        capacity: room.capacity,
      },
    },
  });

  const order = await prisma.order.create({
    data: {
      orderNumber: 'DEMO-ORD-2026-001',
      userId: maria.id,
      cafeId,
      appointmentId: apt.id,
      status: OrderStatus.CONFIRMED,
      totalAmount: 18.5,
      contactPhone: '+375-29-101-01-01',
      confirmedAt: new Date(),
    },
  });

  const items = await prisma.cafeMenuItem.findMany({
    where: { cafeId },
    take: 2,
  });
  for (const item of items) {
    const price = Number(item.price);
    await prisma.orderItem.create({
      data: {
        orderId: order.id,
        itemName: item.name,
        quantity: 1,
        unitPrice: price,
        totalPrice: price,
      },
    });
  }

  await prisma.orderChat.create({
    data: {
      orderId: order.id,
      cafeId,
      userId: maria.id,
      brandId: core.brands.timecafe.id,
      isEnabled: true,
    },
  });

  console.log('   appointment:', apt.id, 'order:', order.id);
}
