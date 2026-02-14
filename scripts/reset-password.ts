import axios from 'axios';

interface KeycloakTokenResponse {
  access_token: string;
}

interface KeycloakUser {
  id: string;
  email?: string;
}

const KEYCLOAK_URL = process.env.KEYCLOAK_URL || 'http://localhost:8080';
const KEYCLOAK_REALM = process.env.KEYCLOAK_REALM || 'time-cafe-shared';
const KEYCLOAK_ADMIN_USERNAME = process.env.KEYCLOAK_ADMIN_USERNAME || 'admin';
const KEYCLOAK_ADMIN_PASSWORD = process.env.KEYCLOAK_ADMIN_PASSWORD || 'admin';

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
    if (axios.isAxiosError(error) && error.response) {
      console.error('   Error:', error.response.data);
    }
    throw error;
  }
}

// Reset password for user
async function resetPassword(
  token: string,
  email: string,
  newPassword: string,
): Promise<void> {
  try {
    // Get user by email
    const usersResponse = await axios.get<KeycloakUser[]>(
      `${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/users?email=${email}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (usersResponse.data.length === 0) {
      console.error(`❌ User not found: ${email}`);
      return;
    }

    const user = usersResponse.data[0];
    console.log(`✓ Found user: ${email} (ID: ${user.id})`);

    // Reset password
    await axios.put(
      `${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/users/${user.id}/reset-password`,
      {
        type: 'password',
        value: newPassword,
        temporary: false,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      },
    );

    console.log(`✓ Password reset successfully for ${email}`);
    console.log(`  New password: ${newPassword}`);
  } catch (error) {
    console.error(`❌ Failed to reset password for ${email}`);
    if (axios.isAxiosError(error) && error.response) {
      console.error('   Error:', error.response.data);
    }
    throw error;
  }
}

async function main() {
  console.log('🔑 Resetting passwords for test accounts...\n');

  try {
    // Get admin token
    console.log('Getting Keycloak admin token...');
    const adminToken = await getKeycloakAdminToken();
    console.log('✓ Got admin token\n');

    // Reset passwords for all test accounts
    const accounts = [
      { email: 'multiacc.email@gmail.com', password: 'MultiAccount2026!' },
      { email: 'admin@system.com', password: 'Admin2026!' },
      { email: 'brand.admin@coffeehouse.ru', password: 'Brand2026!' },
      { email: 'ivan.petrov@example.com', password: 'User2026!' },
      { email: 'maria.ivanova@example.com', password: 'User2026!' },
    ];

    for (const account of accounts) {
      await resetPassword(adminToken, account.email, account.password);
      console.log('');
    }

    console.log('✅ All passwords reset successfully!\n');
    console.log('📋 Test Accounts:');
    console.log('   multiacc.email@gmail.com     / MultiAccount2026!');
    console.log('   admin@system.com             / Admin2026!');
    console.log('   brand.admin@coffeehouse.ru   / Brand2026!');
    console.log('   ivan.petrov@example.com      / User2026!');
    console.log('   maria.ivanova@example.com    / User2026!');
    console.log('');
    console.log('🎉 You can now login with these credentials!');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

void main();
