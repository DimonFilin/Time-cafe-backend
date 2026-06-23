import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const GUEST_EMAIL = process.env.GUEST_EMAIL?.trim() || 'maria.demo@user.demo';
const EXECUTE = process.argv.includes('--execute');

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: GUEST_EMAIL, deletedAt: null },
    select: { id: true, email: true, firstName: true, lastName: true },
  });

  if (!user) {
    console.error(`User not found: ${GUEST_EMAIL}`);
    process.exit(1);
  }

  console.log(
    `Guest: ${user.firstName} ${user.lastName} <${user.email}> (${user.id})`,
  );

  const appointments = await prisma.appointment.findMany({
    where: { userId: user.id },
    select: { id: true, dateTime: true, status: true, cafeId: true },
    orderBy: { dateTime: 'desc' },
  });

  const orders = await prisma.order.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      orderNumber: true,
      appointmentId: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const orderIds = orders.map((o) => o.id);
  const appointmentIds = appointments.map((a) => a.id);

  const [chats, reservations, transactions, reviews] = await Promise.all([
    prisma.orderChat.count({ where: { userId: user.id } }),
    prisma.cafeSharedAssetReservation.count({
      where: { appointmentId: { in: appointmentIds } },
    }),
    prisma.transaction.count({
      where: {
        OR: [{ userId: user.id }, { orderId: { in: orderIds } }],
      },
    }),
    prisma.review.count({ where: { orderId: { in: orderIds } } }),
  ]);

  console.log('\nCounts to remove:');
  console.log(`  appointments: ${appointments.length}`);
  console.log(`  orders: ${orders.length}`);
  console.log(`  order chats: ${chats}`);
  console.log(`  shared asset reservations: ${reservations}`);
  console.log(`  transactions: ${transactions}`);
  console.log(`  reviews: ${reviews}`);

  if (appointments.length) {
    console.log('\nAppointments:');
    for (const apt of appointments) {
      console.log(`  - ${apt.id} ${apt.status} ${apt.dateTime.toISOString()}`);
    }
  }

  if (orders.length) {
    console.log('\nOrders:');
    for (const order of orders) {
      console.log(
        `  - ${order.orderNumber} (${order.id}) apt=${order.appointmentId ?? '—'}`,
      );
    }
  }

  if (!EXECUTE) {
    console.log('\nDry-run only. Re-run with --execute to delete.');
    return;
  }

  await prisma.$transaction(async (tx) => {
    if (appointmentIds.length) {
      await tx.cafeSharedAssetReservation.deleteMany({
        where: { appointmentId: { in: appointmentIds } },
      });
    }

    if (orderIds.length) {
      await tx.transaction.deleteMany({
        where: { orderId: { in: orderIds } },
      });
      await tx.review.deleteMany({ where: { orderId: { in: orderIds } } });
      await tx.order.deleteMany({ where: { id: { in: orderIds } } });
    }

    if (appointmentIds.length) {
      await tx.appointment.updateMany({
        where: { id: { in: appointmentIds } },
        data: { transactionId: null },
      });
      await tx.appointment.deleteMany({
        where: { id: { in: appointmentIds } },
      });
    }

    const orphanTx = await tx.transaction.deleteMany({
      where: {
        userId: user.id,
        orderId: null,
        description: { contains: 'appointment', mode: 'insensitive' },
      },
    });
    if (orphanTx.count) {
      console.log(
        `  removed orphan appointment transactions: ${orphanTx.count}`,
      );
    }
  });

  console.log('\nCleanup completed.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
