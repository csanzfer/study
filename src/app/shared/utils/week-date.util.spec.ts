import {
  formatMinutesAsHours,
  formatWeekRangeLabel,
  getIsoDayOfWeek,
  getWeekDays,
  getWeekStartDate,
  shiftWeekStartDate,
} from './week-date.util';

describe('week-date.util', () => {
  it('computes ISO Monday start date for Monday, mid-week, and Sunday', () => {
    // 2026-11-23 is Monday
    expect(getWeekStartDate(new Date(2026, 10, 23))).toBe('2026-11-23');
    // 2026-11-26 is Thursday
    expect(getWeekStartDate(new Date(2026, 10, 26))).toBe('2026-11-23');
    // 2026-11-29 is Sunday -> belongs to Monday 2026-11-23
    expect(getWeekStartDate(new Date(2026, 10, 29))).toBe('2026-11-23');
    expect(getIsoDayOfWeek(new Date(2026, 10, 29))).toBe(7);
  });

  it('shifts week start dates across month/year boundaries', () => {
    expect(shiftWeekStartDate('2026-11-23', 1)).toBe('2026-11-30');
    expect(shiftWeekStartDate('2026-11-23', -1)).toBe('2026-11-16');
    expect(shiftWeekStartDate('2026-12-28', 1)).toBe('2027-01-04');
  });

  it('generates 7 week days with isToday flagged accurately', () => {
    const days = getWeekDays('2026-11-23', new Date(2026, 10, 25));
    expect(days.length).toBe(7);
    expect(days[0].shortLabel).toBe('Lun');
    expect(days[2].isToday).toBe(true);
    expect(days[6].shortLabel).toBe('Dom');
  });

  it('formats week ranges and durations cleanly', () => {
    expect(formatWeekRangeLabel('2026-11-23')).toBe('23 – 29 nov 2026');
    expect(formatWeekRangeLabel('2026-11-30')).toBe('30 nov – 6 dic 2026');
    expect(formatMinutesAsHours(45)).toBe('45 min');
    expect(formatMinutesAsHours(120)).toBe('2 h');
    expect(formatMinutesAsHours(135)).toBe('2 h 15 min');
  });
});
