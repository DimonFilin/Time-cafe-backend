import { floorBonus } from './loyalty-calculations';
import { resolveWillAccrue } from './loyalty-calculations';

describe('loyalty-calculations', () => {
  it('floors bonus 1111 * 13% to 144', () => {
    expect(floorBonus(1111, 13)).toBe(144);
  });

  it('floors bonus 1000 * 5% to 50', () => {
    expect(floorBonus(1000, 5)).toBe(50);
  });

  it('mobile accrues when platform enabled', () => {
    const r = resolveWillAccrue({
      platformEnabled: true,
      minTopUpForBonus: 20,
      topUpAmount: 100,
      source: 'MOBILE',
      brandBonusesEnabled: false,
    });
    expect(r.willAccrue).toBe(true);
  });

  it('cafe skips when brand disabled', () => {
    const r = resolveWillAccrue({
      platformEnabled: true,
      minTopUpForBonus: 20,
      topUpAmount: 100,
      source: 'CAFE',
      brandBonusesEnabled: false,
    });
    expect(r.willAccrue).toBe(false);
    expect(r.reasonIfNot).toBe('BRAND_DISABLED');
  });
});
