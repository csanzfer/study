import { Topic } from '../../core/models/study.models';
import { compareTopicsByUrgency, getTopicHealth } from './topic-health.util';

function makeTopic(overrides: Partial<Topic> = {}): Topic {
  return {
    id: 't-1',
    blockId: 'B1',
    order: 1,
    title: 'Tema de prueba',
    status: 'first_round',
    roundCount: 0,
    tags: [],
    contentJson: { type: 'doc', content: [] },
    plainText: '',
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z',
    ...overrides,
  };
}

describe('topic-health.util', () => {
  const now = new Date('2026-11-23T12:00:00.000Z');

  it('classifies pending topics without lastReviewedAt as unstarted', () => {
    const health = getTopicHealth(makeTopic({ status: 'pending', lastReviewedAt: undefined }), now);
    expect(health.level).toBe('unstarted');
    expect(health.needsReview).toBe(false);
  });

  it('classifies started topics without lastReviewedAt as critical', () => {
    const health = getTopicHealth(
      makeTopic({ status: 'memorizing', lastReviewedAt: undefined }),
      now,
    );
    expect(health.level).toBe('critical');
    expect(health.needsReview).toBe(true);
  });

  it('classifies fresh (0-7d), attention (8-15d), rusty (16-30d) and critical (>30d)', () => {
    expect(
      getTopicHealth(makeTopic({ lastReviewedAt: '2026-11-23T08:00:00.000Z' }), now).level,
    ).toBe('fresh');
    expect(
      getTopicHealth(makeTopic({ lastReviewedAt: '2026-11-16T08:00:00.000Z' }), now).level,
    ).toBe('fresh');
    expect(
      getTopicHealth(makeTopic({ lastReviewedAt: '2026-11-15T08:00:00.000Z' }), now).level,
    ).toBe('attention');
    expect(
      getTopicHealth(makeTopic({ lastReviewedAt: '2026-11-07T08:00:00.000Z' }), now).level,
    ).toBe('rusty');
    expect(
      getTopicHealth(makeTopic({ lastReviewedAt: '2026-10-15T08:00:00.000Z' }), now).level,
    ).toBe('critical');
  });

  it('sorts topics by urgency (critical > rusty > attention > fresh > unstarted)', () => {
    const fresh = makeTopic({ id: 'fresh', lastReviewedAt: '2026-11-22T08:00:00.000Z' });
    const rusty = makeTopic({ id: 'rusty', lastReviewedAt: '2026-11-01T08:00:00.000Z' });
    const critical = makeTopic({ id: 'critical', lastReviewedAt: '2026-10-01T08:00:00.000Z' });

    const sorted = [fresh, rusty, critical].sort((a, b) => compareTopicsByUrgency(a, b, now));
    expect(sorted.map((t) => t.id)).toEqual(['critical', 'rusty', 'fresh']);
  });
});
