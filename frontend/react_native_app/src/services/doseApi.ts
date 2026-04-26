import { apiRequest } from './apiClient';
import { DEFAULT_TZ } from '@/config/env';
import type { CalendarDay, DoseLogItem, DoseStatus } from '@/types/medicine';

interface DayResponse {
  success: boolean;
  date: string;
  tz: string;
  items: DoseLogItem[];
}

interface CalendarResponse {
  success: boolean;
  month: string;
  tz: string;
  days: CalendarDay[];
}

interface LogResponse {
  success: boolean;
  message: string;
}

/**
 * Always returns the configured product timezone (`Asia/Kolkata`).
 *
 * Why we don't probe the device:
 *   React Native's Hermes engine ships a stripped-down `Intl` polyfill.
 *   `Intl.DateTimeFormat().resolvedOptions().timeZone` can return non-IANA
 *   strings like `"GMT+05:30"`, `undefined`, or even legacy aliases that
 *   the backend's tzdata rejects with HTTP 422 "Invalid timezone".
 *   Since this is an India-first product, we hard-pin to DEFAULT_TZ from
 *   env (set to `Asia/Kolkata`) — the backend always accepts this name
 *   and there's nothing to probe.
 */
export function deviceTimezone(): string {
  return DEFAULT_TZ;
}

/**
 * Today's date as YYYY-MM-DD in `Asia/Kolkata` (UTC+05:30).
 *
 * We don't use `Intl.DateTimeFormat({ timeZone })` here because Hermes
 * can throw on it. Instead we add the IST offset (5h30m) to the UTC
 * timestamp, then read the UTC components — that gives us the correct
 * local IST date without touching the Intl polyfill.
 */
export function todayInTz(_tz: string = deviceTimezone()): string {
  const now = new Date();
  const istMs = now.getTime() + 5.5 * 60 * 60 * 1000;
  const ist = new Date(istMs);
  const y = ist.getUTCFullYear();
  const m = String(ist.getUTCMonth() + 1).padStart(2, '0');
  const d = String(ist.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Current month as YYYY-MM in `Asia/Kolkata`. */
export function monthInTz(tz: string = deviceTimezone()): string {
  return todayInTz(tz).slice(0, 7);
}

export async function getDayDoses(
  date: string = todayInTz(),
  tz: string = deviceTimezone(),
): Promise<DoseLogItem[]> {
  const res = await apiRequest<DayResponse>({
    path: '/doses/day',
    query: { date, tz },
    auth: true,
  });
  return res.items ?? [];
}

export async function getCalendar(
  month: string = monthInTz(),
  tz: string = deviceTimezone(),
): Promise<CalendarDay[]> {
  const res = await apiRequest<CalendarResponse>({
    path: '/doses/calendar',
    query: { month, tz },
    auth: true,
  });
  return res.days ?? [];
}

export async function logDose(
  doseLogId: string,
  status: DoseStatus,
  takenAt?: string | null,
): Promise<LogResponse> {
  return apiRequest<LogResponse>({
    method: 'POST',
    path: '/doses/log',
    body: { dose_log_id: doseLogId, status, taken_at: takenAt ?? null },
    auth: true,
  });
}
