import { Flashcard, FlashcardRating, FlashcardSrsState } from '../../core/models/study.models';
import { formatLocalDateKey, parseLocalDateKey } from './week-date.util';

export const SM2_DEFAULT_EASE_FACTOR = 2.5;
export const SM2_MIN_EASE_FACTOR = 1.3;
export const FLASHCARD_MASTERED_INTERVAL_DAYS = 21;

export type FlashcardMaturity = 'new' | 'learning' | 'mastered';

export function createInitialSrsState(today: Date = new Date()): FlashcardSrsState {
  return {
    intervalDays: 0,
    easeFactor: SM2_DEFAULT_EASE_FACTOR,
    repetitions: 0,
    lapses: 0,
    dueDate: formatLocalDateKey(today),
  };
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  const date = parseLocalDateKey(dateKey);
  date.setDate(date.getDate() + Math.round(days));
  return formatLocalDateKey(date);
}

/**
 * Applies the SM-2 spaced repetition algorithm with 4 ratings:
 * - again (q=1): resets repetitions to 0, intervalDays to 0 (re-queue today), increments lapses
 * - hard  (q=3): shorter interval growth, slight ease decrease
 * - good  (q=4): standard SM-2 progression (1d -> 6d -> round(prev * EF))
 * - easy  (q=5): accelerated interval growth and ease bonus
 */
export function applySm2Review(
  current: FlashcardSrsState,
  rating: FlashcardRating,
  now: Date = new Date(),
): FlashcardSrsState {
  const todayKey = formatLocalDateKey(now);
  const nowIso = now.toISOString();
  const prevEase = Number.isFinite(current.easeFactor)
    ? Math.max(SM2_MIN_EASE_FACTOR, current.easeFactor)
    : SM2_DEFAULT_EASE_FACTOR;
  const prevInterval = Math.max(0, current.intervalDays || 0);
  const prevReps = Math.max(0, current.repetitions || 0);
  const prevLapses = Math.max(0, current.lapses || 0);

  if (rating === 'again') {
    const nextEase = roundEase(Math.max(SM2_MIN_EASE_FACTOR, prevEase - 0.2));
    return {
      intervalDays: 0,
      easeFactor: nextEase,
      repetitions: 0,
      lapses: prevLapses + 1,
      dueDate: todayKey,
      lastReviewedAt: nowIso,
    };
  }

  const quality = rating === 'hard' ? 3 : rating === 'good' ? 4 : 5;
  const rawEase = prevEase + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  const nextEase = roundEase(Math.max(SM2_MIN_EASE_FACTOR, rawEase));
  const nextReps = prevReps + 1;

  let nextInterval: number;
  if (rating === 'hard') {
    if (prevReps === 0) {
      nextInterval = 1;
    } else if (prevReps === 1) {
      nextInterval = 3;
    } else {
      nextInterval = Math.max(prevInterval + 1, Math.round(prevInterval * 1.2));
    }
  } else if (rating === 'good') {
    if (prevReps === 0) {
      nextInterval = 1;
    } else if (prevReps === 1) {
      nextInterval = 6;
    } else {
      nextInterval = Math.max(prevInterval + 1, Math.round(prevInterval * nextEase));
    }
  } else {
    // easy
    if (prevReps === 0) {
      nextInterval = 4;
    } else if (prevReps === 1) {
      nextInterval = 10;
    } else {
      nextInterval = Math.max(prevInterval + 2, Math.round(prevInterval * nextEase * 1.3));
    }
  }

  return {
    intervalDays: nextInterval,
    easeFactor: nextEase,
    repetitions: nextReps,
    lapses: prevLapses,
    dueDate: addDaysToDateKey(todayKey, nextInterval),
    lastReviewedAt: nowIso,
  };
}

export function previewSrsIntervals(
  current: FlashcardSrsState,
  now: Date = new Date(),
): Record<FlashcardRating, string> {
  const ratings: FlashcardRating[] = ['again', 'hard', 'good', 'easy'];
  const result = {} as Record<FlashcardRating, string>;
  for (const rating of ratings) {
    const next = applySm2Review(current, rating, now);
    result[rating] = formatSrsIntervalLabel(next.intervalDays);
  }
  return result;
}

export function formatSrsIntervalLabel(intervalDays: number): string {
  if (intervalDays <= 0) {
    return 'Hoy';
  }
  if (intervalDays === 1) {
    return '1 día';
  }
  if (intervalDays < 30) {
    return `${intervalDays} días`;
  }
  const months = Math.round((intervalDays / 30) * 10) / 10;
  if (months < 12) {
    return months === 1 ? '1 mes' : `${months} meses`;
  }
  const years = Math.round((intervalDays / 365) * 10) / 10;
  return years === 1 ? '1 año' : `${years} años`;
}

export function isFlashcardDue(card: Flashcard, today: Date = new Date()): boolean {
  const todayKey = formatLocalDateKey(today);
  return card.srs.dueDate <= todayKey;
}

export function isFlashcardNew(card: Flashcard): boolean {
  return card.srs.repetitions === 0 && !card.srs.lastReviewedAt;
}

export function isFlashcardMastered(card: Flashcard): boolean {
  return card.srs.intervalDays >= FLASHCARD_MASTERED_INTERVAL_DAYS && card.srs.repetitions >= 3;
}

export function getFlashcardMaturity(card: Flashcard): FlashcardMaturity {
  if (isFlashcardNew(card)) {
    return 'new';
  }
  if (isFlashcardMastered(card)) {
    return 'mastered';
  }
  return 'learning';
}

export function wasFlashcardReviewedOnDate(card: Flashcard, dateKey: string): boolean {
  if (!card.srs.lastReviewedAt) {
    return false;
  }
  const reviewedDate = new Date(card.srs.lastReviewedAt);
  if (Number.isNaN(reviewedDate.getTime())) {
    return false;
  }
  return formatLocalDateKey(reviewedDate) === dateKey;
}

function roundEase(value: number): number {
  return Math.round(value * 100) / 100;
}
