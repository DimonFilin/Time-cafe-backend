import {
  IMPORT_ERROR,
  IMPORT_FIELD_CAFE,
  IMPORT_FIELD_NAME,
  IMPORT_FIELD_PHONE,
  IMPORT_FIELD_SCUD,
} from './guest-import-messages';
import type {
  GuestImportLogEntry,
  GuestImportRowInput,
} from './guest-import.types';

function isBlank(value: string | null | undefined): boolean {
  return value == null || String(value).trim() === '';
}

export function collectRequiredFieldErrors(
  row: GuestImportRowInput,
): GuestImportLogEntry[] {
  const errors: GuestImportLogEntry[] = [];
  const push = (fieldName: string) => {
    errors.push({
      rowNumber: row.rowNumber,
      kind: 'error',
      description: IMPORT_ERROR.missingField(fieldName),
    });
  };

  if (isBlank(row.cafeName)) push(IMPORT_FIELD_CAFE);
  if (isBlank(row.firstName)) push(IMPORT_FIELD_NAME);
  if (isBlank(row.phone)) push(IMPORT_FIELD_PHONE);
  if (isBlank(row.scud)) push(IMPORT_FIELD_SCUD);

  return errors;
}
