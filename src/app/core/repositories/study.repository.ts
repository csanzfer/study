import { InjectionToken, Injectable, inject } from '@angular/core';
import { StudyDatabase } from '../db/study.db';
import { TaiBlock, TaiBlockId, Topic } from '../models/study.models';

export interface StudyRepository {
  initialize(): Promise<void>;
  getBlocks(): Promise<TaiBlock[]>;
  getTopics(blockId?: TaiBlockId): Promise<Topic[]>;
  getTopicById(id: string): Promise<Topic | undefined>;
  saveTopic(topic: Topic): Promise<void>;
  saveTopics(topics: Topic[]): Promise<void>;
  deleteTopic(id: string): Promise<void>;
  replaceAllData(blocks: TaiBlock[], topics: Topic[]): Promise<void>;
}

export const STUDY_REPOSITORY = new InjectionToken<StudyRepository>('STUDY_REPOSITORY');

@Injectable({ providedIn: 'root' })
export class IndexedDbStudyRepository implements StudyRepository {
  private readonly db = inject(StudyDatabase);

  async initialize(): Promise<void> {
    await this.db.ensureSeeded();
    void this.db.requestPersistentStorage();
  }

  async getBlocks(): Promise<TaiBlock[]> {
    return this.db.blocks.orderBy('order').toArray();
  }

  async getTopics(blockId?: TaiBlockId): Promise<Topic[]> {
    if (blockId) {
      const topics = await this.db.topics.where('blockId').equals(blockId).toArray();
      return topics.sort((a, b) => a.order - b.order);
    }

    const all = await this.db.topics.toArray();
    return all.sort((a, b) => a.blockId.localeCompare(b.blockId) || a.order - b.order);
  }

  async getTopicById(id: string): Promise<Topic | undefined> {
    return this.db.topics.get(id);
  }

  async saveTopic(topic: Topic): Promise<void> {
    await this.db.topics.put(topic);
  }

  async saveTopics(topics: Topic[]): Promise<void> {
    if (topics.length === 0) {
      return;
    }
    await this.db.transaction('rw', this.db.topics, async () => {
      await this.db.topics.bulkPut(topics);
    });
  }

  async deleteTopic(id: string): Promise<void> {
    await this.db.topics.delete(id);
  }

  async replaceAllData(blocks: TaiBlock[], topics: Topic[]): Promise<void> {
    await this.db.transaction('rw', this.db.blocks, this.db.topics, async () => {
      await this.db.blocks.clear();
      await this.db.topics.clear();
      if (blocks.length > 0) {
        await this.db.blocks.bulkPut(blocks);
      }
      if (topics.length > 0) {
        await this.db.topics.bulkPut(topics);
      }
    });
  }
}
