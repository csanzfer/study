import { Question, TaiBlockId } from '../../../core/models/study.models';
import { generateTestQuestions } from './test-generator.util';

function makeQ(
  id: string,
  blockId: TaiBlockId,
  opts: Partial<Question> = {},
): Question {
  return {
    id,
    blockId,
    prompt: `P ${id}`,
    options: ['A', 'B', 'C', 'D'],
    correctIndex: 0,
    tags: [],
    flagged: false,
    stats: { attempts: 0, correct: 0 },
    createdAt: '2026-11-23T00:00:00.000Z',
    updatedAt: '2026-11-23T00:00:00.000Z',
    ...opts,
  };
}

describe('test-generator.util', () => {
  const pool: Question[] = [
    makeQ('q1', 'B1', { topicId: 't1', stats: { attempts: 2, correct: 0, lastResult: 'wrong' } }),
    makeQ('q2', 'B1', { topicId: 't1', flagged: true, stats: { attempts: 1, correct: 1, lastResult: 'correct' } }),
    makeQ('q3', 'B2', { stats: { attempts: 0, correct: 0 } }),
    makeQ('q4', 'B3', { caseStudyId: 'cs1' }),
    makeQ('q5', 'B3', { caseStudyId: 'cs1' }),
    makeQ('q6', 'B4'),
  ];

  it('should filter by block, topic, and onlyUnanswered in practice mode', () => {
    const res = generateTestQuestions(pool, {
      mode: 'practice',
      blockIds: ['B1'],
      topicId: 't1',
      shuffle: false,
    });
    expect(res.questions.map((q) => q.id)).toEqual(['q1', 'q2']);

    const unanswered = generateTestQuestions(pool, {
      mode: 'practice',
      onlyUnanswered: true,
      shuffle: false,
    });
    expect(unanswered.questions.every((q) => q.stats.attempts === 0)).toBe(true);
  });

  it('should apply block quotas and emit warnings when pool is smaller than quota', () => {
    const res = generateTestQuestions(pool, {
      mode: 'simulation',
      blockQuotas: { B1: 1, B2: 2, B3: 1, B4: 1 },
      shuffle: false,
    });
    expect(res.questions.length).toBe(4);
    expect(res.warnings.length).toBe(1);
    expect(res.warnings[0]).toContain('B2');
  });

  it('should prioritize failed and flagged questions in mistakes mode', () => {
    const res = generateTestQuestions(pool, {
      mode: 'mistakes',
      mistakesFilter: 'both',
      shuffle: false,
    });
    expect(res.questions.map((q) => q.id)).toEqual(['q1', 'q2']);
  });

  it('should select all questions linked to a caseStudy in case_study mode', () => {
    const res = generateTestQuestions(pool, {
      mode: 'case_study',
      caseStudyId: 'cs1',
      shuffle: false,
    });
    expect(res.questions.map((q) => q.id)).toEqual(['q4', 'q5']);
  });

  it('should return empty questions in case_study mode when no caseStudyId is selected', () => {
    const res = generateTestQuestions(pool, {
      mode: 'case_study',
      caseStudyId: undefined,
      shuffle: false,
    });
    expect(res.questions).toEqual([]);
    expect(res.warnings).toEqual([]);
  });
});
