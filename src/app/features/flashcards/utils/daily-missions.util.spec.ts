import { describe, expect, it } from 'vitest';
import {
  Flashcard,
  StudyBlock,
  createDefaultGamificationProfile,
} from '../../../core/models/study.models';
import { createInitialSrsState } from '../../../shared/utils/srs-sm2.util';
import { generateDailyMissions } from './daily-missions.util';

const MISSION_TEST_BLOCKS: StudyBlock[] = [
  {
    id: 'block-1',
    code: 'M1',
    title: 'Asignatura 1',
    shortTitle: 'Asig 1',
    description: '',
    color: '#2563eb',
    icon: 'menu_book',
    order: 1,
  },
  {
    id: 'block-2',
    code: 'M2',
    title: 'Asignatura 2',
    shortTitle: 'Asig 2',
    description: '',
    color: '#059669',
    icon: 'lan',
    order: 2,
  },
];

describe('daily-missions.util', () => {
  const today = new Date(2026, 10, 23, 12, 0, 0);

  it('generates starter missions when the user has no flashcards or questions yet', () => {
    const missions = generateDailyMissions({
      blocks: MISSION_TEST_BLOCKS,
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
      blocks: MISSION_TEST_BLOCKS,
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

  it('keeps weekly-plan mission visible and claimable once all today plan items are completed', () => {
    const missions = generateDailyMissions({
      blocks: MISSION_TEST_BLOCKS,
      topics: [],
      flashcards: [],
      questions: [],
      studySessions: [],
      weeklyPlanItems: [
        {
          id: 'w-1',
          weekStartDate: '2026-11-23',
          dayOfWeek: 1,
          topicId: 't-1',
          blockId: 'B1',
          order: 1,
          completed: true,
          completedAt: today.toISOString(),
        },
      ],
      examAttempts: [],
      profile: createDefaultGamificationProfile(),
      today,
    });

    const planMission = missions.find((m) => m.kind === 'planner');
    expect(planMission).toBeDefined();
    expect(planMission?.completed).toBe(true);
    expect(planMission?.claimed).toBe(false);
    expect(planMission?.current).toBe(1);
    expect(planMission?.target).toBe(1);
  });

  it('caps flashcards review mission target to available deck size when under 5 cards', () => {
    const yesterday = new Date(2026, 10, 22, 12, 0, 0);
    const cards: Flashcard[] = Array.from({ length: 2 }, (_, idx) => ({
      id: `fc-${idx}`,
      blockId: 'B4',
      front: `CARD${idx}`,
      back: `Resp ${idx}`,
      tags: [],
      srs: createInitialSrsState(today),
      createdAt: yesterday.toISOString(),
      updatedAt: yesterday.toISOString(),
    }));

    const profile = {
      ...createDefaultGamificationProfile(),
      claimedMissionIds: ['2026-11-23:flashcards-start'],
    };

    const missions = generateDailyMissions({
      blocks: MISSION_TEST_BLOCKS,
      topics: [],
      flashcards: cards,
      questions: [],
      studySessions: [],
      weeklyPlanItems: [],
      examAttempts: [],
      profile,
      today,
    });

    const fcMission = missions.find((m) => m.kind === 'flashcards');
    expect(fcMission?.id).toBe('2026-11-23:flashcards-review');
    expect(fcMission?.target).toBe(2);
  });
});
