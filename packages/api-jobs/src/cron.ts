/**
 * Simple Cron Expression Parser
 *
 * Supports standard 5-field cron expressions:
 *   minute hour day-of-month month day-of-week
 *
 * Supported syntax per field:
 *   - `*`        any value
 *   - `N`        exact value
 *   - `N-M`      range (inclusive)
 *   - `*​/N`      step (every N)
 *   - `N-M/S`    range with step
 *   - `N,M,...`  list of values
 */

interface CronField {
  values: Set<number>;
}

const FIELD_RANGES: [min: number, max: number][] = [
  [0, 59], // minute
  [0, 23], // hour
  [1, 31], // day of month
  [1, 12], // month
  [0, 6],  // day of week (0 = Sunday)
];

function parseField(expr: string, min: number, max: number): CronField {
  const values = new Set<number>();

  for (const part of expr.split(',')) {
    const trimmed = part.trim();

    if (trimmed === '*') {
      for (let i = min; i <= max; i++) values.add(i);
      continue;
    }

    // Step: */N or N-M/S
    const stepMatch = trimmed.match(/^(\*|(\d+)-(\d+))\/(\d+)$/);
    if (stepMatch) {
      const step = parseInt(stepMatch[4]!, 10);
      let start = min;
      let end = max;
      if (stepMatch[2] !== undefined && stepMatch[3] !== undefined) {
        start = parseInt(stepMatch[2], 10);
        end = parseInt(stepMatch[3], 10);
      }
      for (let i = start; i <= end; i += step) values.add(i);
      continue;
    }

    // Range: N-M
    const rangeMatch = trimmed.match(/^(\d+)-(\d+)$/);
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1]!, 10);
      const end = parseInt(rangeMatch[2]!, 10);
      for (let i = start; i <= end; i++) values.add(i);
      continue;
    }

    // Exact value
    const num = parseInt(trimmed, 10);
    if (!isNaN(num) && num >= min && num <= max) {
      values.add(num);
      continue;
    }

    throw new Error(`Invalid cron field value: "${trimmed}" (range ${min}-${max})`);
  }

  return { values };
}

export interface ParsedCron {
  minute: CronField;
  hour: CronField;
  dayOfMonth: CronField;
  month: CronField;
  dayOfWeek: CronField;
}

/**
 * Parse a 5-field cron expression.
 * @throws Error if the expression is invalid
 */
export function parseCron(expression: string): ParsedCron {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new Error(
      `Invalid cron expression: expected 5 fields, got ${parts.length} ("${expression}")`,
    );
  }

  return {
    minute: parseField(parts[0]!, FIELD_RANGES[0]![0], FIELD_RANGES[0]![1]),
    hour: parseField(parts[1]!, FIELD_RANGES[1]![0], FIELD_RANGES[1]![1]),
    dayOfMonth: parseField(parts[2]!, FIELD_RANGES[2]![0], FIELD_RANGES[2]![1]),
    month: parseField(parts[3]!, FIELD_RANGES[3]![0], FIELD_RANGES[3]![1]),
    dayOfWeek: parseField(parts[4]!, FIELD_RANGES[4]![0], FIELD_RANGES[4]![1]),
  };
}

/**
 * Check whether a given Date matches a parsed cron schedule.
 */
export function cronMatches(parsed: ParsedCron, date: Date): boolean {
  return (
    parsed.minute.values.has(date.getMinutes()) &&
    parsed.hour.values.has(date.getHours()) &&
    parsed.dayOfMonth.values.has(date.getDate()) &&
    parsed.month.values.has(date.getMonth() + 1) &&
    parsed.dayOfWeek.values.has(date.getDay())
  );
}

/**
 * Get the next Date (after `after`) that matches the cron expression.
 * Searches up to ~2 years ahead to avoid infinite loops.
 */
export function getNextCronDate(parsed: ParsedCron, after: Date = new Date()): Date {
  const next = new Date(after);
  // Start from the next minute
  next.setSeconds(0, 0);
  next.setMinutes(next.getMinutes() + 1);

  const maxIterations = 525_960; // ~1 year in minutes
  for (let i = 0; i < maxIterations; i++) {
    if (cronMatches(parsed, next)) {
      return next;
    }
    next.setMinutes(next.getMinutes() + 1);
  }

  throw new Error('Could not find next cron match within search window');
}
