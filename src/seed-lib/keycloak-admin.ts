import axios from 'axios';

export const KEYCLOAK_URL = process.env.KEYCLOAK_URL || 'http://localhost:8080';
export const KEYCLOAK_REALM = process.env.KEYCLOAK_REALM || 'time-cafe-shared';
const KEYCLOAK_ADMIN_USERNAME = process.env.KEYCLOAK_ADMIN_USERNAME || 'admin';
const KEYCLOAK_ADMIN_PASSWORD = process.env.KEYCLOAK_ADMIN_PASSWORD || 'admin';

export const DEMO_EMAIL_PREFIXES = [
  'user.acc',
  'multiacc.',
  'worker.',
  'admin.',
  'brand.',
  'cafe.',
  'guest.',
  '@timecafe.by',
  '@cafe.by',
  '@timecafe.demo',
  '@uyutny.demo',
  '@loft.demo',
  '@user.demo',
  '@internal.local',
  'demo.',
] as const;

export type KeycloakUserInput = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
};

type KeycloakTokenResponse = { access_token: string };
type KeycloakUser = { id: string; email?: string; username?: string };

export async function getKeycloakAdminToken(): Promise<string> {
  const response = await axios.post<KeycloakTokenResponse>(
    `${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token`,
    new URLSearchParams({
      grant_type: 'password',
      client_id: 'admin-cli',
      username: KEYCLOAK_ADMIN_USERNAME,
      password: KEYCLOAK_ADMIN_PASSWORD,
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
  );
  return response.data.access_token;
}

export async function getKeycloakUserByEmail(
  token: string,
  email: string,
): Promise<KeycloakUser | null> {
  const response = await axios.get<KeycloakUser[]>(
    `${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/users`,
    {
      params: { email, exact: true },
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  return response.data[0] ?? null;
}

export async function createKeycloakUser(
  token: string,
  input: KeycloakUserInput,
): Promise<string> {
  try {
    await axios.post(
      `${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/users`,
      {
        username: input.email,
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        enabled: true,
        emailVerified: true,
        credentials: [
          { type: 'password', value: input.password, temporary: false },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      },
    );
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 409) {
      const existing = await getKeycloakUserByEmail(token, input.email);
      if (existing?.id) return existing.id;
    }
    throw error;
  }
  const user = await getKeycloakUserByEmail(token, input.email);
  if (!user?.id)
    throw new Error(`Failed to resolve Keycloak user ${input.email}`);
  return user.id;
}

export async function resetKeycloakPassword(
  token: string,
  userId: string,
  password: string,
): Promise<void> {
  await axios.put(
    `${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/users/${userId}/reset-password`,
    { type: 'password', value: password, temporary: false },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    },
  );
}

export async function ensureKeycloakUser(
  token: string,
  input: KeycloakUserInput,
): Promise<string> {
  const existing = await getKeycloakUserByEmail(token, input.email);
  if (existing?.id) {
    await resetKeycloakPassword(token, existing.id, input.password);
    return existing.id;
  }
  return createKeycloakUser(token, input);
}

export async function listRealmUsers(token: string): Promise<KeycloakUser[]> {
  const users: KeycloakUser[] = [];
  let first = 0;
  const max = 100;
  while (true) {
    const response = await axios.get<KeycloakUser[]>(
      `${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/users`,
      {
        params: { first, max },
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    users.push(...response.data);
    if (response.data.length < max) break;
    first += max;
  }
  return users;
}

export function isDemoEmail(email: string): boolean {
  const lower = email.toLowerCase();
  return DEMO_EMAIL_PREFIXES.some((p) => lower.includes(p.toLowerCase()));
}

export async function deleteKeycloakUser(
  token: string,
  userId: string,
): Promise<void> {
  await axios.delete(
    `${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/users/${userId}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
}

export async function clearKeycloakDemoUsers(options?: {
  deleteAll?: boolean;
}): Promise<{ deleted: string[]; skipped: number }> {
  const token = await getKeycloakAdminToken();
  const users = await listRealmUsers(token);
  const deleted: string[] = [];
  let skipped = 0;

  for (const user of users) {
    const email = user.email ?? user.username ?? '';
    if (!email) {
      skipped += 1;
      continue;
    }
    if (options?.deleteAll || isDemoEmail(email)) {
      await deleteKeycloakUser(token, user.id);
      deleted.push(email);
    } else {
      skipped += 1;
    }
  }

  return { deleted, skipped };
}

export async function upsertKeycloakUsers(
  inputs: KeycloakUserInput[],
): Promise<Record<string, string>> {
  const token = await getKeycloakAdminToken();
  const map: Record<string, string> = {};
  for (const input of inputs) {
    map[input.email] = await ensureKeycloakUser(token, input);
  }
  return map;
}
