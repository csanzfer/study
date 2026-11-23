import { describe, expect, it } from 'vitest';
import { TAI_BLOCKS_SEED } from '../../../core/db/tai-seed';
import {
  Flashcard,
  createDefaultGamificationProfile,
} from '../../../core/models/study.models';
import { createInitialSrsState } from '../../../shared/utils/srs-sm2.util';
import { generateDailyMissions } from './daily-missions.util';

describe('daily-missions.util', () => {
  const today = new Date(2026, 10, 23, 12, 0, 0);

  it('generates starter missions when the user has no flashcards or questions yet', () => {
    const missions = generateDailyMissions({
      blocks: TAI_BLOCKS_SEED,
      topics: [],
      flashcards: [],
      questions: [],
      studySessions: [],
      weeklyPlanItems: [],
      examAttempts: [],
      profile: createDefaultGamificationProfile(),
      today,
    });

    expect(missions.length).toBe(2);
    expect(missions[0].kind).toBe('flashcards');
    expect(missions[1].kind).toBe('pomodoro');
  });

  it('tracks live completion for flashcards, acronyms, and pomodoro study sessions', () => {
    const cards: Flashcard[] = Array.from({ length: 5 }, (_, idx) => ({
      id: `fc-${idx}`,
      blockId: 'B4',
      front: `SIGLA${idx}`,
      back: `Significado ${idx}`,
      tags: ['siglas'],
      srs: {
        ...createInitialSrsState(today),
        lastReviewedAt: today.toISOString(),
      },
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    }));

    const missions = generateDailyMissions({
      blocks: TAI_BLOCKS_SEED,
      topics: [],
      flashcards: cards,
      questions: [],
      studySessions: [
        {
          id: 's-1',
          topicId: '',
          blockId: 'B4',
          startedAt: today.toISOString(),
          endedAt: today.toISOString(),
          durationMinutes: 25,
          type: 'reading',
        },
      ],
      weeklyPlanItems: [],
      examAttempts: [],
      profile: createDefaultGamificationProfile(),
      today,
    });

    const fcMission = missions.find((m) => m.kind === 'flashcards');
    const acrMission = missions.find((m) => m.kind === 'acronyms');
    const pomMission = missions.find((m) => m.kind === 'pomodoro');

    expect(fcMission?.completed).toBe(true);
    expect(acrMission?.completed).toBe(true);
    expect(pomMission?.completed).toBe(true);
  });
});
