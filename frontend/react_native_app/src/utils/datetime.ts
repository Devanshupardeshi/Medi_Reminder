/**
 * Bulletproof date/time formatters pinned to IST (Asia/Kolkata, UTC+05:30).
 *
 * Why this file exists:
 *   React Native ships with Hermes, which has a stripped-down `Intl`
 *   polyfill. `Date.prototype.toLocaleTimeString` and `toLocaleDateString`
 *   on Hermes:
 *     - Use the device timezone (which can be GMT, UTC, or some bad
 *       value on certain Android OEM builds), producing wrong times.
 *     - Sometimes throw outright on `{ timeZone: 'Asia/Kolkata' }`.
 *     - Don't honour the locale argument consistently across phones.
 *
 *   Every formatter here computes the result manually from epoch ms,
 *   adding the IST offset (+5:30). No `Intl`, no `toLocale*`, no device
 *   timezone reads. This is an India-first product and IST is the only
 *   timezone we display, so this is correct AND simpler.
 */

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
const WEEKDAYS_LONG = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

/**
 * Convert any Date input (epoch ms, ISO string, or Date) to a Date whose
 * UTC components reflect IST wall-clock time. Read with getUTC* methods.
 */
function toIst(input: Date | string | number): Date {
  const ms =
    input instanceof Date
      ? input.getTime()
      : typeof input === 'number'
        ? input
        : new Date(input).getTime();
  return new Date(ms + IST_OFFSET_MS);
}

/** "8:00 AM" / "1:30 PM" — always IST. */
export function formatTimeIST(input: Date | string | number): string {
  const d = toIst(input);
  let h = d.getUTCHours();
  const m = d.getUTCMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${String(m).padStart(2, '0')} ${ampm}`;
}

/** "Friday, April 26, 2026" from a YYYY-MM-DD string OR ISO timestamp. */
export function formatLongDateIST(input: Date | string | number): string {
  // YYYY-MM-DD shortcut: parse directly so we don't accidentally drift
  // by a day when the device is in a non-IST timezone.
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const [y, m, day] = input.split('-').map((n) => parseInt(n, 10));
    // Anchor to noon UTC so any timezone math keeps the calendar date.
    const d = new Date(Date.UTC(y, m - 1, day, 12));
    return `${WEEKDAYS_LONG[d.getUTCDay()]}, ${MONTHS_LONG[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
  }
  const d = toIst(input);
  return `${WEEKDAYS_LONG[d.getUTCDay()]}, ${MONTHS_LONG[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

/** "April 2026" from "YYYY-MM". */
export function formatMonthLabel(month: string): string {
  const [y, m] = month.split('-').map((n) => parseInt(n, 10));
  if (!y || !m) return month;
  return `${MONTHS_LONG[m - 1]} ${y}`;
}

/** "26 Apr" — short calendar label. */
export function formatShortDateIST(input: Date | string | number): string {
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const [, m, day] = input.split('-').map((n) => parseInt(n, 10));
    return `${day} ${MONTHS_SHORT[m - 1]}`;
  }
  const d = toIst(input);
  return `${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()]}`;
}
