export type LoyaltyDisplayMode = 'NONE' | 'BRIEF' | 'FULL';

export type BrandLoyaltySettings = {
  bonusesEnabled: boolean;
  displayMode: LoyaltyDisplayMode;
};

const DEFAULT: BrandLoyaltySettings = {
  bonusesEnabled: true,
  displayMode: 'BRIEF',
};

export function parseBrandLoyaltySettings(
  settings: unknown,
): BrandLoyaltySettings {
  if (!settings || typeof settings !== 'object') {
    return DEFAULT;
  }
  const root = settings as Record<string, unknown>;
  const loyalty =
    root.loyalty && typeof root.loyalty === 'object'
      ? (root.loyalty as Record<string, unknown>)
      : {};
  const features =
    root.features && typeof root.features === 'object'
      ? (root.features as Record<string, unknown>)
      : {};

  const bonusesEnabled =
    typeof loyalty.bonusesEnabled === 'boolean'
      ? loyalty.bonusesEnabled
      : typeof features.loyaltyProgram === 'boolean'
        ? features.loyaltyProgram
        : DEFAULT.bonusesEnabled;

  const displayModeRaw = loyalty.displayMode;
  const displayMode: LoyaltyDisplayMode =
    displayModeRaw === 'NONE' ||
    displayModeRaw === 'BRIEF' ||
    displayModeRaw === 'FULL'
      ? displayModeRaw
      : DEFAULT.displayMode;

  return { bonusesEnabled, displayMode };
}

export function mergeBrandLoyaltyIntoSettings(
  settings: Record<string, unknown>,
  patch: Partial<BrandLoyaltySettings>,
): Record<string, unknown> {
  const current = parseBrandLoyaltySettings(settings);
  const next: BrandLoyaltySettings = { ...current, ...patch };
  const features =
    settings.features && typeof settings.features === 'object'
      ? { ...(settings.features as Record<string, unknown>) }
      : {};
  features.loyaltyProgram = next.bonusesEnabled;
  return {
    ...settings,
    features,
    loyalty: {
      bonusesEnabled: next.bonusesEnabled,
      displayMode: next.displayMode,
    },
  };
}
