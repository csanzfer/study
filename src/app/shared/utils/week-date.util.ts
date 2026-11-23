import { IsoDayOfWeek } from '../../core/models/study.models';

export interface WeekDayInfo {
  dayOfWeek: IsoDayOfWeek;
  shortLabel: string;
  fullLabel: string;
  dateKey: string; // YYYY-MM-DD
  dayNumber: number;
  isToday: boolean;
}

const DAY_NAMES: Record<IsoDayOfWeek, { short: string; full: string }> = {
  1: { short: 'Lun', full: 'Lunes' },
  2: { short: 'Mar', full: 'Martes' },
  3: { short: 'Mié', full: 'Miércoles' },
  4: { short: 'Jue', full: 'Jueves' },
  5: { short: 'Vie', full: 'Viernes' },
  6: { short: 'Sáb', full: 'Sábado' },
  7: { short: 'Dom', full: 'Domingo' },
};

const MONTH_SHORT_ES = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];

export function formatLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseLocalDateKey(dateKey: string): Date {
  const [yearStr, monthStr, dayStr] = dateKey.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

export function getIsoDayOfWeek(date: Date = new Date()): IsoDayOfWeek {
  const jsDay = date.getDay(); // 0 = Sunday, 1 = Monday ... 6 = Saturday
  return (jsDay === 0 ? 7 : jsDay) as IsoDayOfWeek;
}

export function getWeekStartDate(date: Date = new Date()): string {
  const isoDay = getIsoDayOfWeek(date);
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate() - (isoDay - 1));
  return formatLocalDateKey(monday);
}

export function shiftWeekStartDate(weekStartDate: string, deltaWeeks: number): string {
  const monday = parseLocalDateKey(weekStartDate);
  monday.setDate(monday.getDate() + deltaWeeks * 7);
  return formatLocalDateKey(monday);
}

export function getWeekDays(weekStartDate: string, today: Date = new Date()): WeekDayInfo[] {
  const monday = parseLocalDateKey(weekStartDate);
  const todayKey = formatLocalDateKey(today);
  const days: WeekDayInfo[] = [];

  for (let offset = 0; offset < 7; offset++) {
    const current = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + offset);
    const dayOfWeek = (offset + 1) as IsoDayOfWeek;
    const dateKey = formatLocalDateKey(current);
    days.push({
      dayOfWeek,
      shortLabel: DAY_NAMES[dayOfWeek].short,
      fullLabel: DAY_NAMES[dayOfWeek].full,
      dateKey,
      dayNumber: current.getDate(),
      isToday: dateKey === todayKey,
    });
  }

  return days;
}

export function formatWeekRangeLabel(weekStartDate: string): string {
  const monday = parseLocalDateKey(weekStartDate);
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);

  const startMonth = MONTH_SHORT_ES[monday.getMonth()];
  const endMonth = MONTH_SHORT_ES[sunday.getMonth()];

  if (monday.getMonth() === sunday.getMonth()) {
    return `${monday.getDate()} – ${sunday.getDate()} ${endMonth} ${sunday.getFullYear()}`;
  }

  if (monday.getFullYear() === sunday.getFullYear()) {
    return `${monday.getDate()} ${startMonth} – ${sunday.getDate()} ${endMonth} ${sunday.getFullYear()}`;
  }

  return `${monday.getDate()} ${startMonth} ${monday.getFullYear()} – ${sunday.getDate()} ${endMonth} ${sunday.getFullYear()}`;
}

export function isIsoTimestampInWeek(isoTimestamp: string, weekStartDate: string): boolean {
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) {
    return false;
  }
  return getWeekStartDate(date) === weekStartDate;
}

export function formatMinutesAsHours(totalMinutes: number): string {
  const safe = Math.max(0, Math.round(totalMinutes));
  if (safe < 60) {
    return `${safe} min`;
  }
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
}
