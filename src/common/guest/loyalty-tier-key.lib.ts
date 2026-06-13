export type LoyaltyTierKey = 'bronze' | 'silver' | 'gold';

export function resolveLoyaltyTierKey(
  tierName?: string | null,
): LoyaltyTierKey {
  const n = (tierName ?? '').toLowerCase();
  if (n.includes('золот') || n.includes('gold')) return 'gold';
  if (n.includes('серебр') || n.includes('silver')) return 'silver';
  return 'bronze';
}
