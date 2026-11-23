import { describe, expect, it } from 'vitest';
import { Flashcard } from '../../core/models/study.models';
import {
  SM2_DEFAULT_EASE_FACTOR,
  SM2_MIN_EASE_FACTOR,
  applySm2Review,
  createInitialSrsState,
  formatSrsIntervalLabel,
  getFlashcardMaturity,
  isFlashcardDue,
  isFlashcardMastered,
  previewSrsIntervals,
} from './srs-sm2.util';

function makeCard(overrides: Partial<Flashcard> = {}): Flashcard {
  const now = new Date(2026, 10, 23, 10, 0, 0);
  return {
    id: 'fc-1',
    blockId: 'B4',
    topicId: 't-1',
    front: 'DNS',
    back: 'Domain Name System',
    tags: ['siglas'],
    srs: createInitialSrsState(now),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    ...overrides,
  };
}

describe('srs-sm2.util', () => {
  const baseDate = new Date(2026, 10, 23, 12, 0, 0); // 2026-11-23

  it('creates initial SRS state due today with default ease factor 2.5', () => {
    const srs = createInitialSrsState(baseDate);
    expect(srs.intervalDays).toBe(0);
    expect(srs.easeFactor).toBe(SM2_DEFAULT_EASE_FACTOR);
    expect(srs.repetitions).toBe(0);
    expect(srs.lapses).toBe(0);
    expect(srs.dueDate).toBe('2026-11-23');
  });

  it('follows standard SM-2 progression on consecutive "good" ratings (1d -> 6d -> 15d)', () => {
    let srs = createInitialSrsState(baseDate);

    srs = applySm2Review(srs, 'good', baseDate);
    expect(srs.intervalDays).toBe(1);
    expect(srs.repetitions).toBe(1);
    expect(srs.dueDate).toBe('2026-11-24');
    expect(srs.easeFactor).toBe(2.5);

    const day2 = new Date(2026, 10, 24, 12, 0, 0);
    srs = applySm2Review(srs, 'good', day2);
    expect(srs.intervalDays).toBe(6);
    expect(srs.repetitions).toBe(2);
    expect(srs.dueDate).toBe('2026-11-30');

    const day8 = new Date(2026, 10, 30, 12, 0, 0);
    srs = applySm2Review(srs, 'good', day8);
    expect(srs.intervalDays).toBe(15);
    expect(srs.repetitions).toBe(3);
    expect(srs.dueDate).toBe('2026-12-15');
  });

  it('resets repetitions, increments lapses, and keeps ease >= 1.3 on "again"', () => {
    let srs = createInitialSrsState(baseDate);
    srs = applySm2Review(srs, 'good', baseDate);
    srs = applySm2Review(srs, 'good', baseDate);

    const failed = applySm2Review(srs, 'again', baseDate);
    expect(failed.repetitions).toBe(0);
    expect(failed.intervalDays).toBe(0);
    expect(failed.lapses).toBe(1);
    expect(failed.dueDate).toBe('2026-11-23');
    expect(failed.easeFactor).toBe(2.3);

    // Repeated failures never drop below SM2_MIN_EASE_FACTOR
    let low = failed;
    for (let i = 0; i < 10; i++) {
      low = applySm2Review(low, 'again', baseDate);
    }
    expect(low.easeFactor).toBe(SM2_MIN_EASE_FACTOR);
  });

  it('produces shorter interval for "hard" and longer interval for "easy"', () => {
    const initial = createInitialSrsState(baseDate);
    const hard = applySm2Review(initial, 'hard', baseDate);
    const easy = applySm2Review(initial, 'easy', baseDate);

    expect(hard.intervalDays).toBe(1);
    expect(hard.easeFactor).toBeLessThan(SM2_DEFAULT_EASE_FACTOR);

    expect(easy.intervalDays).toBe(4);
    expect(easy.easeFactor).toBeGreaterThan(SM2_DEFAULT_EASE_FACTOR);
  });

  it('previews readable interval labels for all 4 buttons', () => {
    const preview = previewSrsIntervals(createInitialSrsState(baseDate), baseDate);
    expect(preview).toEqual({
      again: 'Hoy',
      hard: '1 día',
      good: '1 día',
      easy: '4 días',
    });
    expect(formatSrsIntervalLabel(30)).toBe('1 mes');
    expect(formatSrsIntervalLabel(365)).toBe('1 año');
  });

  it('evaluates due status and maturity accurately', () => {
    const newCard = makeCard();
    expect(isFlashcardDue(newCard, baseDate)).toBe(true);
    expect(getFlashcardMaturity(newCard)).toBe('new');
    expect(isFlashcardMastered(newCard)).toBe(false);

    const masteredCard = makeCard({
      srs: {
        intervalDays: 25,
        easeFactor: 2.6,
        repetitions: 4,
        lapses: 0,
        dueDate: '2026-12-18',
        lastReviewedAt: baseDate.toISOString(),
      },
    });
    expect(isFlashcardDue(masteredCard, baseDate)).toBe(false);
    expect(getFlashcardMaturity(masteredCard)).toBe('mastered');
    expect(isFlashcardMastered(masteredCard)).toBe(true);
  });
});
