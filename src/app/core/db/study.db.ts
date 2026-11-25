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
