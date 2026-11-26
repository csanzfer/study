import { Injectable } from '@angular/core';
import Dexie, { Table } from 'dexie';
import {
  CaseStudy,
  ExamAttempt,
  Flashcard,
  GamificationProfile,
  Question,
  StudyBlock,
  StudyBlockId,
  StudySession,
  SyncMetaEntry,
  SyncOutboxEntry,
  Topic,
  WeeklyPlanItem,
} from '../models/study.models';

@Injectable({ providedIn: 'root' })
export class StudyDatabase extends Dexie {
  blocks!: Table<StudyBlock, StudyBlockId>;
  topics!: Table<Topic, string>;
  studySessions!: Table<StudySession, string>;
  weeklyPlanItems!: Table<WeeklyPlanItem, string>;
  caseStudies!: Table<CaseStudy, string>;
  questions!: Table<Question, string>;
  examAttempts!: Table<ExamAttempt, string>;
  flashcards!: Table<Flashcard, string>;
  gamification!: Table<GamificationProfile, 'local-user'>;
  syncOutbox!: Table<SyncOutboxEntry, string>;
  syncMeta!: Table<SyncMetaEntry, string>;

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

    this.version(4).stores({
      blocks: 'id, order',
      topics: 'id, blockId, order, status, updatedAt, lastReviewedAt, *tags',
      studySessions: 'id, topicId, blockId, startedAt, type',
      weeklyPlanItems: 'id, weekStartDate, [weekStartDate+dayOfWeek], topicId, blockId',
      caseStudies: 'id, blockId, updatedAt, *tags',
      questions: 'id, blockId, topicId, caseStudyId, flagged, updatedAt, *tags',
      examAttempts: 'id, date, mode, caseStudyId',
      flashcards: 'id, blockId, topicId, srs.dueDate, updatedAt, *tags',
      gamification: 'id',
    });

    this.version(5)
      .stores({
        blocks: 'id, order',
        topics: 'id, blockId, order, status, updatedAt, lastReviewedAt, *tags',
        studySessions: 'id, topicId, blockId, startedAt, type',
        weeklyPlanItems: 'id, weekStartDate, [weekStartDate+dayOfWeek], topicId, blockId',
        caseStudies: 'id, blockId, updatedAt, *tags',
        questions: 'id, blockId, topicId, caseStudyId, flagged, updatedAt, *tags',
        examAttempts: 'id, date, mode, caseStudyId',
        flashcards: 'id, blockId, topicId, srs.dueDate, updatedAt, *tags',
        gamification: 'id',
        syncOutbox: 'key, entityType, updatedAt',
        syncMeta: 'key',
      })
      .upgrade(async (tx) => {
        const now = new Date().toISOString();
        await tx
          .table<StudyBlock>('blocks')
          .toCollection()
          .modify((block) => {
            if (!block.updatedAt) {
              block.updatedAt = now;
            }
          });
        await tx
          .table<StudySession>('studySessions')
          .toCollection()
          .modify((session) => {
            if (!session.updatedAt) {
              session.updatedAt = session.endedAt || session.startedAt || now;
            }
          });
        await tx
          .table<WeeklyPlanItem>('weeklyPlanItems')
          .toCollection()
          .modify((item) => {
            if (!item.updatedAt) {
              item.updatedAt = item.completedAt || now;
            }
          });
        await tx
          .table<ExamAttempt>('examAttempts')
          .toCollection()
          .modify((attempt) => {
            if (!attempt.updatedAt) {
              attempt.updatedAt = attempt.date || now;
            }
          });
      });
  }

  async ensureSeeded(): Promise<void> {
    // Instalaciones nuevas arrancan limpias sin sembrar bloques por defecto.
    // Los usuarios existentes conservan intactos los bloques guardados en TaiStudyDB.
    await this.open();
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
