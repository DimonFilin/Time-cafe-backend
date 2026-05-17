export type RoomBillingMode = 'HOURLY' | 'MINUTE';

export type RoomBillingSettings = {
  hourlyEnabled: boolean;
  hourlyRateRub: number;
  minuteEnabled: boolean;
  minuteRateRub: number;
};

export const DEFAULT_ROOM_BILLING: RoomBillingSettings = {
  hourlyEnabled: true,
  hourlyRateRub: 250,
  minuteEnabled: true,
  minuteRateRub: 7,
};

export function parseRoomBilling(metadata: unknown): RoomBillingSettings {
  const root =
    metadata && typeof metadata === 'object' && metadata !== null
      ? (metadata as Record<string, unknown>)
      : null;
  const raw = root?.billing;
  const b =
    raw && typeof raw === 'object' && raw !== null
      ? (raw as Record<string, unknown>)
      : null;
  if (!b) return { ...DEFAULT_ROOM_BILLING };
  return {
    hourlyEnabled: b.hourlyEnabled !== false,
    hourlyRateRub: Math.max(
      0,
      Number(b.hourlyRateRub) || DEFAULT_ROOM_BILLING.hourlyRateRub,
    ),
    minuteEnabled: b.minuteEnabled !== false,
    minuteRateRub: Math.max(
      0,
      Number(b.minuteRateRub) || DEFAULT_ROOM_BILLING.minuteRateRub,
    ),
  };
}

export function billingModesAvailable(
  settings: RoomBillingSettings,
): RoomBillingMode[] {
  const modes: RoomBillingMode[] = [];
  if (settings.hourlyEnabled) modes.push('HOURLY');
  if (settings.minuteEnabled) modes.push('MINUTE');
  return modes;
}

/** Hourly: round up to full hours. Minute: per minute. */
export function calculateRoomBookingPrice(
  durationMinutes: number,
  mode: RoomBillingMode,
  settings: RoomBillingSettings,
): number {
  const duration = Math.max(15, Math.min(480, Math.round(durationMinutes)));
  if (mode === 'HOURLY') {
    const hours = Math.ceil(duration / 60);
    return Math.round(hours * settings.hourlyRateRub * 100) / 100;
  }
  return Math.round(duration * settings.minuteRateRub * 100) / 100;
}
