import { ExamAttempt, Question, StudyBlock, Topic } from '../../../core/models/study.models';
import {
  computeAttemptTrend,
  computeAverageScoreOn10,
  computeBlockPerformance,
  computeWeakestTopics,
} from './test-analytics.util';

const ANALYTICS_TEST_BLOCKS: StudyBlock[] = [
  {
    id: 'B1',
    code: 'DER',
    title: 'Derecho',
    shortTitle: 'Derecho',
    description: '',
    color: '#2563eb',
    icon: 'gavel',
    order: 1,
  },
  {
    id: 'B2',
    code: 'HW',
    title: 'Hardware',
    shortTitle: 'Hardware',
    description: '',
    color: '#0891b2',
    icon: 'memory',
    order: 2,
  },
  {
    id: 'B3',
    code: 'DEV',
    title: 'Desarrollo',
    shortTitle: 'Desarrollo',
    description: '',
    color: '#7c3aed',
    icon: 'code',
    order: 3,
  },
];

describe('test-analytics.util', () => {
  const topics: Topic[] = [
    {
      id: 't1',
      blockId: 'B1',
      order: 1,
      title: 'Constitución',
      status: 'memorizing',
      roundCount: 1,
      tags: [],
      contentJson: {},
      plainText: '',
      createdAt: '2026-11-20T00:00:00.000Z',
      updatedAt: '2026-11-20T00:00:00.000Z',
    },
    {
      id: 't2',
      blockId: 'B3',
      order: 1,
      title: 'SQL',
      status: 'first_round',
      roundCount: 0,
      tags: [],
      contentJson: {},
      plainText: '',
      createdAt: '2026-11-20T00:00:00.000Z',
      updatedAt: '2026-11-20T00:00:00.000Z',
    },
  ];

  const questions: Question[] = [
    {
      id: 'q1',
      blockId: 'B1',
      topicId: 't1',
      prompt: 'P1',
      options: ['A', 'B', 'C', 'D'],
      correctIndex: 0,
      tags: [],
      flagged: false,
      stats: { attempts: 4, correct: 3 },
      createdAt: '2026-11-20T00:00:00.000Z',
      updatedAt: '2026-11-20T00:00:00.000Z',
    },
    {
      id: 'q2',
      blockId: 'B3',
      topicId: 't2',
      prompt: 'P2',
      options: ['A', 'B', 'C', 'D'],
      correctIndex: 1,
      tags: [],
      flagged: false,
      stats: { attempts: 4, correct: 1 },
      createdAt: '2026-11-20T00:00:00.000Z',
      updatedAt: '2026-11-20T00:00:00.000Z',
    },
  ];

  it('should compute block performance and weakest topics sorted by lowest accuracy', () => {
    const blocks = computeBlockPerformance(ANALYTICS_TEST_BLOCKS, questions);
    expect(blocks.find((b) => b.blockId === 'B1')?.accuracyPercent).toBe(75);
    expect(blocks.find((b) => b.blockId === 'B3')?.accuracyPercent).toBe(25);
    expect(blocks.find((b) => b.blockId === 'B2')?.accuracyPercent).toBeNull();

    const weakest = computeWeakestTopics(topics, questions);
    expect(weakest.map((w) => w.topicId)).toEqual(['t2', 't1']);
    expect(weakest[0].accuracyPercent).toBe(25);
    expect(weakest[0].wrong).toBe(3);
  });

  it('should compute attempt trend sorted chronologically and average score', () => {
    const attempts: ExamAttempt[] = [
      {
        id: 'a2',
        title: 'Test 2',
        date: '2026-11-23T12:00:00.000Z',
        mode: 'simulation',
        penaltyRatio: 1 / 3,
        answers: [],
        correctCount: 8,
        wrongCount: 2,
        blankCount: 0,
        netScore: 7.33,
        maxScore: 10,
        scoreOn10: 7.33,
        durationSec: 300,
      },
      {
        id: 'a1',
        title: 'Test 1',
        date: '2026-11-22T12:00:00.000Z',
        mode: 'practice',
        penaltyRatio: 0,
        answers: [],
        correctCount: 5,
        wrongCount: 5,
        blankCount: 0,
        netScore: 5,
        maxScore: 10,
        scoreOn10: 5,
        durationSec: 200,
      },
    ];

    const trend = computeAttemptTrend(attempts);
    expect(trend.map((p) => p.attemptId)).toEqual(['a1', 'a2']);
    expect(computeAverageScoreOn10(attempts)).toBe(6.17);
  });
});
