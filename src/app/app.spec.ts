import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';
import { TAI_BLOCKS_SEED } from './core/db/tai-seed';
import {
  CaseStudy,
  ExamAttempt,
  Question,
  StudySession,
  TaiBlock,
  TaiBlockId,
  Topic,
  WeeklyPlanItem,
} from './core/models/study.models';
import { STUDY_REPOSITORY, StudyRepository } from './core/repositories/study.repository';
import { StudyStoreService } from './core/services/study-store.service';

class InMemoryStudyRepository implements StudyRepository {
  private blocks: TaiBlock[] = [...TAI_BLOCKS_SEED];
  private topics: Topic[] = [];
  private sessions: StudySession[] = [];
  private weeklyPlan: WeeklyPlanItem[] = [];
  private caseStudies: CaseStudy[] = [];
  private questions: Question[] = [];
  private examAttempts: ExamAttempt[] = [];

  async initialize(): Promise<void> {}

  async getBlocks(): Promise<TaiBlock[]> {
    return [...this.blocks];
  }

  async getTopics(blockId?: TaiBlockId): Promise<Topic[]> {
    return blockId ? this.topics.filter((t) => t.blockId === blockId) : [...this.topics];
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
    return [...this.sessions];
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
    return weekStartDate
      ? this.weeklyPlan.filter((w) => w.weekStartDate === weekStartDate)
      : [...this.weeklyPlan];
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

  async getCaseStudies(): Promise<CaseStudy[]> {
    return [...this.caseStudies];
  }
  async saveCaseStudy(cs: CaseStudy): Promise<void> {
    this.caseStudies = [cs, ...this.caseStudies.filter((c) => c.id !== cs.id)];
  }
  async deleteCaseStudy(id: string): Promise<void> {
    this.caseStudies = this.caseStudies.filter((c) => c.id !== id);
  }
  async getQuestions(): Promise<Question[]> {
    return [...this.questions];
  }
  async saveQuestion(q: Question): Promise<void> {
    this.questions = [q, ...this.questions.filter((x) => x.id !== q.id)];
  }
  async saveQuestions(qs: Question[]): Promise<void> {
    for (const q of qs) await this.saveQuestion(q);
  }
  async deleteQuestion(id: string): Promise<void> {
    this.questions = this.questions.filter((q) => q.id !== id);
  }
  async getExamAttempts(): Promise<ExamAttempt[]> {
    return [...this.examAttempts];
  }
  async saveExamAttempt(attempt: ExamAttempt): Promise<void> {
    this.examAttempts = [attempt, ...this.examAttempts.filter((a) => a.id !== attempt.id)];
  }
  async deleteExamAttempt(id: string): Promise<void> {
    this.examAttempts = this.examAttempts.filter((a) => a.id !== id);
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
    this.blocks = [...blocks];
    this.topics = [...topics];
    this.sessions = [...studySessions];
    this.weeklyPlan = [...weeklyPlanItems];
    this.caseStudies = [...caseStudies];
    this.questions = [...questions];
    this.examAttempts = [...examAttempts];
  }
}

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter(routes),
        {
          provide: STUDY_REPOSITORY,
          useClass: InMemoryStudyRepository,
        },
      ],
    }).compileComponents();
  });

  it('should create the app and initialize the 4 TAI blocks', async () => {
    const store = TestBed.inject(StudyStoreService);
    await store.initialize();

    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    expect(fixture.componentInstance).toBeTruthy();
    expect(store.blocks().length).toBe(4);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('TAI Study');
  });
});
