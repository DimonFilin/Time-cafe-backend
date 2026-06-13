import { IMPORT_ERROR, IMPORT_WARNING } from './guest-import-messages';
import { extractImportPhoneDigits, isValidImportPhoneDigits } from './guest-import-phone.lib';
import {
  validateGuestImportRow,
  validateGuestImportRows,
} from './guest-import-validate.lib';

describe('guest-import-phone', () => {
  it('accepts TZ examples', () => {
    expect(isValidImportPhoneDigits(extractImportPhoneDigits('+7-917-1234567'))).toBe(true);
    expect(isValidImportPhoneDigits(extractImportPhoneDigits('8917-123-45-69'))).toBe(true);
  });

  it('rejects 10 digits without leading 7/8', () => {
    expect(isValidImportPhoneDigits(extractImportPhoneDigits('9171234567'))).toBe(false);
  });
});

describe('validateGuestImportRow', () => {
  const base = {
    rowNumber: 5,
    cafeName: 'Time Minsk',
    firstName: 'Иван',
    phone: '+7(917)1234567',
    scud: 'CARD-001',
  };

  it('reports each missing required field', () => {
    const r = validateGuestImportRow({
      rowNumber: 2,
      cafeName: '',
      firstName: '  ',
      phone: null,
      scud: '',
    });
    expect(r.accepted).toBe(false);
    expect(r.errors).toHaveLength(4);
    expect(r.warnings).toHaveLength(0);
  });

  it('rejects invalid phone and scud', () => {
    const r = validateGuestImportRow({
      ...base,
      phone: '9171234567',
      scud: 'x'.repeat(21),
    });
    expect(r.errors.map((e) => e.description)).toEqual([
      IMPORT_ERROR.invalidPhone,
      IMPORT_ERROR.invalidScud,
    ]);
  });

  it('collects warnings only when no errors', () => {
    const r = validateGuestImportRow({
      ...base,
      email: 'bad@@mail',
      birthDate: '19/05/1990',
      gender: 'unknown',
    });
    expect(r.accepted).toBe(true);
    expect(r.warnings.map((w) => w.description)).toEqual([
      IMPORT_WARNING.invalidEmail,
      IMPORT_WARNING.invalidBirthDate,
      IMPORT_WARNING.invalidGender,
    ]);
    expect(r.normalized?.gender).toBeNull();
  });

  it('parses valid optional fields', () => {
    const r = validateGuestImportRow({
      ...base,
      email: 'a@b.c',
      birthDate: '1990/05/19',
      gender: 'муж',
    });
    expect(r.accepted).toBe(true);
    expect(r.warnings).toHaveLength(0);
    expect(r.normalized?.gender).toBe('MALE');
    expect(r.normalized?.birthDate).toEqual(new Date(1990, 4, 19));
  });

  it('detects duplicate phone in file (8… and +7… are the same)', () => {
    const rows = validateGuestImportRows([
      { ...base, rowNumber: 10, phone: '89032902283', scud: 'A1' },
      { ...base, rowNumber: 11, phone: '+7-903-290-22-83', scud: 'A2' },
    ]);
    expect(rows[0].accepted).toBe(true);
    expect(rows[0].normalized?.phoneDigits).toBe('79032902283');
    expect(rows[1].errors[0]?.description).toBe(IMPORT_ERROR.duplicatePhoneInFile);
  });

  it('detects phone already in db', () => {
    const r = validateGuestImportRow(base, {
      duplicateContext: { phonesInDb: new Set(['79171234567']) },
    });
    expect(r.errors[0]?.description).toBe(IMPORT_ERROR.duplicatePhoneInDb);
  });

  it('detects scud already in db', () => {
    const r = validateGuestImportRow(base, {
      duplicateContext: { scudsInDb: new Set(['CARD-001']) },
    });
    expect(r.errors[0]?.description).toBe(IMPORT_ERROR.duplicateScudInDb);
  });
});
