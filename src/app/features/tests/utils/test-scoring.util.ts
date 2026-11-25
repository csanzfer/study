import {
  ExamAnswer,
  Question,
  QuestionOptionIndex,
  StudyBlockId,
} from '../../../core/models/study.models';

export interface ScoreBreakdown {
  total: number;
  correct: number;
  wrong: number;
  blank: number;
  netScore: number;
  scoreOn10: number;
  accuracyPercent: number; // % sobre contestadas (o 0 si 0 contestadas)
}

export interface ExamScoreResult {
  answers: ExamAnswer[];
  correctCount: number;
  wrongCount: number;
  blankCount: number;
  netScore: number;
  maxScore: number;
  scoreOn10: number;
  accuracyPercent: number;
  byBlock: Record<StudyBlockId, ScoreBreakdown>;
  byTopic: Record<string, ScoreBreakdown>;
}

export function roundScore(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function calculateNetScore(
  correct: number,
  wrong: number,
  penaltyRatio: number,
): number {
  return roundScore(correct - wrong * penaltyRatio, 2);
}

export function calculateScoreOn10(netScore: number, maxScore: number): number {
  if (maxScore <= 0) {
    return 0;
  }
  return roundScore(Math.max(0, (netScore / maxScore) * 10), 2);
}

function createEmptyBreakdown(): ScoreBreakdown {
  return {
    total: 0,
    correct: 0,
    wrong: 0,
    blank: 0,
    netScore: 0,
    scoreOn10: 0,
    accuracyPercent: 0,
  };
}

function finalizeBreakdown(b: ScoreBreakdown, penaltyRatio: number): ScoreBreakdown {
  const answered = b.correct + b.wrong;
  const rawNet = b.correct - b.wrong * penaltyRatio;
  const netScore = roundScore(rawNet, 2);
  return {
    ...b,
    netScore,
    scoreOn10: calculateScoreOn10(rawNet, b.total),
    accuracyPercent: answered > 0 ? Math.round((b.correct / answered) * 100) : 0,
  };
}

export function scoreExamAnswers(
  questions: Question[],
  selections: ReadonlyMap<string, QuestionOptionIndex | null>,
  penaltyRatio: number,
): ExamScoreResult {
  const answers: ExamAnswer[] = [];
  let correctCount = 0;
  let wrongCount = 0;
  let blankCount = 0;

  const byBlockRaw: Record<StudyBlockId, ScoreBreakdown> = {};
  const byTopicRaw: Record<string, ScoreBreakdown> = {};

  for (const question of questions) {
    const selected = selections.get(question.id) ?? null;
    const isCorrect = selected !== null && selected === question.correctIndex;

    answers.push({
      questionId: question.id,
      blockId: question.blockId,
      topicId: question.topicId,
      selectedIndex: selected,
      correctIndex: question.correctIndex,
      isCorrect,
    });

    const blockBucket = byBlockRaw[question.blockId] ?? createEmptyBreakdown();
    byBlockRaw[question.blockId] = blockBucket;
    blockBucket.total++;

    let topicBucket: ScoreBreakdown | undefined;
    if (question.topicId) {
      topicBucket = byTopicRaw[question.topicId] ?? createEmptyBreakdown();
      byTopicRaw[question.topicId] = topicBucket;
      topicBucket.total++;
    }

    if (selected === null) {
      blankCount++;
      blockBucket.blank++;
      if (topicBucket) topicBucket.blank++;
    } else if (isCorrect) {
      correctCount++;
      blockBucket.correct++;
      if (topicBucket) topicBucket.correct++;
    } else {
      wrongCount++;
      blockBucket.wrong++;
      if (topicBucket) topicBucket.wrong++;
    }
  }

  const maxScore = questions.length;
  const rawNetScore = correctCount - wrongCount * penaltyRatio;
  const netScore = roundScore(rawNetScore, 2);
  const scoreOn10 = calculateScoreOn10(rawNetScore, maxScore);
  const answeredTotal = correctCount + wrongCount;
  const accuracyPercent =
    answeredTotal > 0 ? Math.round((correctCount / answeredTotal) * 100) : 0;

  const byBlock: Record<StudyBlockId, ScoreBreakdown> = {};
  for (const [blockId, bucket] of Object.entries(byBlockRaw)) {
    byBlock[blockId] = finalizeBreakdown(bucket, penaltyRatio);
  }

  const byTopic: Record<string, ScoreBreakdown> = {};
  for (const [topicId, bucket] of Object.entries(byTopicRaw)) {
    byTopic[topicId] = finalizeBreakdown(bucket, penaltyRatio);
  }

  return {
    answers,
    correctCount,
    wrongCount,
    blankCount,
    netScore,
    maxScore,
    scoreOn10,
    accuracyPercent,
    byBlock,
    byTopic,
  };
}

export function formatPenaltyRatio(ratio: number): string {
  if (ratio === 0) return 'Sin penalización';
  if (Math.abs(ratio - 1 / 3) < 0.005) return '-1/3';
  if (Math.abs(ratio - 0.25) < 0.005) return '-1/4';
  if (Math.abs(ratio - 0.5) < 0.005) return '-1/2';
  return `-${roundScore(ratio, 2)}`;
}

export function formatDurationSec(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  if (hours > 0) {
    return `${hours}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}

export const OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const;
