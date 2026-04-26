import type { CalendarDay } from '@/types/medicine';
import { getCalendar, monthInTz, todayInTz } from './doseApi';
import { formatMonthLabel } from '@/utils/datetime';

export type DayStatus = 'allTaken' | 'partial' | 'missed' | 'pending' | 'none';

export interface DayCell {
  date: string; // YYYY-MM-DD
  day: number; // 1..31
  weekdayIndex: number; // 0..6 (Sun..Sat)
  inMonth: boolean;
  status: DayStatus;
  total: number;
  taken: number;
  missed: number;
  skipped: number;
  pending: number;
  adherencePct: number; // 0..100
}

export interface AdherenceSummary {
  windowDays: number;
  totalDoses: number;
  takenDoses: number;
  missedDoses: number;
  skippedDoses: number;
  pendingDoses: number;
  adherencePct: number; // 0..100
  currentStreakDays: number; // consecutive days at 100%
  bestDay?: string;
  worstDay?: string;
}

/** Categorise one calendar entry into a heatmap colour bucket. */
export function classifyDay(d: CalendarDay): DayStatus {
  if (d.total === 0) return 'none';
  if (d.taken === d.total) return 'allTaken';
  if (d.missed > 0 && d.taken === 0) return 'missed';
  if (d.taken > 0 && (d.missed > 0 || d.skipped > 0)) return 'partial';
  if (d.pending === d.total) return 'pending';
  return 'partial';
}

/**
 * Build a 6×7 grid for a given month (YYYY-MM). Out-of-month days are filled
 * to keep the grid rectangular but flagged with `inMonth: false` so the
 * renderer can dim them.
 */
export function buildMonthGrid(
  month: string,
  days: CalendarDay[],
): DayCell[] {
  const map = new Map<string, CalendarDay>();
  for (const d of days) map.set(d.date, d);

  const [year, m] = month.split('-').map((n) => parseInt(n, 10));
  const first = new Date(Date.UTC(year, m - 1, 1));
  const lastDay = new Date(Date.UTC(year, m, 0)).getUTCDate();
  const startWeekday = first.getUTCDay(); // 0..6

  const cells: DayCell[] = [];
  for (let i = 0; i < 42; i++) {
    const offset = i - startWeekday;
    const date = new Date(Date.UTC(year, m - 1, 1 + offset));
    const yyyy = date.getUTCFullYear();
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(date.getUTCDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const inMonth = offset >= 0 && offset < lastDay;
    const day = date.getUTCDate();
    const data = map.get(dateStr);
    const status: DayStatus = data ? classifyDay(data) : 'none';
    const adh =
      data && data.total > 0
        ? Math.round((data.taken / data.total) * 100)
        : 0;
    cells.push({
      date: dateStr,
      day,
      weekdayIndex: i % 7,
      inMonth,
      status,
      total: data?.total ?? 0,
      taken: data?.taken ?? 0,
      missed: data?.missed ?? 0,
      skipped: data?.skipped ?? 0,
      pending: data?.pending ?? 0,
      adherencePct: adh,
    });
  }
  return cells;
}

/** Aggregate the last `windowDays` ending today (inclusive). */
export function summariseWindow(
  days: CalendarDay[],
  windowDays: number,
  today = todayInTz(),
): AdherenceSummary {
  const cutoff = new Date(today + 'T00:00:00Z');
  cutoff.setUTCDate(cutoff.getUTCDate() - (windowDays - 1));
  const fromIso = cutoff.toISOString().slice(0, 10);

  const inWindow = days.filter((d) => d.date >= fromIso && d.date <= today);

  let total = 0;
  let taken = 0;
  let missed = 0;
  let skipped = 0;
  let pending = 0;
  let bestDay: string | undefined;
  let bestPct = -1;
  let worstDay: string | undefined;
  let worstPct = 101;

  for (const d of inWindow) {
    total += d.total;
    taken += d.taken;
    missed += d.missed;
    skipped += d.skipped;
    pending += d.pending;
    if (d.total > 0) {
      const pct = (d.taken / d.total) * 100;
      if (pct > bestPct) {
        bestPct = pct;
        bestDay = d.date;
      }
      if (pct < worstPct) {
        worstPct = pct;
        worstDay = d.date;
      }
    }
  }

  // Streak: count back from today while every day is 100% taken.
  const sortedDesc = [...inWindow].sort((a, b) => (a.date < b.date ? 1 : -1));
  let streak = 0;
  for (const d of sortedDesc) {
    if (d.total > 0 && d.taken === d.total) streak += 1;
    else if (d.total === 0) continue;
    else break;
  }

  const adherencePct =
    total > 0 ? Math.round((taken / total) * 100) : 0;

  return {
    windowDays,
    totalDoses: total,
    takenDoses: taken,
    missedDoses: missed,
    skippedDoses: skipped,
    pendingDoses: pending,
    adherencePct,
    currentStreakDays: streak,
    bestDay,
    worstDay,
  };
}

/**
 * Fetch the current and previous calendar months so the user can scroll back
 * one month for a full 30-day window even at the start of the month.
 */
export async function loadHistoryWindow(opts?: {
  month?: string;
}): Promise<{ month: string; days: CalendarDay[] }> {
  const month = opts?.month ?? monthInTz();
  const [y, m] = month.split('-').map((n) => parseInt(n, 10));
  const prevDate = new Date(Date.UTC(y, m - 2, 1));
  const prevMonth = `${prevDate.getUTCFullYear()}-${String(
    prevDate.getUTCMonth() + 1,
  ).padStart(2, '0')}`;

  const [thisMonthDays, prevMonthDays] = await Promise.all([
    getCalendar(month),
    getCalendar(prevMonth).catch(() => [] as CalendarDay[]),
  ]);

  return {
    month,
    days: [...prevMonthDays, ...thisMonthDays],
  };
}

/** Pretty month label e.g. "April 2026" — uses our IST-safe formatter
 * because `Date.prototype.toLocaleString` is unreliable on Hermes. */
export const monthLabel = formatMonthLabel;

/** Shift YYYY-MM by ±1 month. */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map((n) => parseInt(n, 10));
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
