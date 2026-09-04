export const REST_PRESETS = [45, 120, 180] as const;

export const REST_STORAGE_ENDS_AT = "gymlog:restEndsAt";
export const REST_STORAGE_TOTAL = "gymlog:restTotal";

export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

export function remainingSeconds(endsAt: number, now: number): number {
  return Math.max(0, Math.ceil((endsAt - now) / 1000));
}
