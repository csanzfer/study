import { GamificationProfile } from '../../../core/models/study.models';
import { formatLocalDateKey, parseLocalDateKey } from '../../../shared/utils/week-date.util';

export type StreakCalendarDayStatus = 'active' | 'rest' | 'freeze' | 'missed' | 'today_pending';

export interface StreakCalendarDay {
  dateKey: string;
  dayNumber: number;
  weekdayShort: string;
  status: StreakCalendarDayStatus;
  isToday: boolean;
}

export interface StreakSummary {
  currentStreak: number;
  longestStreak: number;
  studiedToday: boolean;
  isTodayRestDay: boolean;
  freezesAvailable: number;
  maxFreezes: number;
  freezesUsedRecently: number;
  atRiskToday: boolean;
  calendarDays: StreakCalendarDay[];
}

const WEEKDAY_SHORT_JS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MAX_HISTORY_DAYS = 90;

export function getLevelFromXp(xp: number): {
  level: number;
  title: string;
  currentLevelXp: number;
  nextLevelXp: number;
  progressPercent: number;
} {
  const safeXp = Math.max(0, Math.floor(xp));
  const xpPerLevel = 250;
  const level = Math.floor(safeXp / xpPerLevel) + 1;
  const currentLevelXp = safeXp % xpPerLevel;
  const progressPercent = Math.round((currentLevelXp / xpPerLevel) * 100);

  const titles = [
    'Aprendiz',
    'Estudiante Activo',
    'Constante',
    'Especialista',
    'Maestro del Temario',
    'Leyenda del Estudio',
  ];
  const title = titles[Math.min(titles.length - 1, Math.floor((level - 1) / 2))];

  return {
    level,
    title,
    currentLevelXp,
    nextLevelXp: xpPerLevel,
    progressPercent,
  };
}

/**
 * Evaluates a GamificationProfile against `today` without mutating it,
 * resolving any missed days between `lastActiveDate` and yesterday using
 * `weeklyRestDays` and `streakFreezes`.
 */
export function evaluateStreakState(
  profile: GamificationProfile,
  today: Date = new Date(),
): {
  effectiveStreak: number;
  effectiveFreezes: number;
  pendingFreezeDates: string[];
  broken: boolean;
} {
  const todayKey = formatLocalDateKey(today);
  const restDays = new Set(profile.weeklyRestDays ?? [0]);

  if (!profile.lastActiveDate || profile.streakDays <= 0) {
    return {
      effectiveStreak: 0,
      effectiveFreezes: profile.streakFreezes,
      pendingFreezeDates: [],
      broken: false,
    };
  }

  if (profile.lastActiveDate >= todayKey) {
    return {
      effectiveStreak: profile.streakDays,
      effectiveFreezes: profile.streakFreezes,
      pendingFreezeDates: [],
      broken: false,
    };
  }

  const missedStudyDays: string[] = [];
  const cursor = parseLocalDateKey(profile.lastActiveDate);
  cursor.setDate(cursor.getDate() + 1);

  while (formatLocalDateKey(cursor) < todayKey) {
    const key = formatLocalDateKey(cursor);
    if (!restDays.has(cursor.getDay())) {
      missedStudyDays.push(key);
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  if (missedStudyDays.length === 0) {
    return {
      effectiveStreak: profile.streakDays,
      effectiveFreezes: profile.streakFreezes,
      pendingFreezeDates: [],
      broken: false,
    };
  }

  if (missedStudyDays.length <= profile.streakFreezes) {
    return {
      effectiveStreak: profile.streakDays,
      effectiveFreezes: profile.streakFreezes - missedStudyDays.length,
      pendingFreezeDates: missedStudyDays,
      broken: false,
    };
  }

  return {
    effectiveStreak: 0,
    effectiveFreezes: profile.streakFreezes,
    pendingFreezeDates: [],
    broken: true,
  };
}

/**
 * Records study activity for `now`, adding XP, applying flexible streak rules
 * (rest days + automatic freeze consumption), and granting +1 freeze every 7 streak days.
 */
export function recordGamificationActivity(
  profile: GamificationProfile,
  xpDelta: number,
  now: Date = new Date(),
): GamificationProfile {
  const todayKey = formatLocalDateKey(now);
  const nowIso = now.toISOString();
  const safeXpDelta = Math.max(0, Math.round(xpDelta));
  const maxFreezes = Math.max(1, profile.maxStreakFreezes || 3);

  const alreadyActiveToday =
    profile.lastActiveDate === todayKey || profile.activeDates.includes(todayKey);

  if (alreadyActiveToday) {
    return {
      ...profile,
      xp: profile.xp + safeXpDelta,
      updatedAt: nowIso,
    };
  }

  const evaluated = evaluateStreakState(profile, now);
  const nextStreak = evaluated.broken ? 1 : evaluated.effectiveStreak + 1;
  const nextLongest = Math.max(profile.longestStreakDays || 0, nextStreak);

  let nextFreezes = evaluated.effectiveFreezes;
  if (nextStreak > 0 && nextStreak % 7 === 0 && nextFreezes < maxFreezes) {
    nextFreezes += 1;
  }

  const nextActiveDates = pruneDateHistory([...profile.activeDates, todayKey]);
  const nextFreezeDates = pruneDateHistory([
    ...profile.freezeUsedDates,
    ...evaluated.pendingFreezeDates,
  ]);

  return {
    ...profile,
    xp: profile.xp + safeXpDelta,
    streakDays: nextStreak,
    longestStreakDays: nextLongest,
    streakFreezes: nextFreezes,
    maxStreakFreezes: maxFreezes,
    lastActiveDate: todayKey,
    activeDates: nextActiveDates,
    freezeUsedDates: nextFreezeDates,
    updatedAt: nowIso,
  };
}

export function buildStreakSummary(
  profile: GamificationProfile,
  today: Date = new Date(),
  calendarLength = 28,
): StreakSummary {
  const todayKey = formatLocalDateKey(today);
  const restDays = new Set(profile.weeklyRestDays ?? [0]);
  const evaluated = evaluateStreakState(profile, today);
  const studiedToday =
    profile.lastActiveDate === todayKey || profile.activeDates.includes(todayKey);
  const isTodayRestDay = restDays.has(today.getDay());

  const activeSet = new Set(profile.activeDates);
  const freezeSet = new Set([...profile.freezeUsedDates, ...evaluated.pendingFreezeDates]);

  const calendarDays: StreakCalendarDay[] = [];
  for (let offset = calendarLength - 1; offset >= 0; offset--) {
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset);
    const key = formatLocalDateKey(day);
    const isToday = key === todayKey;
    let status: StreakCalendarDayStatus;

    if (activeSet.has(key)) {
      status = 'active';
    } else if (freezeSet.has(key)) {
      status = 'freeze';
    } else if (restDays.has(day.getDay())) {
      status = 'rest';
    } else if (isToday) {
      status = 'today_pending';
    } else {
      status = 'missed';
    }

    calendarDays.push({
      dateKey: key,
      dayNumber: day.getDate(),
      weekdayShort: WEEKDAY_SHORT_JS[day.getDay()],
      status,
      isToday,
    });
  }

  return {
    currentStreak: evaluated.effectiveStreak,
    longestStreak: Math.max(profile.longestStreakDays || 0, evaluated.effectiveStreak),
    studiedToday,
    isTodayRestDay,
    freezesAvailable: evaluated.effectiveFreezes,
    maxFreezes: profile.maxStreakFreezes || 3,
    freezesUsedRecently: evaluated.pendingFreezeDates.length,
    atRiskToday: evaluated.effectiveStreak > 0 && !studiedToday && !isTodayRestDay,
    calendarDays,
  };
}

function pruneDateHistory(dates: string[]): string[] {
  return Array.from(new Set(dates))
    .sort()
    .slice(-MAX_HISTORY_DAYS);
}
