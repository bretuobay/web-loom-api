import { describe, it, expect } from 'vitest';
import { parseCron, cronMatches, getNextCronDate } from '../cron';

describe('parseCron', () => {
  it('parses wildcard expression', () => {
    const parsed = parseCron('* * * * *');
    expect(parsed.minute.values.size).toBe(60);
    expect(parsed.hour.values.size).toBe(24);
    expect(parsed.dayOfMonth.values.size).toBe(31);
    expect(parsed.month.values.size).toBe(12);
    expect(parsed.dayOfWeek.values.size).toBe(7);
  });

  it('parses exact values', () => {
    const parsed = parseCron('30 12 15 6 3');
    expect(parsed.minute.values).toEqual(new Set([30]));
    expect(parsed.hour.values).toEqual(new Set([12]));
    expect(parsed.dayOfMonth.values).toEqual(new Set([15]));
    expect(parsed.month.values).toEqual(new Set([6]));
    expect(parsed.dayOfWeek.values).toEqual(new Set([3]));
  });

  it('parses step expressions', () => {
    const parsed = parseCron('*/15 * * * *');
    expect(parsed.minute.values).toEqual(new Set([0, 15, 30, 45]));
  });

  it('parses range expressions', () => {
    const parsed = parseCron('* 9-17 * * *');
    expect(parsed.hour.values).toEqual(new Set([9, 10, 11, 12, 13, 14, 15, 16, 17]));
  });

  it('parses range with step', () => {
    const parsed = parseCron('1-30/10 * * * *');
    expect(parsed.minute.values).toEqual(new Set([1, 11, 21]));
  });

  it('parses comma-separated lists', () => {
    const parsed = parseCron('0,30 * * * *');
    expect(parsed.minute.values).toEqual(new Set([0, 30]));
  });

  it('throws on invalid field count', () => {
    expect(() => parseCron('* * *')).toThrow('expected 5 fields');
  });

  it('throws on invalid field value', () => {
    expect(() => parseCron('abc * * * *')).toThrow('Invalid cron field');
  });
});


describe('cronMatches', () => {
  it('matches a date against a cron expression', () => {
    const parsed = parseCron('30 12 * * *');
    // June 15, 2025 12:30
    const date = new Date(2025, 5, 15, 12, 30, 0);
    expect(cronMatches(parsed, date)).toBe(true);
  });

  it('does not match when minute differs', () => {
    const parsed = parseCron('30 12 * * *');
    const date = new Date(2025, 5, 15, 12, 31, 0);
    expect(cronMatches(parsed, date)).toBe(false);
  });

  it('matches every-5-minutes pattern', () => {
    const parsed = parseCron('*/5 * * * *');
    const date = new Date(2025, 5, 15, 12, 15, 0);
    expect(cronMatches(parsed, date)).toBe(true);
  });

  it('does not match non-5-minute mark', () => {
    const parsed = parseCron('*/5 * * * *');
    const date = new Date(2025, 5, 15, 12, 13, 0);
    expect(cronMatches(parsed, date)).toBe(false);
  });
});

describe('getNextCronDate', () => {
  it('finds the next matching date', () => {
    const parsed = parseCron('0 12 * * *');
    const after = new Date(2025, 5, 15, 10, 0, 0);
    const next = getNextCronDate(parsed, after);
    expect(next.getHours()).toBe(12);
    expect(next.getMinutes()).toBe(0);
  });

  it('advances to next day if past the time', () => {
    const parsed = parseCron('0 8 * * *');
    const after = new Date(2025, 5, 15, 10, 0, 0);
    const next = getNextCronDate(parsed, after);
    expect(next.getDate()).toBe(16);
    expect(next.getHours()).toBe(8);
  });
});
