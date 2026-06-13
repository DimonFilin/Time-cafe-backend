import { collectRequiredFieldErrors } from './guest-import-required.lib';
import {
  canonicalImportPhoneDigits,
  validateImportPhone,
} from './guest-import-phone.lib';
import { validateImportScud } from './guest-import-scud.lib';
import {
  GuestImportBatchTracker,
  checkPhoneDuplicateInDb,
  checkScudDuplicateInDb,
} from './guest-import-duplicate.lib';
import {
  collectImportWarnings,
  parseImportBirthDate,
  parseImportGender,
} from './guest-import-warnings.lib';
import type {
  GuestImportDuplicateContext,
  GuestImportLogEntry,
  GuestImportNormalizedRow,
  GuestImportRowInput,
  GuestImportRowValidation,
} from './guest-import.types';

function hasValue(value: string | null | undefined): boolean {
  return value != null && String(value).trim() !== '';
}

export function validateGuestImportRow(
  row: GuestImportRowInput,
  options?: {
    duplicateContext?: GuestImportDuplicateContext;
    batchTracker?: GuestImportBatchTracker;
  },
): GuestImportRowValidation {
  const errors: GuestImportLogEntry[] = collectRequiredFieldErrors(row);

  let phoneDigits: string | undefined;
  if (hasValue(row.phone)) {
    const phoneResult = validateImportPhone(String(row.phone), row.rowNumber);
    if (!phoneResult.ok) {
      errors.push(phoneResult.error);
    } else {
      phoneDigits = canonicalImportPhoneDigits(phoneResult.digits);
    }
  }

  let scud: string | undefined;
  if (hasValue(row.scud)) {
    const scudResult = validateImportScud(String(row.scud), row.rowNumber);
    if (!scudResult.ok) {
      errors.push(scudResult.error);
    } else {
      scud = scudResult.scud;
    }
  }

  const ctx = options?.duplicateContext;
  const tracker = options?.batchTracker;

  if (phoneDigits && ctx) {
    const dbDup = checkPhoneDuplicateInDb(phoneDigits, row.rowNumber, ctx);
    if (dbDup) errors.push(dbDup);
  }
  if (scud && ctx) {
    const dbDup = checkScudDuplicateInDb(scud, row.rowNumber, ctx);
    if (dbDup) errors.push(dbDup);
  }

  if (phoneDigits && tracker) {
    const fileDup = tracker.checkPhone(phoneDigits, row.rowNumber);
    if (fileDup) errors.push(fileDup);
  }
  if (scud && tracker) {
    const fileDup = tracker.checkScud(scud, row.rowNumber);
    if (fileDup) errors.push(fileDup);
  }

  const warnings = errors.length === 0 ? collectImportWarnings(row) : [];

  let normalized: GuestImportNormalizedRow | undefined;
  if (errors.length === 0 && phoneDigits && scud) {
    const birth = parseImportBirthDate(row.birthDate, row.rowNumber);
    const gender = parseImportGender(row.gender, row.rowNumber);
    const email =
      row.email != null && String(row.email).trim() !== ''
        ? String(row.email).trim()
        : undefined;

    normalized = {
      cafeName: String(row.cafeName).trim(),
      firstName: String(row.firstName).trim(),
      phoneDigits,
      scud,
      email,
      birthDate: birth.date,
      gender: gender.gender,
    };

    tracker?.register(phoneDigits, scud, row.rowNumber);
  }

  return {
    accepted: errors.length === 0,
    errors,
    warnings,
    normalized,
  };
}

/** Validate many rows; maintains batch duplicate tracking across the file. */
export function validateGuestImportRows(
  rows: GuestImportRowInput[],
  duplicateContext?: GuestImportDuplicateContext,
): GuestImportRowValidation[] {
  const tracker = new GuestImportBatchTracker();
  return rows.map((row) =>
    validateGuestImportRow(row, { duplicateContext, batchTracker: tracker }),
  );
}
