import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import {
  DEMO_PASS,
  EXTRA_WORKERS,
  MOBILE_USERS,
  TIMECAFE_CORE_WORKERS,
} from './seed-data/demo-showcase/fixtures';
import {
  ensureKeycloakUser,
  getKeycloakAdminToken,
  type KeycloakUserInput,
} from './lib/keycloak-admin';

const KEYCLOAK_URL = process.env.KEYCLOAK_URL || 'http://localhost:8080';
const KEYCLOAK_REALM = process.env.KEYCLOAK_REALM || 'time-cafe-shared';
const CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID || 'backend-shared-api';
const CLIENT_SECRET = process.env.KEYCLOAK_CLIENT_SECRET || '';

function workerPassword(role: string): string {
  return role === 'WORKER' ? DEMO_PASS.worker : DEMO_PASS.admin;
}

function demoInputs(): KeycloakUserInput[] {
  return [
    ...MOBILE_USERS.map((u) => ({
      email: u.email,
      password: DEMO_PASS.user,
      firstName: u.firstName,
      lastName: u.lastName,
    })),
    ...TIMECAFE_CORE_WORKERS.map((w) => ({
      email: w.email,
      password: w.password,
      firstName: w.firstName,
      lastName: w.lastName,
    })),
    ...EXTRA_WORKERS.map((w) => ({
      email: w.email,
      password: workerPassword(w.role),
      firstName: w.firstName,
      lastName: w.lastName,
    })),
  ];
}

async function realmExists(token: string): Promise<boolean> {
  try {
    await axios.get(`${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return true;
  } catch {
    return false;
  }
}

async function ensureRealm(token: string): Promise<void> {
  if (await realmExists(token)) {
    console.log(`[realm] ${KEYCLOAK_REALM} already exists`);
    return;
  }
  console.log(`[realm] creating ${KEYCLOAK_REALM}...`);
  await axios.post(
    `${KEYCLOAK_URL}/admin/realms`,
    {
      realm: KEYCLOAK_REALM,
      enabled: true,
      accessTokenLifespan: 3600,
      ssoSessionIdleTimeout: 60 * 60 * 24 * 30,
      ssoSessionMaxLifespan: 60 * 60 * 24 * 30,
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    },
  );
  console.log('[realm] created');
}

async function ensureClient(token: string): Promise<void> {
  const list = await axios.get<{ clientId: string; id: string }[]>(
    `${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/clients`,
    {
      params: { clientId: CLIENT_ID },
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  if (list.data.length > 0) {
    console.log(`[client] ${CLIENT_ID} already exists`);
    return;
  }
  if (!CLIENT_SECRET) {
    throw new Error('KEYCLOAK_CLIENT_SECRET is required');
  }
  console.log(`[client] creating ${CLIENT_ID}...`);
  await axios.post(
    `${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/clients`,
    {
      clientId: CLIENT_ID,
      enabled: true,
      publicClient: false,
      clientAuthenticatorType: 'client-secret',
      secret: CLIENT_SECRET,
      directAccessGrantsEnabled: true,
      standardFlowEnabled: true,
      redirectUris: ['http://localhost:3000/*', 'http://68.183.212.112:3000/*'],
      webOrigins: ['+'],
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    },
  );
  console.log('[client] created');
}

async function syncDbKeycloakIds(
  prisma: PrismaClient,
  ids: Record<string, string>,
): Promise<void> {
  let workers = 0;
  let users = 0;
  for (const [email, keycloakId] of Object.entries(ids)) {
    const w = await prisma.workerAccount.updateMany({
      where: { email },
      data: { keycloakId },
    });
    workers += w.count;
    const u = await prisma.user.updateMany({
      where: { email },
      data: { keycloakId },
    });
    users += u.count;
  }
  console.log(`[db] updated worker_accounts: ${workers}, users: ${users}`);
}

async function main() {
  const prisma = new PrismaClient();
  const inputs = demoInputs();
  console.log(
    `[start] rebuild Keycloak demo users (${inputs.length} accounts)\n`,
  );

  console.log('[step 1/4] admin token...');
  const token = await getKeycloakAdminToken();
  console.log('[step 1/4] ok\n');

  console.log('[step 2/4] realm + client...');
  await ensureRealm(token);
  await ensureClient(token);
  console.log('[step 2/4] ok\n');

  console.log('[step 3/4] upsert demo users...');
  const ids: Record<string, string> = {};
  for (let i = 0; i < inputs.length; i += 1) {
    const input = inputs[i];
    ids[input.email] = await ensureKeycloakUser(token, input);
    console.log(`  [${i + 1}/${inputs.length}] ${input.email}`);
  }
  console.log('[step 3/4] ok\n');

  console.log('[step 4/4] sync Postgres keycloakId...');
  await syncDbKeycloakIds(prisma, ids);
  console.log('[step 4/4] ok\n');

  console.log('done');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
