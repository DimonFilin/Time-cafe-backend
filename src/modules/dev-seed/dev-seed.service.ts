import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { clearDatabaseFull } from '../../seed-lib/clear-database-full';
import {
  clearKeycloakDemoUsers,
  upsertKeycloakUsers,
  type KeycloakUserInput,
} from '../../seed-lib/keycloak-admin';

@Injectable()
export class DevSeedService {
  constructor(private readonly prisma: PrismaService) {}

  async clearDatabase(): Promise<{ ok: true }> {
    await clearDatabaseFull(this.prisma);
    return { ok: true };
  }

  async clearKeycloak(deleteAll = false): Promise<{
    deleted: string[];
    skipped: number;
  }> {
    return clearKeycloakDemoUsers({ deleteAll });
  }

  async createKeycloakUsers(
    users: KeycloakUserInput[],
  ): Promise<Record<string, string>> {
    return upsertKeycloakUsers(users);
  }
}
