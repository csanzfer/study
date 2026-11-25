import {
  ExamAttempt,
  Question,
  StudyBlock,
  StudyBlockId,
  Topic,
} from '../../../core/models/study.models';
import { roundScore } from './test-scoring.util';

export interface BlockPerformance {
  blockId: StudyBlockId;
  code: string;
  shortTitle: string;
  color: string;
  totalQuestions: number;
  answeredCount: number;
  correctCount: number;
  accuracyPercent: number | null;
}

export interface TopicPerformance {
  topicId: string;
  blockId: StudyBlockId;
  title: string;
  totalQuestions: number;
  attempts: number;
  correct: number;
  wrong: number;
  accuracyPercent: number;
}

export interface AttemptTrendPoint {
  attemptId: string;
  date: string;
  title: string;
  mode: ExamAttempt['mode'];
  scoreOn10: number;
  netScore: number;
  maxScore: number;
}

export function computeBlockPerformance(
  blocks: readonly StudyBlock[],
  questions: readonly Question[],
): BlockPerformance[] {
  return blocks.map((block) => {
    const blockQuestions = questions.filter((q) => q.blockId === block.id);
    let answeredCount = 0;
    let correctCount = 0;

    for (const q of blockQuestions) {
      answeredCount += q.stats.attempts;
      correctCount += q.stats.correct;
    }

    return {
      blockId: block.id,
      code: block.code,
      shortTitle: block.shortTitle,
      color: block.color,
      totalQuestions: blockQuestions.length,
      answeredCount,
      correctCount,
      accuracyPercent:
        answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : null,
    };
  });
}

export function computeWeakestTopics(
  topics: readonly Topic[],
  questions: readonly Question[],
  limit = 10,
): TopicPerformance[] {
  const topicMap = new Map(topics.map((t) => [t.id, t]));
  const agg = new Map<
    string,
    { totalQuestions: number; attempts: number; correct: number }
  >();

  for (const q of questions) {
    if (!q.topicId || !topicMap.has(q.topicId)) {
      continue;
    }
    const entry = agg.get(q.topicId) ?? { totalQuestions: 0, attempts: 0, correct: 0 };
    entry.totalQuestions++;
    entry.attempts += q.stats.attempts;
    entry.correct += q.stats.correct;
    agg.set(q.topicId, entry);
  }

  const results: TopicPerformance[] = [];
  for (const [topicId, stats] of agg.entries()) {
    if (stats.attempts === 0) {
      continue;
    }
    const topic = topicMap.get(topicId)!;
    const wrong = Math.max(0, stats.attempts - stats.correct);
    results.push({
      topicId,
      blockId: topic.blockId,
      title: topic.title,
      totalQuestions: stats.totalQuestions,
      attempts: stats.attempts,
      correct: stats.correct,
      wrong,
      accuracyPercent: Math.round((stats.correct / stats.attempts) * 100),
    });
  }

  return results
    .sort((a, b) => a.accuracyPercent - b.accuracyPercent || b.wrong - a.wrong)
    .slice(0, limit);
}

export function computeAttemptTrend(
  attempts: readonly ExamAttempt[],
  maxPoints = 15,
): AttemptTrendPoint[] {
  return [...attempts]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-maxPoints)
    .map((attempt) => ({
      attemptId: attempt.id,
      date: attempt.date,
      title: attempt.title,
      mode: attempt.mode,
      scoreOn10: roundScore(attempt.scoreOn10, 2),
      netScore: roundScore(attempt.netScore, 2),
      maxScore: attempt.maxScore,
    }));
}

export function computeAverageScoreOn10(attempts: readonly ExamAttempt[]): number | null {
  if (attempts.length === 0) {
    return null;
  }
  const sum = attempts.reduce((acc, item) => acc + item.scoreOn10, 0);
  return roundScore(sum / attempts.length, 2);
}
