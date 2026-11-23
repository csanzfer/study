import { Injectable } from '@angular/core';
import Dexie, { Table } from 'dexie';
import {
  CaseStudy,
  ExamAttempt,
  Question,
  StudySession,
  TaiBlock,
  TaiBlockId,
  Topic,
  WeeklyPlanItem,
} from '../models/study.models';
import { TAI_BLOCKS_SEED } from './tai-seed';

@Injectable({ providedIn: 'root' })
export class StudyDatabase extends Dexie {
  blocks!: Table<TaiBlock, TaiBlockId>;
  topics!: Table<Topic, string>;
  studySessions!: Table<StudySession, string>;
  weeklyPlanItems!: Table<WeeklyPlanItem, string>;
  caseStudies!: Table<CaseStudy, string>;
  questions!: Table<Question, string>;
  examAttempts!: Table<ExamAttempt, string>;

  constructor() {
    super('TaiStudyDB');

    this.version(1).stores({
      blocks: 'id, order',
      topics: 'id, blockId, order, status, updatedAt, *tags',
    });

    this.version(2).stores({
      blocks: 'id, order',
      topics: 'id, blockId, order, status, updatedAt, lastReviewedAt, *tags',
      studySessions: 'id, topicId, blockId, startedAt, type',
      weeklyPlanItems: 'id, weekStartDate, [weekStartDate+dayOfWeek], topicId, blockId',
    });

    this.version(3).stores({
      blocks: 'id, order',
      topics: 'id, blockId, order, status, updatedAt, lastReviewedAt, *tags',
      studySessions: 'id, topicId, blockId, startedAt, type',
      weeklyPlanItems: 'id, weekStartDate, [weekStartDate+dayOfWeek], topicId, blockId',
      caseStudies: 'id, blockId, updatedAt, *tags',
      questions: 'id, blockId, topicId, caseStudyId, flagged, updatedAt, *tags',
      examAttempts: 'id, date, mode, caseStudyId',
    });
  }

  async ensureSeeded(): Promise<void> {
    const existingCount = await this.blocks.count();
    if (existingCount === 0) {
      await this.blocks.bulkPut(TAI_BLOCKS_SEED);
    }
  }

  async requestPersistentStorage(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !navigator.storage?.persist) {
      return false;
    }

    try {
      const alreadyPersisted = await navigator.storage.persisted();
      if (alreadyPersisted) {
        return true;
      }
      return await navigator.storage.persist();
    } catch {
      return false;
    }
  }
}
