const SCUD_CARD_MAX_LEN = 20;
const SCUD_CARD_RE = /^[A-Za-z0-9\-_.]{1,20}$/;

export function buildScudQrPayload(accessCardNumber: string): string {
  return JSON.stringify({ v: 1, t: 's', c: accessCardNumber.trim() });
}

export function parseScudQrPayload(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as {
        v?: number;
        t?: string;
        c?: string;
      };
      if (
        parsed?.t === 's' &&
        typeof parsed.c === 'string' &&
        SCUD_CARD_RE.test(parsed.c)
      ) {
        return parsed.c.trim();
      }
    } catch {
      return null;
    }
    return null;
  }

  if (SCUD_CARD_RE.test(trimmed) && trimmed.length <= SCUD_CARD_MAX_LEN) {
    return trimmed;
  }

  return null;
}
