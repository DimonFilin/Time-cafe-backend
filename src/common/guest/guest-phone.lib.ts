const GUEST_PHONE_MESSAGE =
  'Телефон: 12 цифр для Беларуси (+375…) или 11 цифр для России (+7…)';

export function normalizeGuestPhone(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/\D/g, '');
  if (digits.startsWith('375') && digits.length === 12) {
    return `+${digits}`;
  }
  if (digits.startsWith('7') && digits.length === 11) {
    return `+${digits}`;
  }
  if (digits.startsWith('80') && digits.length === 11) {
    const local = digits.slice(2);
    if (local.length === 9 && /^[29]/.test(local)) {
      return `+375${local}`;
    }
  }
  if (digits.length === 10 && digits.startsWith('0')) {
    const local = digits.slice(1);
    if (local.length === 9 && /^[29]/.test(local)) {
      return `+375${local}`;
    }
  }
  if (digits.length === 9 && /^[29]/.test(digits)) {
    return `+375${digits}`;
  }
  return null;
}

export function phoneDigitsOnly(raw: string): string {
  const normalized = normalizeGuestPhone(raw);
  return (normalized ?? raw).replace(/\D/g, '');
}

export function isValidGuestPhone(raw: string): boolean {
  return normalizeGuestPhone(raw) !== null;
}

export function guestPhoneValidationMessage(): string {
  return GUEST_PHONE_MESSAGE;
}
