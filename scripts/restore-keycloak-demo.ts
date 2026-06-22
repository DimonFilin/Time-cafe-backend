import {
  DEMO_PASS,
  EXTRA_WORKERS,
  MOBILE_USERS,
  TIMECAFE_CORE_WORKERS,
} from './seed-data/demo-showcase/fixtures';
import {
  deleteKeycloakUser,
  getKeycloakAdminToken,
  listRealmUsers,
  upsertKeycloakUsers,
  type KeycloakUserInput,
} from './lib/keycloak-admin';

function workerPassword(role: string): string {
  return role === 'WORKER' ? DEMO_PASS.worker : DEMO_PASS.admin;
}

async function main() {
  const token = await getKeycloakAdminToken();
  const users = await listRealmUsers(token);
  let deleted = 0;

  for (const user of users) {
    const email = (user.email ?? user.username ?? '').toLowerCase();
    if (email.includes('@test.com')) {
      await deleteKeycloakUser(token, user.id);
      deleted += 1;
    }
  }
  console.log(`Removed attacker accounts: ${deleted}`);

  const inputs: KeycloakUserInput[] = [
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

  const ids = await upsertKeycloakUsers(inputs);
  console.log(`Demo passwords reset: ${Object.keys(ids).length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
