import { describe, expect, it } from 'vitest';
import { Flashcard, Question, StudyBlock, Topic } from '../../../core/models/study.models';
import {
  computeCampaignOverview,
  computeTopicCampaignProgress,
} from './campaign-progress.util';

const TEST_BLOCKS: StudyBlock[] = [
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
    icon: 'science',
    order: 2,
  },
];

describe('campaign-progress.util', () => {
  const baseTopic: Topic = {
    id: 't-1',
    blockId: 'block-1',
    order: 1,
    title: 'Constitución Española',
    status: 'pending',
    roundCount: 0,
    tags: ['leyes'],
    contentJson: { type: 'doc', content: [] },
    plainText: '',
    createdAt: '2026-11-20T10:00:00.000Z',
    updatedAt: '2026-11-20T10:00:00.000Z',
  };

  it('returns 0 score and level 1 for an empty pending topic', () => {
    const progress = computeTopicCampaignProgress(baseTopic, [], []);
    expect(progress.score).toBe(0);
    expect(progress.level).toBe(1);
    expect(progress.nextAction.label).toContain('esquema');
  });

  it('reaches 100 score and level 5 when all 4 pillars are fulfilled', () => {
    const masteredTopic: Topic = {
      ...baseTopic,
      status: 'mastered',
      roundCount: 2,
      customOutlineMd: '# CE\n## Título I\n- Derechos',
    };
    const masteredCard: Flashcard = {
      id: 'fc-1',
      blockId: 'B1',
      topicId: 't-1',
      front: 'Año CE',
      back: '1978',
      tags: ['leyes'],
      srs: {
        intervalDays: 30,
        easeFactor: 2.6,
        repetitions: 4,
        lapses: 0,
        dueDate: '2026-12-23',
      },
      createdAt: '2026-11-01T10:00:00.000Z',
      updatedAt: '2026-11-23T10:00:00.000Z',
    };
    const passedQuestion: Question = {
      id: 'q-1',
      blockId: 'B1',
      topicId: 't-1',
      prompt: 'Año CE',
      options: ['1975', '1978', '1980', '1982'],
      correctIndex: 1,
      tags: [],
      flagged: false,
      stats: { attempts: 4, correct: 4, lastResult: 'correct' },
      createdAt: '2026-11-01T10:00:00.000Z',
      updatedAt: '2026-11-23T10:00:00.000Z',
    };

    const progress = computeTopicCampaignProgress(
      masteredTopic,
      [masteredCard],
      [passedQuestion],
    );
    expect(progress.score).toBe(100);
    expect(progress.level).toBe(5);
    expect(progress.pillars.rounds.completed).toBe(true);
    expect(progress.pillars.schema.completed).toBe(true);
    expect(progress.pillars.flashcards.completed).toBe(true);
    expect(progress.pillars.tests.completed).toBe(true);
  });

  it('aggregates block scores into CampaignOverview', () => {
    const overview = computeCampaignOverview(TEST_BLOCKS, [baseTopic], [], []);
    expect(overview.blocks.length).toBe(2);
    expect(overview.blocks[0].topicCount).toBe(1);
    expect(overview.blocks[1].topicCount).toBe(0);
    expect(overview.overallScore).toBe(0);
  });
});
