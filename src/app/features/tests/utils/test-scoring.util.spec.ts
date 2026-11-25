import { Question } from '../../../core/models/study.models';
import {
  calculateNetScore,
  calculateScoreOn10,
  formatDurationSec,
  formatPenaltyRatio,
  scoreExamAnswers,
} from './test-scoring.util';

function makeQuestion(id: string, blockId: Question['blockId'], correctIndex: 0 | 1 | 2 | 3, topicId?: string): Question {
  return {
    id,
    blockId,
    topicId,
    prompt: `Pregunta ${id}`,
    options: ['A', 'B', 'C', 'D'],
    correctIndex,
    tags: [],
    flagged: false,
    stats: { attempts: 0, correct: 0 },
    createdAt: '2026-11-23T00:00:00.000Z',
    updatedAt: '2026-11-23T00:00:00.000Z',
  };
}

describe('test-scoring.util', () => {
  it('should compute net score with -1/3 penalty and score on 10 clamped at 0', () => {
    expect(calculateNetScore(6, 3, 1 / 3)).toBe(5);
    expect(calculateNetScore(1, 6, 1 / 3)).toBe(-1);
    expect(calculateScoreOn10(-1, 10)).toBe(0);
    expect(calculateScoreOn10(7.5, 10)).toBe(7.5);
  });

  it('should score answers with blanks, block breakdown, and topic breakdown', () => {
    const questions = [
      makeQuestion('q1', 'B1', 0, 't1'),
      makeQuestion('q2', 'B1', 1, 't1'),
      makeQuestion('q3', 'B2', 2, 't2'),
      makeQuestion('q4', 'B2', 3, 't2'),
    ];
    const selections = new Map<string, 0 | 1 | 2 | 3 | null>([
      ['q1', 0], // correct
      ['q2', 2], // wrong
      ['q3', 2], // correct
      ['q4', null], // blank
    ]);

    const result = scoreExamAnswers(questions, selections, 1 / 3);
    expect(result.correctCount).toBe(2);
    expect(result.wrongCount).toBe(1);
    expect(result.blankCount).toBe(1);
    expect(result.maxScore).toBe(4);
    expect(result.netScore).toBeCloseTo(1.67, 2);
    expect(result.scoreOn10).toBeCloseTo(4.17, 2);
    expect(result.accuracyPercent).toBe(67);
    expect(result.byBlock['B1'].correct).toBe(1);
    expect(result.byBlock['B1'].wrong).toBe(1);
    expect(result.byBlock['B2'].blank).toBe(1);
    expect(result.byTopic['t1'].total).toBe(2);
  });

  it('should format penalty ratio and duration seconds cleanly', () => {
    expect(formatPenaltyRatio(1 / 3)).toBe('-1/3');
    expect(formatPenaltyRatio(0.25)).toBe('-1/4');
    expect(formatPenaltyRatio(0)).toBe('Sin penalización');
    expect(formatDurationSec(65)).toBe('01:05');
    expect(formatDurationSec(3661)).toBe('1:01:01');
  });
});
