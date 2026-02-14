import axios from 'axios';

interface KeycloakTokenResponse {
  access_token: string;
}

interface KeycloakUser {
  id: string;
  email?: string;
}

// Keycloak configuration
const KEYCLOAK_URL = process.env.KEYCLOAK_URL || 'http://localhost:8080';
const KEYCLOAK_REALM = process.env.KEYCLOAK_REALM || 'time-cafe-shared';
const KEYCLOAK_ADMIN_USERNAME = process.env.KEYCLOAK_ADMIN_USERNAME || 'admin';
const KEYCLOAK_ADMIN_PASSWORD = process.env.KEYCLOAK_ADMIN_PASSWORD || 'admin';

// User to reset
const USER_EMAIL = 'multiacc.email@gmail.com';
const NEW_PASSWORD = 'MultiAccount2026!';

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

async function resetUserPassword(
  token: string,
  email: string,
  password: string,
) {
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

    console.log(`✓ Password reset successfully for: ${email}`);
    console.log(`   New password: ${password}`);
  } catch (error) {
    console.error(`❌ Failed to reset password for ${email}`);
    if (axios.isAxiosError(error) && error.response) {
      console.error('   Error:', error.response.data);
    }
    throw error;
  }
}

async function main() {
  console.log('🔑 Resetting user password in Keycloak...\n');

  try {
    // Get admin token
    console.log('🔑 Getting Keycloak admin token...');
    const adminToken = await getKeycloakAdminToken();
    console.log('✓ Got admin token\n');

    // Reset password for multi-account user
    await resetUserPassword(adminToken, USER_EMAIL, NEW_PASSWORD);

    console.log('\n✅ Password reset completed successfully!');
    console.log('\n📋 You can now login with:');
    console.log(`   Email: ${USER_EMAIL}`);
    console.log(`   Password: ${NEW_PASSWORD}`);
  } catch (error) {
    console.error('\n❌ Error during password reset:', error);
    process.exit(1);
  }
}

void main();
