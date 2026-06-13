import { IMPORT_ERROR } from './guest-import-messages';
import type { GuestImportLogEntry } from './guest-import.types';

export function extractImportPhoneDigits(raw: string): string {
  return raw.replace(/\D/g, '');
}

export function isValidImportPhoneDigits(digits: string): boolean {
  return digits.length === 11 && (digits[0] === '7' || digits[0] === '8');
}

/** Same RU number may be written as 8… or 7… — one key for duplicates. */
export function canonicalImportPhoneDigits(digits: string): string {
  if (digits.length === 11 && digits[0] === '8') {
    return `7${digits.slice(1)}`;
  }
  return digits;
}

export function validateImportPhone(
  raw: string,
  rowNumber: number,
): { ok: true; digits: string } | { ok: false; error: GuestImportLogEntry } {
  const digits = extractImportPhoneDigits(raw);
  if (!isValidImportPhoneDigits(digits)) {
    return {
      ok: false,
      error: {
        rowNumber,
        kind: 'error',
        description: IMPORT_ERROR.invalidPhone,
      },
    };
  }
  return { ok: true, digits };
}
