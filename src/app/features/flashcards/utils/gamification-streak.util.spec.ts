import { describe, expect, it } from 'vitest';
import { createDefaultGamificationProfile } from '../../../core/models/study.models';
import {
  buildStreakSummary,
  evaluateStreakState,
  getLevelFromXp,
  recordGamificationActivity,
} from './gamification-streak.util';

describe('gamification-streak.util', () => {
  it('increments streak on consecutive days and stays idempotent on same day', () => {
    let profile = createDefaultGamificationProfile('2026-11-23T08:00:00.000Z');
    const mon = new Date(2026, 10, 23, 10, 0); // Monday
    const tue = new Date(2026, 10, 24, 10, 0); // Tuesday

    profile = recordGamificationActivity(profile, 20, mon);
    expect(profile.streakDays).toBe(1);
    expect(profile.xp).toBe(20);

    // Same day again adds XP without inflating streak
    profile = recordGamificationActivity(profile, 15, mon);
    expect(profile.streakDays).toBe(1);
    expect(profile.xp).toBe(35);

    profile = recordGamificationActivity(profile, 10, tue);
    expect(profile.streakDays).toBe(2);
    expect(profile.longestStreakDays).toBe(2);
  });

  it('respects configured weekly rest days without spending a freeze', () => {
    let profile = createDefaultGamificationProfile('2026-11-21T10:00:00.000Z');
    profile.weeklyRestDays = [0]; // Sunday rest
    const sat = new Date(2026, 10, 21, 10, 0); // Saturday
    const mon = new Date(2026, 10, 23, 10, 0); // Monday (skipped Sunday)

    profile = recordGamificationActivity(profile, 10, sat);
    expect(profile.streakDays).toBe(1);
    expect(profile.streakFreezes).toBe(2);

    const updated = recordGamificationActivity(profile, 10, mon);
    expect(updated.streakDays).toBe(2);
    expect(updated.streakFreezes).toBe(2);
    expect(updated.freezeUsedDates).toEqual([]);
  });

  it('consumes a streak freeze when missing a non-rest day and preserves the streak', () => {
    let profile = createDefaultGamificationProfile('2026-11-23T10:00:00.000Z');
    const mon = new Date(2026, 10, 23, 10, 0);
    const wed = new Date(2026, 10, 25, 10, 0); // missed Tuesday

    profile = recordGamificationActivity(profile, 10, mon);
    const evaluated = evaluateStreakState(profile, wed);
    expect(evaluated.broken).toBe(false);
    expect(evaluated.effectiveFreezes).toBe(1);
    expect(evaluated.pendingFreezeDates).toEqual(['2026-11-24']);

    const resumed = recordGamificationActivity(profile, 10, wed);
    expect(resumed.streakDays).toBe(2);
    expect(resumed.streakFreezes).toBe(1);
    expect(resumed.freezeUsedDates).toEqual(['2026-11-24']);
  });

  it('breaks streak when missed study days exceed available freezes', () => {
    let profile = createDefaultGamificationProfile('2026-11-16T10:00:00.000Z');
    profile.streakFreezes = 1;
    const mon = new Date(2026, 10, 16, 10, 0);
    const thu = new Date(2026, 10, 19, 10, 0); // missed Tue & Wed (2 > 1 freeze)

    profile = recordGamificationActivity(profile, 10, mon);
    const evaluated = evaluateStreakState(profile, thu);
    expect(evaluated.broken).toBe(true);
    expect(evaluated.effectiveStreak).toBe(0);

    const restarted = recordGamificationActivity(profile, 10, thu);
    expect(restarted.streakDays).toBe(1);
  });

  it('grants +1 streak freeze every 7 streak days up to maxStreakFreezes', () => {
    let profile = createDefaultGamificationProfile('2026-11-01T10:00:00.000Z');
    profile.streakFreezes = 1;
    profile.maxStreakFreezes = 3;

    for (let day = 2; day <= 8; day++) {
      profile = recordGamificationActivity(profile, 10, new Date(2026, 10, day, 10, 0));
    }

    expect(profile.streakDays).toBe(7);
    expect(profile.streakFreezes).toBe(2);
  });

  it('builds a 28-day summary calendar and calculates XP levels', () => {
    let profile = createDefaultGamificationProfile('2026-11-23T10:00:00.000Z');
    const today = new Date(2026, 10, 23, 10, 0);
    profile = recordGamificationActivity(profile, 300, today);

    const summary = buildStreakSummary(profile, today, 14);
    expect(summary.calendarDays.length).toBe(14);
    expect(summary.studiedToday).toBe(true);
    expect(summary.calendarDays[13].status).toBe('active');

    const lvl = getLevelFromXp(profile.xp);
    expect(lvl.level).toBe(2);
    expect(lvl.title).toBe('Aprendiz');
    expect(lvl.currentLevelXp).toBe(50);
    expect(getLevelFromXp(3000).title).toBe('Leyenda del Estudio');
  });
});
