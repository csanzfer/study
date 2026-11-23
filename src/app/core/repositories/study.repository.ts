import { InjectionToken, Injectable, inject } from '@angular/core';
import { StudyDatabase } from '../db/study.db';
import {
  StudySession,
  TaiBlock,
  TaiBlockId,
  Topic,
  WeeklyPlanItem,
} from '../models/study.models';

export interface StudyRepository {
  initialize(): Promise<void>;
  getBlocks(): Promise<TaiBlock[]>;
  getTopics(blockId?: TaiBlockId): Promise<Topic[]>;
  getTopicById(id: string): Promise<Topic | undefined>;
  saveTopic(topic: Topic): Promise<void>;
  saveTopics(topics: Topic[]): Promise<void>;
  deleteTopic(id: string): Promise<void>;
  getStudySessions(): Promise<StudySession[]>;
  saveStudySession(session: StudySession): Promise<void>;
  deleteStudySession(id: string): Promise<void>;
  getWeeklyPlanItems(weekStartDate?: string): Promise<WeeklyPlanItem[]>;
  saveWeeklyPlanItem(item: WeeklyPlanItem): Promise<void>;
  saveWeeklyPlanItems(items: WeeklyPlanItem[]): Promise<void>;
  deleteWeeklyPlanItem(id: string): Promise<void>;
  replaceAllData(
    blocks: TaiBlock[],
    topics: Topic[],
    studySessions?: StudySession[],
    weeklyPlanItems?: WeeklyPlanItem[],
  ): Promise<void>;
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
    await this.db.transaction('rw', this.db.topics, this.db.weeklyPlanItems, async () => {
      await this.db.topics.delete(id);
      await this.db.weeklyPlanItems.where('topicId').equals(id).delete();
    });
  }

  async getStudySessions(): Promise<StudySession[]> {
    const sessions = await this.db.studySessions.toArray();
    return sessions.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  async saveStudySession(session: StudySession): Promise<void> {
    await this.db.studySessions.put(session);
  }

  async deleteStudySession(id: string): Promise<void> {
    await this.db.studySessions.delete(id);
  }

  async getWeeklyPlanItems(weekStartDate?: string): Promise<WeeklyPlanItem[]> {
    const items = weekStartDate
      ? await this.db.weeklyPlanItems.where('weekStartDate').equals(weekStartDate).toArray()
      : await this.db.weeklyPlanItems.toArray();

    return items.sort(
      (a, b) =>
        a.weekStartDate.localeCompare(b.weekStartDate) ||
        a.dayOfWeek - b.dayOfWeek ||
        a.order - b.order,
    );
  }

  async saveWeeklyPlanItem(item: WeeklyPlanItem): Promise<void> {
    await this.db.weeklyPlanItems.put(item);
  }

  async saveWeeklyPlanItems(items: WeeklyPlanItem[]): Promise<void> {
    if (items.length === 0) {
      return;
    }
    await this.db.transaction('rw', this.db.weeklyPlanItems, async () => {
      await this.db.weeklyPlanItems.bulkPut(items);
    });
  }

  async deleteWeeklyPlanItem(id: string): Promise<void> {
    await this.db.weeklyPlanItems.delete(id);
  }

  async replaceAllData(
    blocks: TaiBlock[],
    topics: Topic[],
    studySessions: StudySession[] = [],
    weeklyPlanItems: WeeklyPlanItem[] = [],
  ): Promise<void> {
    await this.db.transaction(
      'rw',
      this.db.blocks,
      this.db.topics,
      this.db.studySessions,
      this.db.weeklyPlanItems,
      async () => {
        await this.db.blocks.clear();
        await this.db.topics.clear();
        await this.db.studySessions.clear();
        await this.db.weeklyPlanItems.clear();
        if (blocks.length > 0) {
          await this.db.blocks.bulkPut(blocks);
        }
        if (topics.length > 0) {
          await this.db.topics.bulkPut(topics);
        }
        if (studySessions.length > 0) {
          await this.db.studySessions.bulkPut(studySessions);
        }
        if (weeklyPlanItems.length > 0) {
          await this.db.weeklyPlanItems.bulkPut(weeklyPlanItems);
        }
      },
    );
  }
}
