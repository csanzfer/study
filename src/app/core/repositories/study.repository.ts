import { InjectionToken, Injectable, inject } from '@angular/core';
import { StudyDatabase } from '../db/study.db';
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
  getCaseStudies(): Promise<CaseStudy[]>;
  saveCaseStudy(caseStudy: CaseStudy): Promise<void>;
  deleteCaseStudy(id: string): Promise<void>;
  getQuestions(): Promise<Question[]>;
  saveQuestion(question: Question): Promise<void>;
  saveQuestions(questions: Question[]): Promise<void>;
  deleteQuestion(id: string): Promise<void>;
  getExamAttempts(): Promise<ExamAttempt[]>;
  saveExamAttempt(attempt: ExamAttempt): Promise<void>;
  deleteExamAttempt(id: string): Promise<void>;
  replaceAllData(
    blocks: TaiBlock[],
    topics: Topic[],
    studySessions?: StudySession[],
    weeklyPlanItems?: WeeklyPlanItem[],
    caseStudies?: CaseStudy[],
    questions?: Question[],
    examAttempts?: ExamAttempt[],
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
    await this.db.transaction(
      'rw',
      this.db.topics,
      this.db.weeklyPlanItems,
      this.db.questions,
      async () => {
        await this.db.topics.delete(id);
        await this.db.weeklyPlanItems.where('topicId').equals(id).delete();
        const linkedQuestions = await this.db.questions.where('topicId').equals(id).toArray();
        if (linkedQuestions.length > 0) {
          await this.db.questions.bulkPut(
            linkedQuestions.map((q) => ({ ...q, topicId: undefined })),
          );
        }
      },
    );
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

  async getCaseStudies(): Promise<CaseStudy[]> {
    const items = await this.db.caseStudies.toArray();
    return items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async saveCaseStudy(caseStudy: CaseStudy): Promise<void> {
    await this.db.caseStudies.put(caseStudy);
  }

  async deleteCaseStudy(id: string): Promise<void> {
    await this.db.transaction('rw', this.db.caseStudies, this.db.questions, async () => {
      await this.db.caseStudies.delete(id);
      const linkedQuestions = await this.db.questions.where('caseStudyId').equals(id).toArray();
      if (linkedQuestions.length > 0) {
        await this.db.questions.bulkPut(
          linkedQuestions.map((q) => ({ ...q, caseStudyId: undefined })),
        );
      }
    });
  }

  async getQuestions(): Promise<Question[]> {
    const items = await this.db.questions.toArray();
    return items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async saveQuestion(question: Question): Promise<void> {
    await this.db.questions.put(question);
  }

  async saveQuestions(questions: Question[]): Promise<void> {
    if (questions.length === 0) {
      return;
    }
    await this.db.transaction('rw', this.db.questions, async () => {
      await this.db.questions.bulkPut(questions);
    });
  }

  async deleteQuestion(id: string): Promise<void> {
    await this.db.questions.delete(id);
  }

  async getExamAttempts(): Promise<ExamAttempt[]> {
    const items = await this.db.examAttempts.toArray();
    return items.sort((a, b) => b.date.localeCompare(a.date));
  }

  async saveExamAttempt(attempt: ExamAttempt): Promise<void> {
    await this.db.examAttempts.put(attempt);
  }

  async deleteExamAttempt(id: string): Promise<void> {
    await this.db.examAttempts.delete(id);
  }

  async replaceAllData(
    blocks: TaiBlock[],
    topics: Topic[],
    studySessions: StudySession[] = [],
    weeklyPlanItems: WeeklyPlanItem[] = [],
    caseStudies: CaseStudy[] = [],
    questions: Question[] = [],
    examAttempts: ExamAttempt[] = [],
  ): Promise<void> {
    await this.db.transaction(
      'rw',
      [
        this.db.blocks,
        this.db.topics,
        this.db.studySessions,
        this.db.weeklyPlanItems,
        this.db.caseStudies,
        this.db.questions,
        this.db.examAttempts,
      ],
      async () => {
        await this.db.blocks.clear();
        await this.db.topics.clear();
        await this.db.studySessions.clear();
        await this.db.weeklyPlanItems.clear();
        await this.db.caseStudies.clear();
        await this.db.questions.clear();
        await this.db.examAttempts.clear();
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
        if (caseStudies.length > 0) {
          await this.db.caseStudies.bulkPut(caseStudies);
        }
        if (questions.length > 0) {
          await this.db.questions.bulkPut(questions);
        }
        if (examAttempts.length > 0) {
          await this.db.examAttempts.bulkPut(examAttempts);
        }
      },
    );
  }
}
