/**
 * The app-day rolls over at 3 AM local time: a 12:30 AM post-workout meal
 * counts toward the waking day, by design. `getAppDate()` is the ONLY
 * function allowed to answer "what day is it?"
 */
const DAY_ROLLOVER_HOUR = 3;

export function getAppDate(now = new Date()): string {
  const shifted = new Date(now.getTime() - DAY_ROLLOVER_HOUR * 3_600_000);
  return toISODate(shifted);
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return toISODate(new Date(y, m - 1, d + days));
}

export function daysBetween(fromIso: string, toIso: string): number {
  const [fy, fm, fd] = fromIso.split("-").map(Number);
  const [ty, tm, td] = toIso.split("-").map(Number);
  const from = new Date(fy, fm - 1, fd).getTime();
  const to = new Date(ty, tm - 1, td).getTime();
  return Math.round((to - from) / 86_400_000);
}

const WEEKDAY = new Intl.DateTimeFormat("en-US", { weekday: "long" });
const MONTH_DAY = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
});
const SHORT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

function fromISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** "Friday, July 18" */
export function formatFullDate(iso: string): string {
  const d = fromISO(iso);
  return `${WEEKDAY.format(d)}, ${MONTH_DAY.format(d)}`;
}

/** "Jul 18" */
export function formatShortDate(iso: string): string {
  return SHORT.format(fromISO(iso));
}

/** Monday of the week containing the given app-day. */
export function startOfWeek(iso: string): string {
  const d = fromISO(iso);
  const dow = (d.getDay() + 6) % 7; // Mon = 0
  return addDays(iso, -dow);
}
