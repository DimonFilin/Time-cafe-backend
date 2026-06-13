import { IMPORT_ERROR } from './guest-import-messages';
import type { GuestImportLogEntry } from './guest-import.types';

export function normalizeImportScud(raw: string): string {
  return raw.trim();
}

export function isValidImportScud(raw: string): boolean {
  const trimmed = normalizeImportScud(raw);
  return trimmed.length > 0 && trimmed.length <= 20;
}

export function validateImportScud(
  raw: string,
  rowNumber: number,
): { ok: true; scud: string } | { ok: false; error: GuestImportLogEntry } {
  const scud = normalizeImportScud(raw);
  if (!isValidImportScud(raw)) {
    return {
      ok: false,
      error: {
        rowNumber,
        kind: 'error',
        description: IMPORT_ERROR.invalidScud,
      },
    };
  }
  return { ok: true, scud };
}
