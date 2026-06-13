import type { Gender } from '@prisma/client';

export type GuestImportLogKind = 'error' | 'warning';

export type GuestImportLogEntry = {
  rowNumber: number;
  kind: GuestImportLogKind;
  description: string;
};

/** Raw row before DB mapping (from xlsx row or manual test). */
export type GuestImportRowInput = {
  rowNumber: number;
  cafeName?: string | null;
  firstName?: string | null;
  phone?: string | null;
  scud?: string | null;
  email?: string | null;
  birthDate?: string | null;
  gender?: string | null;
};

export type GuestImportNormalizedRow = {
  cafeName: string;
  firstName: string;
  phoneDigits: string;
  scud: string;
  email?: string;
  birthDate?: Date;
  gender?: Gender | null;
};

export type GuestImportRowValidation = {
  accepted: boolean;
  errors: GuestImportLogEntry[];
  warnings: GuestImportLogEntry[];
  normalized?: GuestImportNormalizedRow;
};

export type GuestImportDuplicateContext = {
  phonesInDb?: ReadonlySet<string>;
  scudsInDb?: ReadonlySet<string>;
};
