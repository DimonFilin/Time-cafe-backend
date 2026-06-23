export function formatGuestDisplayName(guest: {
  lastName?: string | null;
  firstName: string;
  patronymic?: string | null;
}): string {
  const last = (guest.lastName ?? '').trim();
  const first = (guest.firstName ?? '').trim();
  const pat = (guest.patronymic ?? '').trim();

  const firstInitial = first ? `${first.charAt(0)}.` : '';
  const patInitial = pat ? `${pat.charAt(0)}.` : '';

  if (last) {
    const initials = [firstInitial, patInitial].filter(Boolean).join(' ');
    return initials ? `${last} ${initials}` : last;
  }

  return [first, pat].filter(Boolean).join(' ') || '—';
}

/** Full name for SCUD card on mobile (not initials). */
export function formatGuestCardName(guest: {
  lastName?: string | null;
  firstName: string;
  patronymic?: string | null;
}): string {
  const last = (guest.lastName ?? '').trim();
  const first = (guest.firstName ?? '').trim();
  const pat = (guest.patronymic ?? '').trim();
  return [last, first, pat].filter(Boolean).join(' ') || '—';
}
