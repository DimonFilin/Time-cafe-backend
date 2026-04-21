import {
  PrismaClient,
  WorkerRole,
  OrderStatus,
  DeliveryType,
  PaymentMethod,
  TransactionType,
  TransactionStatus,
  BrandStatus,
  DocumentType,
  ActivityAction,
  ActivityCategory,
  LogSeverity,
} from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

// Keycloak configuration
const KEYCLOAK_URL = process.env.KEYCLOAK_URL || 'http://localhost:8080';
const KEYCLOAK_REALM = process.env.KEYCLOAK_REALM || 'time-cafe-shared';
const KEYCLOAK_ADMIN_USERNAME = process.env.KEYCLOAK_ADMIN_USERNAME || 'admin';
const KEYCLOAK_ADMIN_PASSWORD = process.env.KEYCLOAK_ADMIN_PASSWORD || 'admin';

interface KeycloakTokenResponse {
  access_token: string;
}

interface KeycloakUserResponse {
  id: string;
  email?: string;
}

// Get Keycloak admin token
async function getKeycloakAdminToken(): Promise<string> {
  try {
    const response = await axios.post<KeycloakTokenResponse>(
      `${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token`,
      new URLSearchParams({
        grant_type: 'password',
        client_id: 'admin-cli',
        username: KEYCLOAK_ADMIN_USERNAME,
        password: KEYCLOAK_ADMIN_PASSWORD,
      }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      },
    );
    return response.data.access_token;
  } catch (error) {
    console.error('❌ Failed to get Keycloak admin token');
    console.error('   Make sure Keycloak is running on:', KEYCLOAK_URL);
    console.error(
      '   Admin credentials:',
      KEYCLOAK_ADMIN_USERNAME,
      '/',
      KEYCLOAK_ADMIN_PASSWORD,
    );
    if (axios.isAxiosError(error) && error.response) {
      console.error('   Error:', error.response.data);
    }
    throw error;
  }
}

// Create user in Keycloak
async function createKeycloakUser(
  token: string,
  email: string,
  password: string,
  firstName: string,
  lastName: string,
): Promise<string> {
  try {
    // Create user
    const createResponse = await axios.post(
      `${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/users`,
      {
        username: email,
        email: email,
        firstName: firstName,
        lastName: lastName,
        enabled: true,
        emailVerified: true,
        credentials: [
          {
            type: 'password',
            value: password,
            temporary: false,
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      },
    );

    // Get user ID from Location header
    const location = createResponse.headers.location as string | undefined;
    const parts = location?.split('/');
    const userId = parts?.[parts.length - 1] ?? '';

    console.log(`✓ Created Keycloak user: ${email} (ID: ${userId})`);
    return userId;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 409) {
      // User already exists, get their ID
      const usersResponse = await axios.get<KeycloakUserResponse[]>(
        `${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/users?email=${email}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (usersResponse.data.length > 0) {
        const userId = usersResponse.data[0].id;
        console.log(`✓ User already exists: ${email} (ID: ${userId})`);
        return userId;
      }
    }
    const errorMessage =
      axios.isAxiosError(error) && error.response
        ? JSON.stringify(error.response.data)
        : error instanceof Error
          ? error.message
          : 'Unknown error';
    console.error(`Failed to create Keycloak user ${email}:`, errorMessage);
    throw error;
  }
}

async function main() {
  console.log('🌱 Starting database seeding...\n');

  try {
    // Get Keycloak admin token
    console.log('🔑 Getting Keycloak admin token...');
    const adminToken = await getKeycloakAdminToken();
    console.log('✓ Got admin token\n');

    // 1. Create Multi-Account Worker with all roles
    console.log('👤 Creating multi-account worker...');
    const multiAccountKeycloakId = await createKeycloakUser(
      adminToken,
      'multiacc.email@gmail.com',
      'MultiAccount2026!',
      'Multi',
      'Account',
    );

    // 2. Create Regions
    console.log('\n🌍 Creating regions...');
    const regionMoscow = await prisma.region.create({
      data: {
        name: 'Москва',
        country: 'Россия',
      },
    });
    const regionSpb = await prisma.region.create({
      data: {
        name: 'Санкт-Петербург',
        country: 'Россия',
      },
    });
    console.log(`✓ Created regions: ${regionMoscow.name}, ${regionSpb.name}`);

    // 3. Create Brands
    console.log('\n🏢 Creating brands...');
    const brandCoffeeHouse = await prisma.brand.create({
      data: {
        name: 'Coffee House',
        description: 'Сеть премиальных кофеен',
        logo: 'https://example.com/logos/coffeehouse.png',
        primaryColor: '#8B4513',
        secondaryColor: '#D2691E',
        accentColor: '#FFD700',
        website: 'https://coffeehouse.ru',
        phone: '+7 (495) 123-45-67',
        email: 'info@coffeehouse.ru',
        status: BrandStatus.ACTIVE,
        isVerified: true,
        verifiedAt: new Date(),
      },
    });

    const brandTimeCafe = await prisma.brand.create({
      data: {
        name: 'Time Cafe',
        description: 'Антикафе с почасовой оплатой',
        logo: 'https://example.com/logos/timecafe.png',
        primaryColor: '#4A90E2',
        secondaryColor: '#50C878',
        accentColor: '#FF6B6B',
        website: 'https://timecafe.ru',
        phone: '+7 (495) 987-65-43',
        email: 'info@timecafe.ru',
        status: BrandStatus.ACTIVE,
        isVerified: true,
        verifiedAt: new Date(),
      },
    });
    console.log(
      `✓ Created brands: ${brandCoffeeHouse.name}, ${brandTimeCafe.name}`,
    );

    // 4. Create Cafes
    console.log('\n☕ Creating cafes...');
    const cafe1 = await prisma.cafe.create({
      data: {
        name: 'Coffee House Арбат',
        description: 'Уютная кофейня в центре Москвы',
        address: 'ул. Арбат, 15',
        city: 'Москва',
        street: 'ул. Арбат',
        latitude: 55.751244,
        longitude: 37.618423,
        photos: [
          'https://example.com/photos/cafe1-1.jpg',
          'https://example.com/photos/cafe1-2.jpg',
        ],
        rating: 4.5,
        reviewsCount: 120,
        brandId: brandCoffeeHouse.id,
        regionId: regionMoscow.id,
        cafeApiUrl: 'http://localhost:3001',
      },
    });

    const cafe2 = await prisma.cafe.create({
      data: {
        name: 'Time Cafe Невский',
        description: 'Антикафе на Невском проспекте',
        address: 'Невский проспект, 28',
        city: 'Санкт-Петербург',
        street: 'Невский проспект',
        latitude: 59.93428,
        longitude: 30.335099,
        photos: ['https://example.com/photos/cafe2-1.jpg'],
        rating: 4.8,
        reviewsCount: 85,
        brandId: brandTimeCafe.id,
        regionId: regionSpb.id,
        cafeApiUrl: 'http://localhost:3002',
      },
    });
    console.log(`✓ Created cafes: ${cafe1.name}, ${cafe2.name}`);

    // 5. Create Worker Accounts for Multi-Account user (all roles)
    console.log('\n👥 Creating worker accounts for multi-account user...');

    const workerSystemAdmin = await prisma.workerAccount.create({
      data: {
        keycloakId: multiAccountKeycloakId,
        email: 'multiacc.email@gmail.com',
        firstName: 'Multi',
        lastName: 'Account (System Admin)',
        role: WorkerRole.SYSTEM_ADMIN,
      },
    });

    const workerBrandAdmin = await prisma.workerAccount.create({
      data: {
        keycloakId: multiAccountKeycloakId,
        email: 'multiacc.email@gmail.com',
        firstName: 'Multi',
        lastName: 'Account (Brand Admin)',
        role: WorkerRole.BRAND_ADMIN,
        brandId: brandCoffeeHouse.id,
      },
    });

    const workerCafeAdmin = await prisma.workerAccount.create({
      data: {
        keycloakId: multiAccountKeycloakId,
        email: 'multiacc.email@gmail.com',
        firstName: 'Multi',
        lastName: 'Account (Cafe Admin)',
        role: WorkerRole.CAFE_ADMIN,
        brandId: brandCoffeeHouse.id,
        cafeId: cafe1.id,
      },
    });

    const workerWorker = await prisma.workerAccount.create({
      data: {
        keycloakId: multiAccountKeycloakId,
        email: 'multiacc.email@gmail.com',
        firstName: 'Multi',
        lastName: 'Account (Worker)',
        role: WorkerRole.WORKER,
        brandId: brandTimeCafe.id,
        cafeId: cafe2.id,
      },
    });
    console.log(
      `✓ Created 4 worker accounts for multi-account user (all roles)`,
    );

    // 6. Create additional workers
    console.log('\n👥 Creating additional workers...');
    const adminKeycloakId = await createKeycloakUser(
      adminToken,
      'admin@system.com',
      'Admin2026!',
      'System',
      'Administrator',
    );

    const workerAdmin = await prisma.workerAccount.create({
      data: {
        keycloakId: adminKeycloakId,
        email: 'admin@system.com',
        firstName: 'System',
        lastName: 'Administrator',
        role: WorkerRole.SYSTEM_ADMIN,
      },
    });

    const brandAdminKeycloakId = await createKeycloakUser(
      adminToken,
      'brand.admin@coffeehouse.ru',
      'Brand2026!',
      'Brand',
      'Manager',
    );

    const workerBrandMgr = await prisma.workerAccount.create({
      data: {
        keycloakId: brandAdminKeycloakId,
        email: 'brand.admin@coffeehouse.ru',
        firstName: 'Brand',
        lastName: 'Manager',
        role: WorkerRole.BRAND_ADMIN,
        brandId: brandCoffeeHouse.id,
      },
    });
    console.log(`✓ Created additional workers: System Admin, Brand Manager`);

    // 7. Create Users
    console.log('\n👤 Creating users...');
    const user1KeycloakId = await createKeycloakUser(
      adminToken,
      'ivan.petrov@example.com',
      'User2026!',
      'Иван',
      'Петров',
    );

    const user1 = await prisma.user.create({
      data: {
        keycloakId: user1KeycloakId,
        email: 'ivan.petrov@example.com',
        firstName: 'Иван',
        lastName: 'Петров',
        phone: '+7 (999) 123-45-67',
        avatar: 'https://example.com/avatars/user1.jpg',
        balance: 1500.0,
      },
    });

    const user2KeycloakId = await createKeycloakUser(
      adminToken,
      'maria.ivanova@example.com',
      'User2026!',
      'Мария',
      'Иванова',
    );

    const user2 = await prisma.user.create({
      data: {
        keycloakId: user2KeycloakId,
        email: 'maria.ivanova@example.com',
        firstName: 'Мария',
        lastName: 'Иванова',
        phone: '+7 (999) 987-65-43',
        avatar: 'https://example.com/avatars/user2.jpg',
        balance: 2500.0,
      },
    });
    console.log(
      `✓ Created users: ${user1.firstName} ${user1.lastName}, ${user2.firstName} ${user2.lastName}`,
    );

    // 8. Create Payment Cards
    console.log('\n💳 Creating payment cards...');
    const card1 = await prisma.paymentCard.create({
      data: {
        userId: user1.id,
        last4Digits: '4242',
        cardType: 'visa',
        expiryMonth: 12,
        expiryYear: 2026,
        providerToken: 'tok_visa_4242',
        isDefault: true,
        holderName: 'IVAN PETROV',
      },
    });

    await prisma.paymentCard.create({
      data: {
        userId: user2.id,
        last4Digits: '5555',
        cardType: 'mastercard',
        expiryMonth: 6,
        expiryYear: 2027,
        providerToken: 'tok_mc_5555',
        isDefault: true,
        holderName: 'MARIA IVANOVA',
      },
    });
    console.log(`✓ Created payment cards for users`);

    // 9. Create Appointments
    console.log('\n📅 Creating appointments...');
    const appointment1 = await prisma.appointment.create({
      data: {
        userId: user1.id,
        cafeId: cafe1.id,
        dateTime: new Date('2026-02-10T14:00:00'),
        duration: 120,
        status: 'confirmed',
        qrCode: 'QR-APT-001',
        totalAmount: 600.0,
        paymentMethod: 'CARD',
        notes: 'Столик у окна',
      },
    });

    await prisma.appointment.create({
      data: {
        userId: user2.id,
        cafeId: cafe2.id,
        dateTime: new Date('2026-02-11T16:00:00'),
        duration: 180,
        status: 'pending',
        qrCode: 'QR-APT-002',
        totalAmount: 900.0,
        paymentMethod: 'BALANCE',
        notes: 'Тихое место для работы',
      },
    });
    console.log(`✓ Created appointments`);

    // 10. Create Orders
    console.log('\n🛒 Creating orders...');
    const order1 = await prisma.order.create({
      data: {
        orderNumber: 'ORD-2026-001',
        userId: user1.id,
        cafeId: cafe1.id,
        appointmentId: appointment1.id,
        status: OrderStatus.COMPLETED,
        totalAmount: 850.0,
        deliveryType: DeliveryType.IN_CAFE,
        paymentMethod: PaymentMethod.CARD,
        paidAt: new Date('2026-02-10T14:05:00'),
        confirmedAt: new Date('2026-02-10T14:10:00'),
        completedAt: new Date('2026-02-10T16:30:00'),
      },
    });

    const order2 = await prisma.order.create({
      data: {
        orderNumber: 'ORD-2026-002',
        userId: user2.id,
        cafeId: cafe2.id,
        status: OrderStatus.PENDING,
        totalAmount: 450.0,
        deliveryType: DeliveryType.TAKEOUT,
        paymentMethod: PaymentMethod.BALANCE,
        contactPhone: '+7 (999) 987-65-43',
      },
    });
    console.log(
      `✓ Created orders: ${order1.orderNumber}, ${order2.orderNumber}`,
    );

    // 11. Create Order Items
    console.log('\n📦 Creating order items...');
    await prisma.orderItem.createMany({
      data: [
        {
          orderId: order1.id,
          itemName: 'Капучино',
          quantity: 2,
          unitPrice: 250.0,
          totalPrice: 500.0,
        },
        {
          orderId: order1.id,
          itemName: 'Чизкейк',
          quantity: 1,
          unitPrice: 350.0,
          totalPrice: 350.0,
        },
        {
          orderId: order2.id,
          itemName: 'Латте',
          quantity: 1,
          unitPrice: 300.0,
          totalPrice: 300.0,
        },
        {
          orderId: order2.id,
          itemName: 'Круассан',
          quantity: 1,
          unitPrice: 150.0,
          totalPrice: 150.0,
        },
      ],
    });
    console.log(`✓ Created order items`);

    // 12. Create Transactions
    console.log('\n💰 Creating transactions...');
    await prisma.transaction.create({
      data: {
        userId: user1.id,
        type: TransactionType.PAYMENT,
        status: TransactionStatus.COMPLETED,
        amount: 850.0,
        currency: 'BYN',
        orderId: order1.id,
        cardId: card1.id,
        provider: 'stripe',
        providerTransactionId: 'pi_1234567890',
        description: 'Оплата заказа ORD-2026-001',
      },
    });

    await prisma.transaction.create({
      data: {
        userId: user2.id,
        type: TransactionType.PAYMENT,
        status: TransactionStatus.PENDING,
        amount: 450.0,
        currency: 'BYN',
        orderId: order2.id,
        description: 'Оплата заказа ORD-2026-002 с баланса',
      },
    });
    console.log(`✓ Created transactions`);

    // 13. Create Reviews
    console.log('\n⭐ Creating reviews...');
    await prisma.review.create({
      data: {
        userId: user1.id,
        cafeId: cafe1.id,
        orderId: order1.id,
        rating: 4.5,
        comment: 'Отличное место! Вкусный кофе и приятная атмосфера.',
        pros: ['Вкусный кофе', 'Уютная атмосфера', 'Быстрое обслуживание'],
        cons: ['Немного шумно'],
        photos: ['https://example.com/reviews/review1-1.jpg'],
        isVerified: true,
        verifiedAt: new Date(),
        verifiedBy: workerAdmin.id,
      },
    });

    await prisma.review.create({
      data: {
        userId: user2.id,
        cafeId: cafe2.id,
        rating: 5.0,
        comment: 'Идеальное место для работы! Тихо, комфортно, есть розетки.',
        pros: ['Тихо', 'Удобные места', 'Быстрый WiFi', 'Много розеток'],
        cons: [],
        photos: [
          'https://example.com/reviews/review2-1.jpg',
          'https://example.com/reviews/review2-2.jpg',
        ],
        isVerified: true,
        verifiedAt: new Date(),
        verifiedBy: workerAdmin.id,
      },
    });
    console.log(`✓ Created reviews`);

    // 14. Create Brand Documents
    console.log('\n📄 Creating brand documents...');
    await prisma.brandDocument.createMany({
      data: [
        {
          brandId: brandCoffeeHouse.id,
          type: DocumentType.REGISTRATION,
          name: 'Свидетельство о регистрации',
          fileUrl: 'https://example.com/docs/coffeehouse-registration.pdf',
          fileType: 'application/pdf',
          fileSize: 1024000,
          isVerified: true,
          verifiedAt: new Date(),
          verifiedBy: workerAdmin.id,
        },
        {
          brandId: brandCoffeeHouse.id,
          type: DocumentType.LICENSE,
          name: 'Лицензия на деятельность',
          fileUrl: 'https://example.com/docs/coffeehouse-license.pdf',
          fileType: 'application/pdf',
          fileSize: 2048000,
          isVerified: true,
          verifiedAt: new Date(),
          verifiedBy: workerAdmin.id,
        },
        {
          brandId: brandTimeCafe.id,
          type: DocumentType.REGISTRATION,
          name: 'Свидетельство о регистрации',
          fileUrl: 'https://example.com/docs/timecafe-registration.pdf',
          fileType: 'application/pdf',
          fileSize: 1536000,
          isVerified: false,
        },
      ],
    });
    console.log(`✓ Created brand documents`);

    // 15. Create Brand API Keys
    console.log('\n🔑 Creating brand API keys...');
    await prisma.brandApiKey.createMany({
      data: [
        {
          brandId: brandCoffeeHouse.id,
          name: 'Production API Key',
          keyHash: 'hash_prod_coffeehouse_12345',
          prefix: 'ch_prod',
          permissions: ['read:orders', 'write:orders', 'read:cafes'],
          isActive: true,
          lastUsedAt: new Date(),
        },
        {
          brandId: brandTimeCafe.id,
          name: 'Development API Key',
          keyHash: 'hash_dev_timecafe_67890',
          prefix: 'tc_dev',
          permissions: ['read:orders', 'read:cafes', 'read:users'],
          isActive: true,
        },
      ],
    });
    console.log(`✓ Created brand API keys`);

    // 16. Create System Settings
    console.log('\n⚙️ Creating system settings...');
    await prisma.systemSettings.upsert({
      where: { id: 'system' },
      update: {},
      create: {
        id: 'system',
        settings: {
          maintenanceMode: false,
          allowRegistration: true,
          minOrderAmount: 100,
          maxOrderAmount: 50000,
          defaultCurrency: 'BYN',
          supportEmail: 'support@timecafe.ru',
          supportPhone: '+7 (800) 555-35-35',
        },
        updatedBy: workerAdmin.id,
      },
    });
    console.log(`✓ Created system settings`);

    // 17. Create Activity Logs
    console.log('\n📊 Creating activity logs...');
    await prisma.activityLog.createMany({
      data: [
        {
          workerId: workerSystemAdmin.id,
          workerEmail: workerSystemAdmin.email,
          workerRole: workerSystemAdmin.role,
          action: ActivityAction.LOGIN,
          category: ActivityCategory.AUTH,
          severity: LogSeverity.INFO,
          resourceType: 'AUTH',
          details: { method: 'keycloak', success: true },
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0',
          endpoint: '/api/auth/login',
          method: 'POST',
          statusCode: 200,
          duration: 150,
        },
        {
          workerId: workerBrandAdmin.id,
          workerEmail: workerBrandAdmin.email,
          workerRole: workerBrandAdmin.role,
          brandId: brandCoffeeHouse.id,
          action: ActivityAction.CREATE,
          category: ActivityCategory.DATA,
          severity: LogSeverity.INFO,
          resourceType: 'ORDER',
          resourceId: order1.id,
          details: { orderNumber: order1.orderNumber, amount: 850.0 },
          ipAddress: '192.168.1.101',
          userAgent: 'Mozilla/5.0',
          endpoint: '/api/orders',
          method: 'POST',
          statusCode: 201,
          duration: 250,
        },
        {
          workerId: workerCafeAdmin.id,
          workerEmail: workerCafeAdmin.email,
          workerRole: workerCafeAdmin.role,
          brandId: brandCoffeeHouse.id,
          cafeId: cafe1.id,
          action: ActivityAction.UPDATE,
          category: ActivityCategory.DATA,
          severity: LogSeverity.INFO,
          resourceType: 'ORDER',
          resourceId: order1.id,
          details: {
            oldStatus: 'PENDING',
            newStatus: 'CONFIRMED',
            reason: 'Order confirmed by cafe admin',
          },
          ipAddress: '192.168.1.102',
          userAgent: 'Mozilla/5.0',
          endpoint: '/api/orders/' + order1.id,
          method: 'PATCH',
          statusCode: 200,
          duration: 180,
        },
        {
          workerId: workerWorker.id,
          workerEmail: workerWorker.email,
          workerRole: workerWorker.role,
          brandId: brandTimeCafe.id,
          cafeId: cafe2.id,
          action: ActivityAction.VIEW_LIST,
          category: ActivityCategory.VIEW,
          severity: LogSeverity.INFO,
          resourceType: 'ORDER',
          details: { filters: { status: 'PENDING' }, count: 5 },
          ipAddress: '192.168.1.103',
          userAgent: 'Mozilla/5.0',
          endpoint: '/api/orders',
          method: 'GET',
          statusCode: 200,
          duration: 120,
        },
        {
          workerId: workerBrandMgr.id,
          workerEmail: workerBrandMgr.email,
          workerRole: workerBrandMgr.role,
          brandId: brandCoffeeHouse.id,
          action: ActivityAction.UPDATE_SETTINGS,
          category: ActivityCategory.CONFIG,
          severity: LogSeverity.WARNING,
          resourceType: 'BRAND',
          resourceId: brandCoffeeHouse.id,
          details: {
            field: 'primaryColor',
            oldValue: '#000000',
            newValue: '#8B4513',
          },
          ipAddress: '192.168.1.104',
          userAgent: 'Mozilla/5.0',
          endpoint: '/api/brands/' + brandCoffeeHouse.id,
          method: 'PATCH',
          statusCode: 200,
          duration: 200,
        },
      ],
    });
    console.log(`✓ Created activity logs`);

    console.log('\n✅ Database seeding completed successfully!\n');
    console.log('📋 Summary:');
    console.log(
      '   - Multi-account worker: multiacc.email@gmail.com / MultiAccount2026!',
    );
    console.log('   - System Admin: admin@system.com / Admin2026!');
    console.log('   - Brand Admin: brand.admin@coffeehouse.ru / Brand2026!');
    console.log('   - User 1: ivan.petrov@example.com / User2026!');
    console.log('   - User 2: maria.ivanova@example.com / User2026!');
    console.log('   - 2 Regions, 2 Brands, 2 Cafes');
    console.log('   - 2 Orders with items, 2 Transactions');
    console.log('   - 2 Reviews, 3 Brand Documents, 2 API Keys');
    console.log('   - Activity logs for all worker roles\n');
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
