/**
 * "Order within 3 h 20 min and it arrives by Wednesday 22 October."
 *
 * Pure: give it the time and the owner's settings (Admin → Delivery estimate)
 * and it answers. Dubai keeps UTC+4 all year, so Dubai's calendar is the UTC
 * calendar of (now + 4 h).
 */

const DUBAI_OFFSET_MS = 4 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type DeliverySettings = {
  cutoff_hour: number;
  closed_days: number[];
  holidays: string[];
  days_min: number;
  days_max: number;
};

export type DeliveryEstimate = {
  /** Milliseconds left before today's cut-off, or null once it has passed (or today is closed). */
  cutoffInMs: number | null;
  /** Dubai calendar days, as YYYY-MM-DD. */
  from: string;
  to: string;
  /** How many calendar days from today the latest date is (0 = today, 1 = tomorrow). */
  toDaysAway: number;
};

const ymd = (dubaiMidnight: number) => new Date(dubaiMidnight).toISOString().slice(0, 10);

export function estimateDelivery(nowMs: number, s: DeliverySettings): DeliveryEstimate {
  const closed = new Set(s.closed_days);
  const holidays = new Set(s.holidays);
  const dubaiNow = nowMs + DUBAI_OFFSET_MS;
  const today = Math.floor(dubaiNow / DAY_MS) * DAY_MS;
  const isWorking = (day: number) => !closed.has(new Date(day).getUTCDay()) && !holidays.has(ymd(day));
  const nextWorking = (day: number) => {
    let d = day;
    for (let i = 0; i < 60 && !isWorking(d); i += 1) d += DAY_MS;
    return d;
  };
  const addWorking = (day: number, count: number) => {
    let d = day;
    for (let i = 0; i < count; i += 1) d = nextWorking(d + DAY_MS);
    return d;
  };

  const cutoff = today + Math.min(23, Math.max(0, s.cutoff_hour)) * 60 * 60 * 1000;
  const beforeCutoff = isWorking(today) && dubaiNow < cutoff;
  const dispatch = beforeCutoff ? today : nextWorking(today + DAY_MS);
  const min = Math.max(0, Math.min(s.days_min, s.days_max));
  const max = Math.max(s.days_min, s.days_max);
  const from = min === 0 ? dispatch : addWorking(dispatch, min);
  const to = max === 0 ? dispatch : addWorking(dispatch, max);
  return {
    cutoffInMs: beforeCutoff ? cutoff - dubaiNow : null,
    from: ymd(from),
    to: ymd(to),
    toDaysAway: Math.round((to - today) / DAY_MS),
  };
}

const longDay = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const shortDay = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/** "3 h 20 min", "45 min". */
export function countdown(ms: number): string {
  const minutes = Math.max(1, Math.ceil(ms / 60000));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h} h${m > 0 ? ` ${m} min` : ""}` : `${m} min`;
}

/** The estimate in one sentence. */
export function deliverySentence(e: DeliveryEstimate): string {
  const when =
    e.toDaysAway === 0
      ? "today"
      : e.toDaysAway === 1
        ? "tomorrow"
        : e.from === e.to
          ? `on ${longDay.format(new Date(`${e.to}T00:00:00Z`))}`
          : `by ${longDay.format(new Date(`${e.to}T00:00:00Z`))}`;
  if (e.cutoffInMs !== null && e.cutoffInMs <= 12 * 60 * 60 * 1000) {
    return `Order within ${countdown(e.cutoffInMs)} and it arrives ${when}.`;
  }
  return `Order now and it arrives ${when}.`;
}

/** "Wed 22 Oct", for tight spaces. */
export function shortDate(isoDay: string): string {
  return shortDay.format(new Date(`${isoDay}T00:00:00Z`));
}
