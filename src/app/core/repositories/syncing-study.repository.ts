import { Injectable, inject } from '@angular/core';
import { StudyDatabase } from '../db/study.db';
import {
  CaseStudy,
  ExamAttempt,
  Flashcard,
  GamificationProfile,
  Question,
  StudyBlock,
  StudyBlockId,
  StudySession,
  SyncEntityType,
  SyncOperation,
  SyncOutboxEntry,
  Topic,
  WeeklyPlanItem,
} from '../models/study.models';
import { SupabaseAuthService } from '../services/supabase-auth.service';
import { IndexedDbStudyRepository, StudyRepository } from './study.repository';

/**
 * Decorador Local-First sobre IndexedDbStudyRepository.
 *
 * - Todas las lecturas y escrituras se ejecutan siempre contra IndexedDB de forma inmediata.
 * - Cuando hay sesión activa de Supabase, registra cada mutación en `db.syncOutbox`
 *   y notifica al motor de sincronización para disparar un push con debounce.
 * - Cuando no hay sesión activa, no acumula entradas en `syncOutbox` (cero sobrecarga).
 */
@Injectable({ providedIn: 'root' })
export class SyncingStudyRepository implements StudyRepository {
  private readonly local = inject(IndexedDbStudyRepository);
  private readonly db = inject(StudyDatabase);
  private readonly auth = inject(SupabaseAuthService);

  private changeListeners: Array<() => void> = [];

  onLocalMutation(listener: () => void): () => void {
    this.changeListeners.push(listener);
    return () => {
      this.changeListeners = this.changeListeners.filter((item) => item !== listener);
    };
  }

  async initialize(): Promise<void> {
    await this.local.initialize();
  }

  async getBlocks(): Promise<StudyBlock[]> {
    return this.local.getBlocks();
  }

  async saveBlock(block: StudyBlock): Promise<void> {
    const stamped: StudyBlock = { ...block, updatedAt: new Date().toISOString() };
    await this.local.saveBlock(stamped);
    await this.enqueue([{ entityType: 'blocks', entityId: stamped.id, operation: 'upsert' }]);
  }

  async saveBlocks(blocks: StudyBlock[]): Promise<void> {
    if (blocks.length === 0) {
      return;
    }
    const now = new Date().toISOString();
    const stamped = blocks.map((block) => ({ ...block, updatedAt: now }));
    await this.local.saveBlocks(stamped);
    await this.enqueue(
      stamped.map((block) => ({
        entityType: 'blocks' as const,
        entityId: block.id,
        operation: 'upsert' as const,
      })),
    );
  }

  async deleteBlock(id: StudyBlockId): Promise<void> {
    const tracking = this.shouldTrackChanges();
    const cascadeDeletes: Array<{
      entityType: SyncEntityType;
      entityId: string;
      operation: SyncOperation;
    }> = [];

    if (tracking) {
      const [topics, weeklyPlanItems, studySessions, caseStudies, questions, flashcards] =
        await Promise.all([
          this.db.topics.where('blockId').equals(id).primaryKeys(),
          this.db.weeklyPlanItems.where('blockId').equals(id).primaryKeys(),
          this.db.studySessions.where('blockId').equals(id).primaryKeys(),
          this.db.caseStudies.where('blockId').equals(id).primaryKeys(),
          this.db.questions.where('blockId').equals(id).primaryKeys(),
          this.db.flashcards.where('blockId').equals(id).primaryKeys(),
        ]);

      cascadeDeletes.push({ entityType: 'blocks', entityId: id, operation: 'delete' });
      for (const topicId of topics) {
        cascadeDeletes.push({ entityType: 'topics', entityId: String(topicId), operation: 'delete' });
      }
      for (const itemId of weeklyPlanItems) {
        cascadeDeletes.push({
          entityType: 'weeklyPlanItems',
          entityId: String(itemId),
          operation: 'delete',
        });
      }
      for (const sessionId of studySessions) {
        cascadeDeletes.push({
          entityType: 'studySessions',
          entityId: String(sessionId),
          operation: 'delete',
        });
      }
      for (const csId of caseStudies) {
        cascadeDeletes.push({
          entityType: 'caseStudies',
          entityId: String(csId),
          operation: 'delete',
        });
      }
      for (const qId of questions) {
        cascadeDeletes.push({
          entityType: 'questions',
          entityId: String(qId),
          operation: 'delete',
        });
      }
      for (const fcId of flashcards) {
        cascadeDeletes.push({
          entityType: 'flashcards',
          entityId: String(fcId),
          operation: 'delete',
        });
      }
    }

    await this.local.deleteBlock(id);
    if (cascadeDeletes.length > 0) {
      await this.enqueue(cascadeDeletes);
    }
  }

  async getTopics(blockId?: StudyBlockId): Promise<Topic[]> {
    return this.local.getTopics(blockId);
  }

  async getTopicById(id: string): Promise<Topic | undefined> {
    return this.local.getTopicById(id);
  }

  async saveTopic(topic: Topic): Promise<void> {
    await this.local.saveTopic(topic);
    await this.enqueue([{ entityType: 'topics', entityId: topic.id, operation: 'upsert' }]);
  }

  async saveTopics(topics: Topic[]): Promise<void> {
    if (topics.length === 0) {
      return;
    }
    await this.local.saveTopics(topics);
    await this.enqueue(
      topics.map((topic) => ({
        entityType: 'topics' as const,
        entityId: topic.id,
        operation: 'upsert' as const,
      })),
    );
  }

  async deleteTopic(id: string): Promise<void> {
    const tracking = this.shouldTrackChanges();
    const changes: Array<{
      entityType: SyncEntityType;
      entityId: string;
      operation: SyncOperation;
    }> = [];

    if (tracking) {
      const [weeklyPlanItems, linkedQuestions, linkedFlashcards] = await Promise.all([
        this.db.weeklyPlanItems.where('topicId').equals(id).primaryKeys(),
        this.db.questions.where('topicId').equals(id).primaryKeys(),
        this.db.flashcards.where('topicId').equals(id).primaryKeys(),
      ]);

      changes.push({ entityType: 'topics', entityId: id, operation: 'delete' });
      for (const itemId of weeklyPlanItems) {
        changes.push({
          entityType: 'weeklyPlanItems',
          entityId: String(itemId),
          operation: 'delete',
        });
      }
      for (const qId of linkedQuestions) {
        changes.push({ entityType: 'questions', entityId: String(qId), operation: 'upsert' });
      }
      for (const fcId of linkedFlashcards) {
        changes.push({ entityType: 'flashcards', entityId: String(fcId), operation: 'upsert' });
      }
    }

    await this.local.deleteTopic(id);
    if (changes.length > 0) {
      await this.enqueue(changes);
    }
  }

  async getStudySessions(): Promise<StudySession[]> {
    return this.local.getStudySessions();
  }

  async saveStudySession(session: StudySession): Promise<void> {
    const stamped: StudySession = {
      ...session,
      updatedAt: session.updatedAt ?? new Date().toISOString(),
    };
    await this.local.saveStudySession(stamped);
    await this.enqueue([{ entityType: 'studySessions', entityId: stamped.id, operation: 'upsert' }]);
  }

  async deleteStudySession(id: string): Promise<void> {
    await this.local.deleteStudySession(id);
    await this.enqueue([{ entityType: 'studySessions', entityId: id, operation: 'delete' }]);
  }

  async getWeeklyPlanItems(weekStartDate?: string): Promise<WeeklyPlanItem[]> {
    return this.local.getWeeklyPlanItems(weekStartDate);
  }

  async saveWeeklyPlanItem(item: WeeklyPlanItem): Promise<void> {
    const stamped: WeeklyPlanItem = { ...item, updatedAt: new Date().toISOString() };
    await this.local.saveWeeklyPlanItem(stamped);
    await this.enqueue([
      { entityType: 'weeklyPlanItems', entityId: stamped.id, operation: 'upsert' },
    ]);
  }

  async saveWeeklyPlanItems(items: WeeklyPlanItem[]): Promise<void> {
    if (items.length === 0) {
      return;
    }
    const now = new Date().toISOString();
    const stamped = items.map((item) => ({ ...item, updatedAt: now }));
    await this.local.saveWeeklyPlanItems(stamped);
    await this.enqueue(
      stamped.map((item) => ({
        entityType: 'weeklyPlanItems' as const,
        entityId: item.id,
        operation: 'upsert' as const,
      })),
    );
  }

  async deleteWeeklyPlanItem(id: string): Promise<void> {
    await this.local.deleteWeeklyPlanItem(id);
    await this.enqueue([{ entityType: 'weeklyPlanItems', entityId: id, operation: 'delete' }]);
  }

  async getCaseStudies(): Promise<CaseStudy[]> {
    return this.local.getCaseStudies();
  }

  async saveCaseStudy(caseStudy: CaseStudy): Promise<void> {
    await this.local.saveCaseStudy(caseStudy);
    await this.enqueue([{ entityType: 'caseStudies', entityId: caseStudy.id, operation: 'upsert' }]);
  }

  async deleteCaseStudy(id: string): Promise<void> {
    const tracking = this.shouldTrackChanges();
    const changes: Array<{
      entityType: SyncEntityType;
      entityId: string;
      operation: SyncOperation;
    }> = [];

    if (tracking) {
      const linkedQuestions = await this.db.questions
        .where('caseStudyId')
        .equals(id)
        .primaryKeys();
      changes.push({ entityType: 'caseStudies', entityId: id, operation: 'delete' });
      for (const qId of linkedQuestions) {
        changes.push({ entityType: 'questions', entityId: String(qId), operation: 'upsert' });
      }
    }

    await this.local.deleteCaseStudy(id);
    if (changes.length > 0) {
      await this.enqueue(changes);
    }
  }

  async getQuestions(): Promise<Question[]> {
    return this.local.getQuestions();
  }

  async saveQuestion(question: Question): Promise<void> {
    await this.local.saveQuestion(question);
    await this.enqueue([{ entityType: 'questions', entityId: question.id, operation: 'upsert' }]);
  }

  async saveQuestions(questions: Question[]): Promise<void> {
    if (questions.length === 0) {
      return;
    }
    await this.local.saveQuestions(questions);
    await this.enqueue(
      questions.map((question) => ({
        entityType: 'questions' as const,
        entityId: question.id,
        operation: 'upsert' as const,
      })),
    );
  }

  async deleteQuestion(id: string): Promise<void> {
    await this.local.deleteQuestion(id);
    await this.enqueue([{ entityType: 'questions', entityId: id, operation: 'delete' }]);
  }

  async getExamAttempts(): Promise<ExamAttempt[]> {
    return this.local.getExamAttempts();
  }

  async saveExamAttempt(attempt: ExamAttempt): Promise<void> {
    const stamped: ExamAttempt = {
      ...attempt,
      updatedAt: attempt.updatedAt ?? new Date().toISOString(),
    };
    await this.local.saveExamAttempt(stamped);
    await this.enqueue([{ entityType: 'examAttempts', entityId: stamped.id, operation: 'upsert' }]);
  }

  async deleteExamAttempt(id: string): Promise<void> {
    await this.local.deleteExamAttempt(id);
    await this.enqueue([{ entityType: 'examAttempts', entityId: id, operation: 'delete' }]);
  }

  async getFlashcards(): Promise<Flashcard[]> {
    return this.local.getFlashcards();
  }

  async saveFlashcard(flashcard: Flashcard): Promise<void> {
    await this.local.saveFlashcard(flashcard);
    await this.enqueue([{ entityType: 'flashcards', entityId: flashcard.id, operation: 'upsert' }]);
  }

  async saveFlashcards(flashcards: Flashcard[]): Promise<void> {
    if (flashcards.length === 0) {
      return;
    }
    await this.local.saveFlashcards(flashcards);
    await this.enqueue(
      flashcards.map((flashcard) => ({
        entityType: 'flashcards' as const,
        entityId: flashcard.id,
        operation: 'upsert' as const,
      })),
    );
  }

  async deleteFlashcard(id: string): Promise<void> {
    await this.local.deleteFlashcard(id);
    await this.enqueue([{ entityType: 'flashcards', entityId: id, operation: 'delete' }]);
  }

  async getGamificationProfile(): Promise<GamificationProfile | undefined> {
    return this.local.getGamificationProfile();
  }

  async saveGamificationProfile(profile: GamificationProfile): Promise<void> {
    await this.local.saveGamificationProfile(profile);
    await this.enqueue([
      { entityType: 'gamification', entityId: 'local-user', operation: 'upsert' },
    ]);
  }

  async replaceAllData(
    blocks: StudyBlock[],
    topics: Topic[],
    studySessions: StudySession[] = [],
    weeklyPlanItems: WeeklyPlanItem[] = [],
    caseStudies: CaseStudy[] = [],
    questions: Question[] = [],
    examAttempts: ExamAttempt[] = [],
    flashcards: Flashcard[] = [],
    gamificationProfile?: GamificationProfile,
  ): Promise<void> {
    const tracking = this.shouldTrackChanges();
    const now = new Date().toISOString();

    let prevIds: Record<Exclude<SyncEntityType, 'gamification'>, string[]> | null = null;
    if (tracking) {
      const [b, t, s, w, cs, q, ea, fc] = await Promise.all([
        this.db.blocks.toCollection().primaryKeys(),
        this.db.topics.toCollection().primaryKeys(),
        this.db.studySessions.toCollection().primaryKeys(),
        this.db.weeklyPlanItems.toCollection().primaryKeys(),
        this.db.caseStudies.toCollection().primaryKeys(),
        this.db.questions.toCollection().primaryKeys(),
        this.db.examAttempts.toCollection().primaryKeys(),
        this.db.flashcards.toCollection().primaryKeys(),
      ]);
      prevIds = {
        blocks: b.map(String),
        topics: t.map(String),
        studySessions: s.map(String),
        weeklyPlanItems: w.map(String),
        caseStudies: cs.map(String),
        questions: q.map(String),
        examAttempts: ea.map(String),
        flashcards: fc.map(String),
      };
    }

    const stampedBlocks = blocks.map((b) => ({ ...b, updatedAt: b.updatedAt ?? now }));
    const stampedSessions = studySessions.map((s) => ({ ...s, updatedAt: s.updatedAt ?? now }));
    const stampedPlan = weeklyPlanItems.map((w) => ({ ...w, updatedAt: w.updatedAt ?? now }));
    const stampedAttempts = examAttempts.map((a) => ({ ...a, updatedAt: a.updatedAt ?? now }));

    await this.local.replaceAllData(
      stampedBlocks,
      topics,
      stampedSessions,
      stampedPlan,
      caseStudies,
      questions,
      stampedAttempts,
      flashcards,
      gamificationProfile,
    );

    if (tracking && prevIds) {
      const changes: Array<{
        entityType: SyncEntityType;
        entityId: string;
        operation: SyncOperation;
      }> = [];

      const diffEntity = (
        entityType: Exclude<SyncEntityType, 'gamification'>,
        nextIds: string[],
      ) => {
        const nextSet = new Set(nextIds);
        for (const oldId of prevIds![entityType]) {
          if (!nextSet.has(oldId)) {
            changes.push({ entityType, entityId: oldId, operation: 'delete' });
          }
        }
        for (const newId of nextIds) {
          changes.push({ entityType, entityId: newId, operation: 'upsert' });
        }
      };

      diffEntity('blocks', stampedBlocks.map((x) => x.id));
      diffEntity('topics', topics.map((x) => x.id));
      diffEntity('studySessions', stampedSessions.map((x) => x.id));
      diffEntity('weeklyPlanItems', stampedPlan.map((x) => x.id));
      diffEntity('caseStudies', caseStudies.map((x) => x.id));
      diffEntity('questions', questions.map((x) => x.id));
      diffEntity('examAttempts', stampedAttempts.map((x) => x.id));
      diffEntity('flashcards', flashcards.map((x) => x.id));
      if (gamificationProfile) {
        changes.push({ entityType: 'gamification', entityId: 'local-user', operation: 'upsert' });
      }

      await this.enqueue(changes);
    }
  }

  private shouldTrackChanges(): boolean {
    return this.auth.isAuthenticated();
  }

  private async enqueue(
    items: Array<{ entityType: SyncEntityType; entityId: string; operation: SyncOperation }>,
  ): Promise<void> {
    if (!this.shouldTrackChanges() || items.length === 0) {
      return;
    }

    const now = new Date().toISOString();
    const entries: SyncOutboxEntry[] = items.map((item) => ({
      key: `${item.entityType}:${item.entityId}`,
      entityType: item.entityType,
      entityId: item.entityId,
      operation: item.operation,
      updatedAt: now,
    }));

    await this.db.syncOutbox.bulkPut(entries);
    for (const listener of this.changeListeners) {
      listener();
    }
  }
}
