import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { vi } from 'vitest';
import { TAI_BLOCKS_SEED } from '../db/tai-seed';
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
import { STUDY_REPOSITORY, StudyRepository } from '../repositories/study.repository';
import { PomodoroService } from './pomodoro.service';
import { StudyStoreService } from './study-store.service';

class InMemoryRepo implements StudyRepository {
  blocks: TaiBlock[] = [...TAI_BLOCKS_SEED];
  topics: Topic[] = [];
  sessions: StudySession[] = [];
  weeklyPlan: WeeklyPlanItem[] = [];
  caseStudies: CaseStudy[] = [];
  questions: Question[] = [];
  examAttempts: ExamAttempt[] = [];

  async initialize(): Promise<void> {}
  async getBlocks(): Promise<TaiBlock[]> {
    return this.blocks;
  }
  async getTopics(blockId?: TaiBlockId): Promise<Topic[]> {
    return blockId ? this.topics.filter((t) => t.blockId === blockId) : this.topics;
  }
  async getTopicById(id: string): Promise<Topic | undefined> {
    return this.topics.find((t) => t.id === id);
  }
  async saveTopic(topic: Topic): Promise<void> {
    const idx = this.topics.findIndex((t) => t.id === topic.id);
    if (idx >= 0) this.topics[idx] = topic;
    else this.topics.push(topic);
  }
  async saveTopics(topics: Topic[]): Promise<void> {
    for (const t of topics) await this.saveTopic(t);
  }
  async deleteTopic(id: string): Promise<void> {
    this.topics = this.topics.filter((t) => t.id !== id);
  }
  async getStudySessions(): Promise<StudySession[]> {
    return [...this.sessions];
  }
  async saveStudySession(session: StudySession): Promise<void> {
    this.sessions.push(session);
  }
  async deleteStudySession(id: string): Promise<void> {
    this.sessions = this.sessions.filter((s) => s.id !== id);
  }
  async getWeeklyPlanItems(): Promise<WeeklyPlanItem[]> {
    return [...this.weeklyPlan];
  }
  async saveWeeklyPlanItem(item: WeeklyPlanItem): Promise<void> {
    this.weeklyPlan.push(item);
  }
  async saveWeeklyPlanItems(items: WeeklyPlanItem[]): Promise<void> {
    this.weeklyPlan.push(...items);
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
    this.blocks = blocks;
    this.topics = topics;
    this.sessions = studySessions;
    this.weeklyPlan = weeklyPlanItems;
    this.caseStudies = caseStudies;
    this.questions = questions;
    this.examAttempts = examAttempts;
  }
}

describe('PomodoroService', () => {
  let service: PomodoroService;
  let store: StudyStoreService;

  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        PomodoroService,
        StudyStoreService,
        { provide: STUDY_REPOSITORY, useValue: new InMemoryRepo() },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
      ],
    });

    store = TestBed.inject(StudyStoreService);
    await store.initialize();
    service = TestBed.inject(PomodoroService);
  });

  afterEach(() => {
    service.reset();
    vi.useRealTimers();
  });

  it('updates settings and resets idle remaining time', () => {
    service.updateSettings({ focusMinutes: 30, shortBreakMinutes: 7 });
    expect(service.settings().focusMinutes).toBe(30);
    expect(service.remainingSeconds()).toBe(1800);
    expect(service.formattedTime()).toBe('30:00');
  });

  it('starts, pauses, resumes, and resets timer state', () => {
    service.start();
    expect(service.status()).toBe('running');
    expect(service.isActive()).toBe(true);

    service.pause();
    expect(service.status()).toBe('paused');

    service.reset();
    expect(service.status()).toBe('idle');
    expect(service.isActive()).toBe(false);
  });

  it('logs a StudySession when finishing early after at least 1 minute', async () => {
    vi.useFakeTimers();
    const topic = await store.createTopic({ blockId: 'B3', title: 'SQL y Normalización' });

    service.updateSettings({ focusMinutes: 25, soundEnabled: false });
    service.start(topic.id);

    vi.advanceTimersByTime(125_000); // 2 minutes and 5 seconds

    const saved = await service.finishAndLogEarly();
    expect(saved).not.toBeNull();
    expect(saved?.topicId).toBe(topic.id);
    expect(saved?.blockId).toBe('B3');
    expect(saved?.durationMinutes).toBe(2);
    expect(store.studySessions().length).toBe(1);
    expect(service.phase()).toBe('short_break');
  });

  it('notifies user when finishing early without a selected topic and prevents duplicate logs', async () => {
    vi.useFakeTimers();
    const snackBar = TestBed.inject(MatSnackBar);

    service.updateSettings({ focusMinutes: 25, soundEnabled: false });
    service.start();
    vi.advanceTimersByTime(65_000);

    const [first, second] = await Promise.all([
      service.finishAndLogEarly(),
      service.finishAndLogEarly(),
    ]);

    expect(first).toBeNull();
    expect(second).toBeNull();
    expect(service.phase()).toBe('short_break');
    expect(snackBar.open).toHaveBeenCalledTimes(1);
  });

  it('transitions to short_break when skipping focus without incrementing cycles', () => {
    service.updateSettings({ cyclesBeforeLongBreak: 1 });
    service.skipPhase();
    expect(service.phase()).toBe('short_break');
    expect(service.completedFocusCycles()).toBe(0);
  });
});
