import { PrismaClient, WorkerRole } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

const EMAIL = 'multiacc.email@gmail.com';
const PASSWORD = 'MultiAccount2026!';
const FIRST_NAME = 'Multi';
const LAST_NAME = 'Account';

const KEYCLOAK_URL = process.env.KEYCLOAK_URL || 'http://localhost:8080';
const KEYCLOAK_REALM = process.env.KEYCLOAK_REALM || 'time-cafe-shared';
const KEYCLOAK_ADMIN_USERNAME = process.env.KEYCLOAK_ADMIN_USERNAME || 'admin';
const KEYCLOAK_ADMIN_PASSWORD = process.env.KEYCLOAK_ADMIN_PASSWORD || 'admin';

type KeycloakTokenResponse = { access_token: string };
type KeycloakUser = { id: string; email?: string };

async function getKeycloakAdminToken(): Promise<string> {
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
}

async function getKeycloakUserByEmail(
  token: string,
  email: string,
): Promise<KeycloakUser | null> {
  const response = await axios.get<KeycloakUser[]>(
    `${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/users?email=${email}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  return response.data[0] ?? null;
}

async function createKeycloakUser(
  token: string,
  email: string,
  password: string,
  firstName: string,
  lastName: string,
): Promise<string> {
  await axios.post(
    `${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/users`,
    {
      username: email,
      email,
      firstName,
      lastName,
      enabled: true,
      emailVerified: true,
      credentials: [{ type: 'password', value: password, temporary: false }],
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    },
  );

  const user = await getKeycloakUserByEmail(token, email);
  if (!user) throw new Error(`Failed to create Keycloak user for ${email}`);
  return user.id;
}

async function ensureKeycloakUser(
  token: string,
  email: string,
  password: string,
  firstName: string,
  lastName: string,
): Promise<string> {
  const existing = await getKeycloakUserByEmail(token, email);
  if (existing?.id) {
    return existing.id;
  }
  return createKeycloakUser(token, email, password, firstName, lastName);
}

async function resetKeycloakPassword(
  token: string,
  userId: string,
  password: string,
): Promise<void> {
  await axios.put(
    `${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/users/${userId}/reset-password`,
    {
      type: 'password',
      value: password,
      temporary: false,
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    },
  );
}

async function ensureRegion() {
  const existing = await prisma.region.findFirst({
    where: { name: 'Москва', country: 'Россия' },
  });
  if (existing) return existing;
  return prisma.region.create({
    data: { name: 'Москва', country: 'Россия' },
  });
}

async function ensureBrand() {
  const existing = await prisma.brand.findFirst({
    where: { name: 'Coffee House' },
  });
  if (existing) {
    return prisma.brand.update({
      where: { id: existing.id },
      data: { isVerified: true, status: 'ACTIVE' },
    });
  }

  return prisma.brand.create({
    data: {
      name: 'Coffee House',
      description: 'Seeded brand for multi-role account',
      status: 'ACTIVE',
      isVerified: true,
      verifiedAt: new Date(),
    },
  });
}

async function ensureCafe(brandId: string, regionId: string) {
  const existing = await prisma.cafe.findFirst({
    where: { name: 'Coffee House Арбат', brandId },
  });
  if (existing) return existing;
  return prisma.cafe.create({
    data: {
      name: 'Coffee House Арбат',
      description: 'Seeded cafe for multi-role account',
      address: 'ул. Арбат, 15',
      city: 'Москва',
      street: 'ул. Арбат',
      latitude: 55.751244,
      longitude: 37.618423,
      photos: [],
      brandId,
      regionId,
      cafeApiUrl: 'http://localhost:3001',
    },
  });
}

async function ensureWorkerRoleAccount(params: {
  keycloakId: string;
  email: string;
  role: WorkerRole;
  firstName: string;
  lastName: string;
  brandId?: string | null;
  cafeId?: string | null;
}) {
  const existing = await prisma.workerAccount.findFirst({
    where: { email: params.email, role: params.role },
    orderBy: { createdAt: 'asc' },
  });

  if (existing) {
    return prisma.workerAccount.update({
      where: { id: existing.id },
      data: {
        keycloakId: params.keycloakId,
        firstName: params.firstName,
        lastName: params.lastName,
        brandId: params.brandId ?? null,
        cafeId: params.cafeId ?? null,
        deletedAt: null,
      },
    });
  }

  return prisma.workerAccount.create({
    data: {
      keycloakId: params.keycloakId,
      email: params.email,
      firstName: params.firstName,
      lastName: params.lastName,
      role: params.role,
      brandId: params.brandId ?? null,
      cafeId: params.cafeId ?? null,
    },
  });
}

async function main() {
  console.log('Seeding multi-role account...');

  const token = await getKeycloakAdminToken();
  const keycloakId = await ensureKeycloakUser(
    token,
    EMAIL,
    PASSWORD,
    FIRST_NAME,
    LAST_NAME,
  );
  await resetKeycloakPassword(token, keycloakId, PASSWORD);

  const region = await ensureRegion();
  const brand = await ensureBrand();
  const cafe = await ensureCafe(brand.id, region.id);

  const accounts = await Promise.all([
    ensureWorkerRoleAccount({
      keycloakId,
      email: EMAIL,
      role: WorkerRole.SYSTEM_ADMIN,
      firstName: FIRST_NAME,
      lastName: `${LAST_NAME} (System Admin)`,
      brandId: null,
      cafeId: null,
    }),
    ensureWorkerRoleAccount({
      keycloakId,
      email: EMAIL,
      role: WorkerRole.BRAND_ADMIN,
      firstName: FIRST_NAME,
      lastName: `${LAST_NAME} (Brand Admin)`,
      brandId: brand.id,
      cafeId: null,
    }),
    ensureWorkerRoleAccount({
      keycloakId,
      email: EMAIL,
      role: WorkerRole.CAFE_ADMIN,
      firstName: FIRST_NAME,
      lastName: `${LAST_NAME} (Cafe Admin)`,
      brandId: brand.id,
      cafeId: cafe.id,
    }),
    ensureWorkerRoleAccount({
      keycloakId,
      email: EMAIL,
      role: WorkerRole.WORKER,
      firstName: FIRST_NAME,
      lastName: `${LAST_NAME} (Worker)`,
      brandId: brand.id,
      cafeId: cafe.id,
    }),
  ]);

  console.log('\nDone.');
  console.log(`Email: ${EMAIL}`);
  console.log(`Password: ${PASSWORD}`);
  console.log(`Brand: ${brand.name}`);
  console.log(`Cafe: ${cafe.name}`);
  console.log('\nRoles:');
  for (const account of accounts) {
    console.log(
      `- ${account.role}: brandId=${account.brandId ?? 'N/A'}, cafeId=${account.cafeId ?? 'N/A'}`,
    );
  }
}

main()
  .catch((error) => {
    console.error('Failed to seed multi-role account:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
