import { TestBed } from '@angular/core/testing';
import { TAI_BLOCKS_SEED } from '../db/tai-seed';
import {
  StudySession,
  TaiBlock,
  TaiBlockId,
  Topic,
  WeeklyPlanItem,
} from '../models/study.models';
import { STUDY_REPOSITORY, StudyRepository } from '../repositories/study.repository';
import { StudyStoreService } from './study-store.service';

class InMemoryStudyRepository implements StudyRepository {
  blocks: TaiBlock[] = [...TAI_BLOCKS_SEED];
  topics: Topic[] = [];
  sessions: StudySession[] = [];
  weeklyPlan: WeeklyPlanItem[] = [];

  async initialize(): Promise<void> {}

  async getBlocks(): Promise<TaiBlock[]> {
    return [...this.blocks].sort((a, b) => a.order - b.order);
  }

  async getTopics(blockId?: TaiBlockId): Promise<Topic[]> {
    const list = blockId ? this.topics.filter((t) => t.blockId === blockId) : [...this.topics];
    return list.sort((a, b) => a.blockId.localeCompare(b.blockId) || a.order - b.order);
  }

  async getTopicById(id: string): Promise<Topic | undefined> {
    return this.topics.find((t) => t.id === id);
  }

  async saveTopic(topic: Topic): Promise<void> {
    const idx = this.topics.findIndex((t) => t.id === topic.id);
    if (idx >= 0) {
      this.topics[idx] = topic;
    } else {
      this.topics.push(topic);
    }
  }

  async saveTopics(topics: Topic[]): Promise<void> {
    for (const topic of topics) {
      await this.saveTopic(topic);
    }
  }

  async deleteTopic(id: string): Promise<void> {
    this.topics = this.topics.filter((t) => t.id !== id);
    this.weeklyPlan = this.weeklyPlan.filter((w) => w.topicId !== id);
  }

  async getStudySessions(): Promise<StudySession[]> {
    return [...this.sessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  async saveStudySession(session: StudySession): Promise<void> {
    const idx = this.sessions.findIndex((s) => s.id === session.id);
    if (idx >= 0) {
      this.sessions[idx] = session;
    } else {
      this.sessions.push(session);
    }
  }

  async deleteStudySession(id: string): Promise<void> {
    this.sessions = this.sessions.filter((s) => s.id !== id);
  }

  async getWeeklyPlanItems(weekStartDate?: string): Promise<WeeklyPlanItem[]> {
    const list = weekStartDate
      ? this.weeklyPlan.filter((w) => w.weekStartDate === weekStartDate)
      : [...this.weeklyPlan];
    return list.sort(
      (a, b) =>
        a.weekStartDate.localeCompare(b.weekStartDate) ||
        a.dayOfWeek - b.dayOfWeek ||
        a.order - b.order,
    );
  }

  async saveWeeklyPlanItem(item: WeeklyPlanItem): Promise<void> {
    const idx = this.weeklyPlan.findIndex((w) => w.id === item.id);
    if (idx >= 0) {
      this.weeklyPlan[idx] = item;
    } else {
      this.weeklyPlan.push(item);
    }
  }

  async saveWeeklyPlanItems(items: WeeklyPlanItem[]): Promise<void> {
    for (const item of items) {
      await this.saveWeeklyPlanItem(item);
    }
  }

  async deleteWeeklyPlanItem(id: string): Promise<void> {
    this.weeklyPlan = this.weeklyPlan.filter((w) => w.id !== id);
  }

  async replaceAllData(
    blocks: TaiBlock[],
    topics: Topic[],
    studySessions: StudySession[] = [],
    weeklyPlanItems: WeeklyPlanItem[] = [],
  ): Promise<void> {
    this.blocks = [...blocks];
    this.topics = [...topics];
    this.sessions = [...studySessions];
    this.weeklyPlan = [...weeklyPlanItems];
  }
}

describe('StudyStoreService', () => {
  let store: StudyStoreService;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        StudyStoreService,
        { provide: STUDY_REPOSITORY, useValue: new InMemoryStudyRepository() },
      ],
    });
    store = TestBed.inject(StudyStoreService);
    await store.initialize();
  });

  it('should update topic title, status, and deduplicated tags', async () => {
    const created = await store.createTopic({
      blockId: 'B1',
      title: 'Tema 1',
      tags: ['leyes'],
    });

    const updated = await store.updateTopic(created.id, {
      title: '  Constitución Española  ',
      status: 'outlined',
      tags: ['leyes', 'plazos', 'leyes', '  '],
    });

    expect(updated?.title).toBe('Constitución Española');
    expect(updated?.status).toBe('outlined');
    expect(updated?.tags).toEqual(['leyes', 'plazos']);
    expect(store.getTopicById(created.id)?.title).toBe('Constitución Española');
  });

  it('should reorder topics within a block and persist order 1..N', async () => {
    const t1 = await store.createTopic({ blockId: 'B2', title: 'CPU' });
    const t2 = await store.createTopic({ blockId: 'B2', title: 'Memoria' });
    const t3 = await store.createTopic({ blockId: 'B2', title: 'Buses' });

    await store.reorderTopics('B2', [t3.id, t1.id, t2.id]);

    const ordered = store.getTopicsForBlock('B2');
    expect(ordered.map((t) => t.title)).toEqual(['Buses', 'CPU', 'Memoria']);
    expect(ordered.map((t) => t.order)).toEqual([1, 2, 3]);
  });

  it('should ignore unknown or duplicate ids when reordering topics without leaving gaps', async () => {
    const t1 = await store.createTopic({ blockId: 'B2', title: 'CPU' });
    const t2 = await store.createTopic({ blockId: 'B2', title: 'Memoria' });
    const t3 = await store.createTopic({ blockId: 'B2', title: 'Buses' });

    await store.reorderTopics('B2', ['unknown-id', t3.id, t3.id, t1.id]);

    const ordered = store.getTopicsForBlock('B2');
    expect(ordered.map((t) => t.id)).toEqual([t3.id, t1.id, t2.id]);
    expect(ordered.map((t) => t.order)).toEqual([1, 2, 3]);
  });

  it('should reindex remaining topics after deletion', async () => {
    const t1 = await store.createTopic({ blockId: 'B3', title: 'POO' });
    const t2 = await store.createTopic({ blockId: 'B3', title: 'SQL' });
    const t3 = await store.createTopic({ blockId: 'B3', title: 'UML' });

    await store.deleteTopic(t2.id);

    const remaining = store.getTopicsForBlock('B3');
    expect(remaining.map((t) => t.id)).toEqual([t1.id, t3.id]);
    expect(remaining.map((t) => t.order)).toEqual([1, 2]);
  });

  it('should automatically increment roundCount and set lastReviewedAt when moving to mastered', async () => {
    const topic = await store.createTopic({ blockId: 'B1', title: 'Ley 39/2015' });
    expect(topic.roundCount).toBe(0);
    expect(topic.lastReviewedAt).toBeUndefined();

    const firstMove = await store.moveTopicStatus(topic.id, 'first_round');
    expect(firstMove?.roundIncremented).toBe(false);
    expect(firstMove?.topic.roundCount).toBe(0);
    expect(firstMove?.topic.lastReviewedAt).toBeDefined();

    const masteredMove = await store.moveTopicStatus(topic.id, 'mastered');
    expect(masteredMove?.roundIncremented).toBe(true);
    expect(masteredMove?.topic.roundCount).toBe(1);
    expect(store.totalRoundsCompleted()).toBe(1);

    // Moving to mastered again is a no-op
    const sameMove = await store.moveTopicStatus(topic.id, 'mastered');
    expect(sameMove?.roundIncremented).toBe(false);
    expect(sameMove?.topic.roundCount).toBe(1);
  });

  it('should log extra reviews and study sessions, updating weekly study minutes', async () => {
    const topic = await store.createTopic({ blockId: 'B4', title: 'TCP/IP' });

    const reviewed = await store.logTopicReview(topic.id, true);
    expect(reviewed?.roundCount).toBe(1);
    expect(reviewed?.status).toBe('first_round');
    expect(reviewed?.lastReviewedAt).toBeDefined();

    const session = await store.addStudySession({
      topicId: topic.id,
      blockId: 'B4',
      durationMinutes: 25,
      type: 'reading',
    });

    expect(store.studySessions().length).toBe(1);
    expect(store.studyMinutesThisWeek()).toBe(25);
    expect(store.studyMinutesByBlockThisWeek().B4).toBe(25);

    await store.deleteStudySession(session.id);
    expect(store.studySessions().length).toBe(0);
    expect(store.studyMinutesThisWeek()).toBe(0);
  });

  it('should manage weekly plan items and clean them up when a topic is deleted', async () => {
    const topic = await store.createTopic({ blockId: 'B2', title: 'Sistemas Operativos' });
    const item = await store.addWeeklyPlanItem({
      weekStartDate: '2026-11-23',
      dayOfWeek: 1,
      topicId: topic.id,
      blockId: 'B2',
      targetPomodoros: 2,
    });

    expect(store.getWeeklyPlanForWeek('2026-11-23').length).toBe(1);

    const toggled = await store.toggleWeeklyPlanItem(item.id);
    expect(toggled?.completed).toBe(true);
    expect(store.getTopicById(topic.id)?.lastReviewedAt).toBeDefined();

    await store.moveWeeklyPlanItem(item.id, 3, [item.id]);
    expect(store.getWeeklyPlanForWeek('2026-11-23')[0].dayOfWeek).toBe(3);

    await store.deleteTopic(topic.id);
    expect(store.getWeeklyPlanForWeek('2026-11-23').length).toBe(0);
  });
});
