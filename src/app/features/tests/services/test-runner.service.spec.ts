import { TestBed } from '@angular/core/testing';
import { TAI_BLOCKS_SEED } from '../../../core/db/tai-seed';
import {
  CaseStudy,
  ExamAttempt,
  Flashcard,
  GamificationProfile,
  Question,
  StudySession,
  TaiBlock,
  TaiBlockId,
  Topic,
  WeeklyPlanItem,
} from '../../../core/models/study.models';
import { STUDY_REPOSITORY, StudyRepository } from '../../../core/repositories/study.repository';
import { StudyStoreService } from '../../../core/services/study-store.service';
import { TestRunnerService } from './test-runner.service';

class InMemoryTestRepo implements StudyRepository {
  blocks: TaiBlock[] = [...TAI_BLOCKS_SEED];
  topics: Topic[] = [];
  sessions: StudySession[] = [];
  weeklyPlan: WeeklyPlanItem[] = [];
  caseStudies: CaseStudy[] = [];
  questions: Question[] = [];
  examAttempts: ExamAttempt[] = [];
  flashcards: Flashcard[] = [];
  profile?: GamificationProfile;

  async initialize(): Promise<void> {}
  async getBlocks(): Promise<TaiBlock[]> { return this.blocks; }
  async saveBlock(block: TaiBlock): Promise<void> {
    this.blocks = [block, ...this.blocks.filter((b) => b.id !== block.id)];
  }
  async saveBlocks(blocks: TaiBlock[]): Promise<void> {
    for (const b of blocks) await this.saveBlock(b);
  }
  async deleteBlock(id: TaiBlockId): Promise<void> {
    this.blocks = this.blocks.filter((b) => b.id !== id);
    this.topics = this.topics.filter((t) => t.blockId !== id);
    this.weeklyPlan = this.weeklyPlan.filter((w) => w.blockId !== id);
    this.sessions = this.sessions.filter((s) => s.blockId !== id);
    this.caseStudies = this.caseStudies.filter((c) => c.blockId !== id);
    this.questions = this.questions.filter((q) => q.blockId !== id);
    this.flashcards = this.flashcards.filter((f) => f.blockId !== id);
  }
  async getTopics(blockId?: TaiBlockId): Promise<Topic[]> {
    return blockId ? this.topics.filter((t) => t.blockId === blockId) : this.topics;
  }
  async getTopicById(id: string): Promise<Topic | undefined> {
    return this.topics.find((t) => t.id === id);
  }
  async saveTopic(topic: Topic): Promise<void> {
    this.topics = [topic, ...this.topics.filter((t) => t.id !== topic.id)];
  }
  async saveTopics(topics: Topic[]): Promise<void> {
    for (const t of topics) await this.saveTopic(t);
  }
  async deleteTopic(id: string): Promise<void> {
    this.topics = this.topics.filter((t) => t.id !== id);
  }
  async getStudySessions(): Promise<StudySession[]> { return this.sessions; }
  async saveStudySession(s: StudySession): Promise<void> { this.sessions.push(s); }
  async deleteStudySession(id: string): Promise<void> {
    this.sessions = this.sessions.filter((s) => s.id !== id);
  }
  async getWeeklyPlanItems(): Promise<WeeklyPlanItem[]> { return this.weeklyPlan; }
  async saveWeeklyPlanItem(w: WeeklyPlanItem): Promise<void> { this.weeklyPlan.push(w); }
  async saveWeeklyPlanItems(items: WeeklyPlanItem[]): Promise<void> { this.weeklyPlan.push(...items); }
  async deleteWeeklyPlanItem(id: string): Promise<void> {
    this.weeklyPlan = this.weeklyPlan.filter((w) => w.id !== id);
  }
  async getCaseStudies(): Promise<CaseStudy[]> { return this.caseStudies; }
  async saveCaseStudy(cs: CaseStudy): Promise<void> {
    this.caseStudies = [cs, ...this.caseStudies.filter((c) => c.id !== cs.id)];
  }
  async deleteCaseStudy(id: string): Promise<void> {
    this.caseStudies = this.caseStudies.filter((c) => c.id !== id);
  }
  async getQuestions(): Promise<Question[]> { return this.questions; }
  async saveQuestion(q: Question): Promise<void> {
    this.questions = [q, ...this.questions.filter((x) => x.id !== q.id)];
  }
  async saveQuestions(qs: Question[]): Promise<void> {
    for (const q of qs) await this.saveQuestion(q);
  }
  async deleteQuestion(id: string): Promise<void> {
    this.questions = this.questions.filter((q) => q.id !== id);
  }
  async getExamAttempts(): Promise<ExamAttempt[]> { return this.examAttempts; }
  async saveExamAttempt(a: ExamAttempt): Promise<void> {
    this.examAttempts = [a, ...this.examAttempts.filter((x) => x.id !== a.id)];
  }
  async deleteExamAttempt(id: string): Promise<void> {
    this.examAttempts = this.examAttempts.filter((a) => a.id !== id);
  }
  async getFlashcards(): Promise<Flashcard[]> { return [...this.flashcards]; }
  async saveFlashcard(fc: Flashcard): Promise<void> {
    this.flashcards = [fc, ...this.flashcards.filter((x) => x.id !== fc.id)];
  }
  async saveFlashcards(fcs: Flashcard[]): Promise<void> {
    for (const f of fcs) await this.saveFlashcard(f);
  }
  async deleteFlashcard(id: string): Promise<void> {
    this.flashcards = this.flashcards.filter((f) => f.id !== id);
  }
  async getGamificationProfile(): Promise<GamificationProfile | undefined> { return this.profile; }
  async saveGamificationProfile(profile: GamificationProfile): Promise<void> { this.profile = profile; }
  async replaceAllData(): Promise<void> {}
}

describe('TestRunnerService', () => {
  let runner: TestRunnerService;
  let store: StudyStoreService;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        TestRunnerService,
        StudyStoreService,
        { provide: STUDY_REPOSITORY, useValue: new InMemoryTestRepo() },
      ],
    });
    store = TestBed.inject(StudyStoreService);
    runner = TestBed.inject(TestRunnerService);
    await store.initialize();
  });

  afterEach(() => {
    runner.reset();
  });

  it('should support simulation mode toggling blank answers and persisting scored attempt', async () => {
    const [q1, q2] = await store.bulkCreateQuestions([
      {
        blockId: 'B1',
        prompt: 'P1',
        options: ['A', 'B', 'C', 'D'],
        correctIndex: 0,
      },
      {
        blockId: 'B2',
        prompt: 'P2',
        options: ['A', 'B', 'C', 'D'],
        correctIndex: 1,
      },
    ]);

    runner.startSession([q1, q2], {
      title: 'Simulacro TAI',
      mode: 'simulation',
      penaltyRatio: 1 / 3,
      immediateFeedback: false,
      timeLimitSec: 600,
    });

    expect(runner.isRunning()).toBe(true);
    runner.selectOption(q1.id, 0);
    expect(runner.answeredCount()).toBe(1);

    // Clicking same option clears it in simulation mode
    runner.selectOption(q1.id, 0);
    expect(runner.answeredCount()).toBe(0);

    runner.selectOption(q1.id, 0); // correct
    runner.selectOption(q2.id, 2); // wrong
    const attempt = await runner.finishSession();

    expect(runner.isFinished()).toBe(true);
    expect(attempt?.correctCount).toBe(1);
    expect(attempt?.wrongCount).toBe(1);
    expect(attempt?.netScore).toBeCloseTo(0.67, 2);
    expect(store.examAttempts().length).toBe(1);
  });

  it('should lock answer immediately in practice mode with immediateFeedback', async () => {
    const q1 = await store.createQuestion({
      blockId: 'B1',
      prompt: 'P1',
      options: ['A', 'B', 'C', 'D'],
      correctIndex: 2,
    });

    runner.startSession([q1], {
      title: 'Práctica',
      mode: 'practice',
      penaltyRatio: 0,
      immediateFeedback: true,
      timeLimitSec: null,
    });

    runner.selectOption(q1.id, 1);
    expect(runner.isCurrentRevealed()).toBe(true);
    // Attempting to change answer in practice mode is ignored
    runner.selectOption(q1.id, 2);
    expect(runner.currentSelection()).toBe(1);
  });
});
