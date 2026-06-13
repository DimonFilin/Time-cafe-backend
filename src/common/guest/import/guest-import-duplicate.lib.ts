import { IMPORT_ERROR } from './guest-import-messages';
import type {
  GuestImportDuplicateContext,
  GuestImportLogEntry,
} from './guest-import.types';

export class GuestImportBatchTracker {
  private readonly phones = new Map<string, number>();
  private readonly scuds = new Map<string, number>();

  checkPhone(digits: string, rowNumber: number): GuestImportLogEntry | null {
    const firstRow = this.phones.get(digits);
    if (firstRow !== undefined && firstRow !== rowNumber) {
      return {
        rowNumber,
        kind: 'error',
        description: IMPORT_ERROR.duplicatePhoneInFile,
      };
    }
    return null;
  }

  checkScud(scud: string, rowNumber: number): GuestImportLogEntry | null {
    const firstRow = this.scuds.get(scud);
    if (firstRow !== undefined && firstRow !== rowNumber) {
      return {
        rowNumber,
        kind: 'error',
        description: IMPORT_ERROR.duplicateScudInFile,
      };
    }
    return null;
  }

  register(phoneDigits: string, scud: string, rowNumber: number): void {
    if (!this.phones.has(phoneDigits)) {
      this.phones.set(phoneDigits, rowNumber);
    }
    if (!this.scuds.has(scud)) {
      this.scuds.set(scud, rowNumber);
    }
  }
}

export function checkPhoneDuplicateInDb(
  phoneDigits: string,
  rowNumber: number,
  ctx: GuestImportDuplicateContext,
): GuestImportLogEntry | null {
  if (!ctx.phonesInDb?.has(phoneDigits)) return null;
  return {
    rowNumber,
    kind: 'error',
    description: IMPORT_ERROR.duplicatePhoneInDb,
  };
}

export function checkScudDuplicateInDb(
  scud: string,
  rowNumber: number,
  ctx: GuestImportDuplicateContext,
): GuestImportLogEntry | null {
  if (!ctx.scudsInDb?.has(scud)) return null;
  return {
    rowNumber,
    kind: 'error',
    description: IMPORT_ERROR.duplicateScudInDb,
  };
}
