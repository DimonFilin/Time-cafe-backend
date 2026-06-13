import { Decimal } from '@prisma/client/runtime/library';

export type TopUpSource = 'CAFE' | 'MOBILE';

export type BonusSkipReason =
  | 'PLATFORM_DISABLED'
  | 'BRAND_DISABLED'
  | 'BELOW_MINIMUM'
  | null;

export function floorBonus(amount: number, percent: number): number {
  return Math.floor((amount * percent) / 100);
}

export function toNumber(value: Decimal | number | string): number {
  return typeof value === 'number' ? value : Number(value);
}

export function computeBonusPreview(params: {
  topUpAmount: number;
  bonusPercent: number;
}): { bonusAmount: number } {
  return {
    bonusAmount: floorBonus(params.topUpAmount, params.bonusPercent),
  };
}

export function resolveWillAccrue(params: {
  platformEnabled: boolean;
  minTopUpForBonus: number;
  topUpAmount: number;
  source: TopUpSource;
  brandBonusesEnabled: boolean;
}): { willAccrue: boolean; reasonIfNot: BonusSkipReason } {
  if (!params.platformEnabled) {
    return { willAccrue: false, reasonIfNot: 'PLATFORM_DISABLED' };
  }
  if (params.topUpAmount < params.minTopUpForBonus) {
    return { willAccrue: false, reasonIfNot: 'BELOW_MINIMUM' };
  }
  if (params.source === 'CAFE' && !params.brandBonusesEnabled) {
    return { willAccrue: false, reasonIfNot: 'BRAND_DISABLED' };
  }
  return { willAccrue: true, reasonIfNot: null };
}

export function scheduledAccrualAt(from: Date, delayHours: number): Date {
  return new Date(from.getTime() + delayHours * 60 * 60 * 1000);
}
