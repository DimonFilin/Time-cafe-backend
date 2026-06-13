import type { Gender } from '@prisma/client';

import { IMPORT_WARNING } from './guest-import-messages';
import type { GuestImportLogEntry } from './guest-import.types';

const BIRTH_DATE_RE = /^(\d{4})\/(\d{2})\/(\d{2})$/;
const MALE_TOKENS = new Set(['м', 'муж']);
const FEMALE_TOKENS = new Set(['ж', 'жен']);

export function validateImportEmail(
  raw: string | null | undefined,
  rowNumber: number,
): GuestImportLogEntry | null {
  if (raw == null || String(raw).trim() === '') return null;
  const atCount = (String(raw).match(/@/g) ?? []).length;
  if (atCount === 1) return null;
  return {
    rowNumber,
    kind: 'warning',
    description: IMPORT_WARNING.invalidEmail,
  };
}

export function parseImportBirthDate(
  raw: string | null | undefined,
  rowNumber: number,
): { warning: GuestImportLogEntry | null; date?: Date } {
  if (raw == null || String(raw).trim() === '') {
    return { warning: null };
  }
  const text = String(raw).trim();
  const match = text.match(BIRTH_DATE_RE);
  if (!match) {
    return {
      warning: {
        rowNumber,
        kind: 'warning',
        description: IMPORT_WARNING.invalidBirthDate,
      },
    };
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  const valid =
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day;
  if (!valid) {
    return {
      warning: {
        rowNumber,
        kind: 'warning',
        description: IMPORT_WARNING.invalidBirthDate,
      },
    };
  }
  return { warning: null, date };
}

export function parseImportGender(
  raw: string | null | undefined,
  rowNumber: number,
): { gender: Gender | null; warning: GuestImportLogEntry | null } {
  if (raw == null || String(raw).trim() === '') {
    return { gender: null, warning: null };
  }
  const token = String(raw).trim().toLowerCase();
  if (MALE_TOKENS.has(token)) return { gender: 'MALE', warning: null };
  if (FEMALE_TOKENS.has(token)) return { gender: 'FEMALE', warning: null };
  return {
    gender: null,
    warning: {
      rowNumber,
      kind: 'warning',
      description: IMPORT_WARNING.invalidGender,
    },
  };
}

export function collectImportWarnings(row: {
  rowNumber: number;
  email?: string | null;
  birthDate?: string | null;
  gender?: string | null;
}): GuestImportLogEntry[] {
  const warnings: GuestImportLogEntry[] = [];
  const emailW = validateImportEmail(row.email, row.rowNumber);
  if (emailW) warnings.push(emailW);
  const birth = parseImportBirthDate(row.birthDate, row.rowNumber);
  if (birth.warning) warnings.push(birth.warning);
  const gender = parseImportGender(row.gender, row.rowNumber);
  if (gender.warning) warnings.push(gender.warning);
  return warnings;
}
