import { TestBed } from '@angular/core/testing';
import { TAI_BLOCKS_SEED } from '../db/tai-seed';
import { TaiBlock, TaiBlockId, Topic } from '../models/study.models';
import { STUDY_REPOSITORY, StudyRepository } from '../repositories/study.repository';
import { StudyStoreService } from './study-store.service';

class InMemoryStudyRepository implements StudyRepository {
  blocks: TaiBlock[] = [...TAI_BLOCKS_SEED];
  topics: Topic[] = [];

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
  }

  async replaceAllData(blocks: TaiBlock[], topics: Topic[]): Promise<void> {
    this.blocks = [...blocks];
    this.topics = [...topics];
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

  it('should reindex remaining topics after deletion', async () => {
    const t1 = await store.createTopic({ blockId: 'B3', title: 'POO' });
    const t2 = await store.createTopic({ blockId: 'B3', title: 'SQL' });
    const t3 = await store.createTopic({ blockId: 'B3', title: 'UML' });

    await store.deleteTopic(t2.id);

    const remaining = store.getTopicsForBlock('B3');
    expect(remaining.map((t) => t.id)).toEqual([t1.id, t3.id]);
    expect(remaining.map((t) => t.order)).toEqual([1, 2]);
  });
});
