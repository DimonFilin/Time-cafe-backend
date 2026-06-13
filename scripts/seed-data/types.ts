import type {
  Brand,
  Cafe,
  LoyaltyTier,
  Region,
  User,
  WorkerAccount,
} from '@prisma/client';

export type SeedContext = {
  keycloakIds: Record<string, string>;
  regions: { by: Region; minsk: Region; brest: Region };
  brands: { timeCafeBy: Brand; uyutnyChas: Brand };
  cafes: {
    minskNezavisimosti: Cafe;
    minskOktyabrskaya: Cafe;
    brestCenter: Cafe;
  };
  tiers: Record<'bronze' | 'silver' | 'gold', LoyaltyTier>;
  workers: {
    multiacc: WorkerAccount[];
    systemAdmin?: WorkerAccount;
    minsk2Admin: WorkerAccount;
    minsk2Worker: WorkerAccount;
    brestAdmin: WorkerAccount;
    brestWorker: WorkerAccount;
  };
  users: {
    acc1: User;
    acc2: User;
    acc3: User;
  };
};
