import { TestBed } from '@angular/core/testing';
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
import { STUDY_REPOSITORY, StudyRepository } from '../repositories/study.repository';
import { StudyStoreService } from './study-store.service';

const TEST_BLOCKS: StudyBlock[] = [
  {
    id: 'block-law',
    code: 'DER',
    title: 'Derecho Administrativo',
    shortTitle: 'Derecho',
    description: 'Normativa general',
    color: '#2563eb',
    icon: 'gavel',
    order: 1,
  },
  {
    id: 'block-os',
    code: 'SO',
    title: 'Sistemas Operativos',
    shortTitle: 'Sistemas',
    description: 'Procesos y memoria',
    color: '#0891b2',
    icon: 'memory',
    order: 2,
  },
  {
    id: 'block-dev',
    code: 'DEV',
    title: 'Desarrollo de Software',
    shortTitle: 'Desarrollo',
    description: 'Programación y SQL',
    color: '#7c3aed',
    icon: 'code',
    order: 3,
  },
  {
    id: 'block-net',
    code: 'RED',
    title: 'Redes y Comunicaciones',
    shortTitle: 'Redes',
    description: 'TCP/IP y seguridad',
    color: '#059669',
    icon: 'lan',
    order: 4,
  },
];

class InMemoryStudyRepository implements StudyRepository {
  blocks: StudyBlock[] = TEST_BLOCKS.map((b) => ({ ...b }));
  topics: Topic[] = [];
  sessions: StudySession[] = [];
  weeklyPlan: WeeklyPlanItem[] = [];
  caseStudies: CaseStudy[] = [];
  questions: Question[] = [];
  examAttempts: ExamAttempt[] = [];
  flashcards: Flashcard[] = [];
  profile?: GamificationProfile;

  async initialize(): Promise<void> {}

  async getBlocks(): Promise<StudyBlock[]> {
    return [...this.blocks].sort((a, b) => a.order - b.order);
  }

  async saveBlock(block: StudyBlock): Promise<void> {
    const idx = this.blocks.findIndex((b) => b.id === block.id);
    if (idx >= 0) {
      this.blocks[idx] = block;
    } else {
      this.blocks.push(block);
    }
  }

  async saveBlocks(blocks: StudyBlock[]): Promise<void> {
    for (const block of blocks) {
      await this.saveBlock(block);
    }
  }

  async deleteBlock(id: StudyBlockId): Promise<void> {
    this.blocks = this.blocks.filter((b) => b.id !== id);
    this.topics = this.topics.filter((t) => t.blockId !== id);
    this.weeklyPlan = this.weeklyPlan.filter((w) => w.blockId !== id);
    this.sessions = this.sessions.filter((s) => s.blockId !== id);
    this.caseStudies = this.caseStudies.filter((c) => c.blockId !== id);
    this.questions = this.questions.filter((q) => q.blockId !== id);
    this.flashcards = this.flashcards.filter((f) => f.blockId !== id);
  }

  async getTopics(blockId?: StudyBlockId): Promise<Topic[]> {
    const list = blockId ? this.topics.filter((t) => t.blockId === blockId) : [...this.topics];
    return list.sort((a, b) => a.blockId.localeCompare(b.blockId) || a.order - b.order);
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
    this.questions = this.questions.map((q) => (q.topicId === id ? { ...q, topicId: undefined } : q));
    this.flashcards = this.flashcards.map((f) => (f.topicId === id ? { ...f, topicId: undefined } : f));
  }

  async getStudySessions(): Promise<StudySession[]> {
    return [...this.sessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
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
    const list = weekStartDate
      ? this.weeklyPlan.filter((w) => w.weekStartDate === weekStartDate)
      : [...this.weeklyPlan];
    return list.sort(
      (a, b) =>
        a.weekStartDate.localeCompare(b.weekStartDate) ||
        a.dayOfWeek - b.dayOfWeek ||
        a.order - b.order,
    );
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
    return [...this.caseStudies].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  async saveCaseStudy(cs: CaseStudy): Promise<void> {
    const idx = this.caseStudies.findIndex((c) => c.id === cs.id);
    if (idx >= 0) this.caseStudies[idx] = cs;
    else this.caseStudies.push(cs);
  }
  async deleteCaseStudy(id: string): Promise<void> {
    this.caseStudies = this.caseStudies.filter((c) => c.id !== id);
    this.questions = this.questions.map((q) =>
      q.caseStudyId === id ? { ...q, caseStudyId: undefined } : q,
    );
  }
  async getQuestions(): Promise<Question[]> {
    return [...this.questions].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  async saveQuestion(q: Question): Promise<void> {
    const idx = this.questions.findIndex((x) => x.id === q.id);
    if (idx >= 0) this.questions[idx] = q;
    else this.questions.push(q);
  }
  async saveQuestions(qs: Question[]): Promise<void> {
    for (const q of qs) await this.saveQuestion(q);
  }
  async deleteQuestion(id: string): Promise<void> {
    this.questions = this.questions.filter((q) => q.id !== id);
  }
  async getExamAttempts(): Promise<ExamAttempt[]> {
    return [...this.examAttempts].sort((a, b) => b.date.localeCompare(a.date));
  }
  async saveExamAttempt(attempt: ExamAttempt): Promise<void> {
    const idx = this.examAttempts.findIndex((a) => a.id === attempt.id);
    if (idx >= 0) this.examAttempts[idx] = attempt;
    else this.examAttempts.push(attempt);
  }
  async deleteExamAttempt(id: string): Promise<void> {
    this.examAttempts = this.examAttempts.filter((a) => a.id !== id);
  }
  async getFlashcards(): Promise<Flashcard[]> {
    return [...this.flashcards];
  }
  async saveFlashcard(fc: Flashcard): Promise<void> {
    const idx = this.flashcards.findIndex((f) => f.id === fc.id);
    if (idx >= 0) this.flashcards[idx] = fc;
    else this.flashcards.push(fc);
  }
  async saveFlashcards(fcs: Flashcard[]): Promise<void> {
    for (const f of fcs) await this.saveFlashcard(f);
  }
  async deleteFlashcard(id: string): Promise<void> {
    this.flashcards = this.flashcards.filter((f) => f.id !== id);
  }
  async getGamificationProfile(): Promise<GamificationProfile | undefined> {
    return this.profile;
  }
  async saveGamificationProfile(profile: GamificationProfile): Promise<void> {
    this.profile = profile;
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
    this.blocks = [...blocks];
    this.topics = [...topics];
    this.sessions = [...studySessions];
    this.weeklyPlan = [...weeklyPlanItems];
    this.caseStudies = [...caseStudies];
    this.questions = [...questions];
    this.examAttempts = [...examAttempts];
    this.flashcards = [...flashcards];
    this.profile = gamificationProfile;
  }
}

describe('StudyStoreService', () => {
  let store: StudyStoreService;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        StudyStoreService,
        { provide: STUDY_REPOSITORY, useValue: new InMemoryStudyRepository() },
      ],
    });
    store = TestBed.inject(StudyStoreService);
    await store.initialize();
  });

  it('should update topic title, status, and deduplicated tags', async () => {
    const created = await store.createTopic({
      blockId: 'B1',
      title: 'Tema 1',
      tags: ['leyes'],
    });

    const updated = await store.updateTopic(created.id, {
      title: '  Constitución Española  ',
      status: 'outlined',
      tags: ['leyes', 'plazos', 'leyes', '  '],
    });

    expect(updated?.title).toBe('Constitución Española');
    expect(updated?.status).toBe('outlined');
    expect(updated?.tags).toEqual(['leyes', 'plazos']);
    expect(store.getTopicById(created.id)?.title).toBe('Constitución Española');
  });

  it('should reorder topics within a block and persist order 1..N', async () => {
    const t1 = await store.createTopic({ blockId: 'B2', title: 'CPU' });
    const t2 = await store.createTopic({ blockId: 'B2', title: 'Memoria' });
    const t3 = await store.createTopic({ blockId: 'B2', title: 'Buses' });

    await store.reorderTopics('B2', [t3.id, t1.id, t2.id]);

    const ordered = store.getTopicsForBlock('B2');
    expect(ordered.map((t) => t.title)).toEqual(['Buses', 'CPU', 'Memoria']);
    expect(ordered.map((t) => t.order)).toEqual([1, 2, 3]);
  });

  it('should ignore unknown or duplicate ids when reordering topics without leaving gaps', async () => {
    const t1 = await store.createTopic({ blockId: 'B2', title: 'CPU' });
    const t2 = await store.createTopic({ blockId: 'B2', title: 'Memoria' });
    const t3 = await store.createTopic({ blockId: 'B2', title: 'Buses' });

    await store.reorderTopics('B2', ['unknown-id', t3.id, t3.id, t1.id]);

    const ordered = store.getTopicsForBlock('B2');
    expect(ordered.map((t) => t.id)).toEqual([t3.id, t1.id, t2.id]);
    expect(ordered.map((t) => t.order)).toEqual([1, 2, 3]);
  });

  it('should reindex remaining topics after deletion', async () => {
    const t1 = await store.createTopic({ blockId: 'B3', title: 'POO' });
    const t2 = await store.createTopic({ blockId: 'B3', title: 'SQL' });
    const t3 = await store.createTopic({ blockId: 'B3', title: 'UML' });

    await store.deleteTopic(t2.id);

    const remaining = store.getTopicsForBlock('B3');
    expect(remaining.map((t) => t.id)).toEqual([t1.id, t3.id]);
    expect(remaining.map((t) => t.order)).toEqual([1, 2]);
  });

  it('should automatically increment roundCount and set lastReviewedAt when moving to mastered', async () => {
    const topic = await store.createTopic({ blockId: 'B1', title: 'Ley 39/2015' });
    expect(topic.roundCount).toBe(0);
    expect(topic.lastReviewedAt).toBeUndefined();

    const firstMove = await store.moveTopicStatus(topic.id, 'first_round');
    expect(firstMove?.roundIncremented).toBe(false);
    expect(firstMove?.topic.roundCount).toBe(0);
    expect(firstMove?.topic.lastReviewedAt).toBeDefined();

    const masteredMove = await store.moveTopicStatus(topic.id, 'mastered');
    expect(masteredMove?.roundIncremented).toBe(true);
    expect(masteredMove?.topic.roundCount).toBe(1);
    expect(store.totalRoundsCompleted()).toBe(1);

    // Moving to mastered again is a no-op
    const sameMove = await store.moveTopicStatus(topic.id, 'mastered');
    expect(sameMove?.roundIncremented).toBe(false);
    expect(sameMove?.topic.roundCount).toBe(1);
  });

  it('should log extra reviews and study sessions, updating weekly study minutes', async () => {
    const topic = await store.createTopic({ blockId: 'B4', title: 'TCP/IP' });

    const reviewed = await store.logTopicReview(topic.id, true);
    expect(reviewed?.roundCount).toBe(1);
    expect(reviewed?.status).toBe('first_round');
    expect(reviewed?.lastReviewedAt).toBeDefined();

    const session = await store.addStudySession({
      topicId: topic.id,
      blockId: 'B4',
      durationMinutes: 25,
      type: 'reading',
    });

    expect(store.studySessions().length).toBe(1);
    expect(store.studyMinutesThisWeek()).toBe(25);
    expect(store.studyMinutesByBlockThisWeek()['B4']).toBe(25);

    await store.deleteStudySession(session.id);
    expect(store.studySessions().length).toBe(0);
    expect(store.studyMinutesThisWeek()).toBe(0);
  });

  it('should manage weekly plan items and clean them up when a topic is deleted', async () => {
    const topic = await store.createTopic({ blockId: 'B2', title: 'Sistemas Operativos' });
    const item = await store.addWeeklyPlanItem({
      weekStartDate: '2026-11-23',
      dayOfWeek: 1,
      topicId: topic.id,
      blockId: 'B2',
      targetPomodoros: 2,
    });

    expect(store.getWeeklyPlanForWeek('2026-11-23').length).toBe(1);

    const toggled = await store.toggleWeeklyPlanItem(item.id);
    expect(toggled?.completed).toBe(true);
    expect(store.getTopicById(topic.id)?.lastReviewedAt).toBeDefined();

    await store.moveWeeklyPlanItem(item.id, 3, [item.id]);
    expect(store.getWeeklyPlanForWeek('2026-11-23')[0].dayOfWeek).toBe(3);

    await store.deleteTopic(topic.id);
    expect(store.getWeeklyPlanForWeek('2026-11-23').length).toBe(0);
  });

  it('should manage case studies, questions, flags, and unlink questions when deleting topic or case study', async () => {
    const topic = await store.createTopic({ blockId: 'B3', title: 'SQL Avanzado' });
    const cs = await store.createCaseStudy({
      blockId: 'B3',
      title: 'Supuesto Base de Datos',
      statement: 'Se dispone de un esquema relacional...',
      tags: ['sql', 'inap'],
    });

    const q = await store.createQuestion({
      blockId: 'B3',
      topicId: topic.id,
      caseStudyId: cs.id,
      prompt: '¿Qué cláusula filtra grupos en SQL?',
      options: ['WHERE', 'HAVING', 'GROUP BY', 'ORDER BY'],
      correctIndex: 1,
      reference: 'ISO SQL:2016',
    });

    expect(store.totalQuestions()).toBe(1);
    expect(store.questionCountByBlock()['B3']).toBe(1);
    expect(store.questionCountByTopic()[topic.id]).toBe(1);
    expect(store.getQuestionsForCaseStudy(cs.id).length).toBe(1);

    await store.toggleQuestionFlag(q.id);
    expect(store.flaggedQuestions().length).toBe(1);

    await store.deleteCaseStudy(cs.id);
    expect(store.caseStudies().length).toBe(0);
    expect(store.getQuestionById(q.id)?.caseStudyId).toBeUndefined();

    await store.deleteTopic(topic.id);
    expect(store.getQuestionById(q.id)?.topicId).toBeUndefined();
    expect(store.totalQuestions()).toBe(1);
  });

  it('should record exam attempts, update question stats, and log study session for tests >= 60s', async () => {
    const topic = await store.createTopic({ blockId: 'B1', title: 'Ley 39/2015' });
    const [q1, q2] = await store.bulkCreateQuestions([
      {
        blockId: 'B1',
        topicId: topic.id,
        prompt: 'Plazo general de resolución',
        options: ['1 mes', '3 meses', '6 meses', '15 días'],
        correctIndex: 1,
      },
      {
        blockId: 'B1',
        topicId: topic.id,
        prompt: 'Recurso de alzada (acto expreso)',
        options: ['10 días', '1 mes', '2 meses', '3 meses'],
        correctIndex: 1,
      },
    ]);

    const attempt = await store.recordExamAttempt({
      title: 'Práctica Ley 39/2015',
      mode: 'practice',
      penaltyRatio: 1 / 3,
      answers: [
        {
          questionId: q1.id,
          blockId: 'B1',
          topicId: topic.id,
          selectedIndex: 1,
          correctIndex: 1,
          isCorrect: true,
        },
        {
          questionId: q2.id,
          blockId: 'B1',
          topicId: topic.id,
          selectedIndex: 0,
          correctIndex: 1,
          isCorrect: false,
        },
      ],
      correctCount: 1,
      wrongCount: 1,
      blankCount: 0,
      netScore: 2 / 3,
      maxScore: 2,
      scoreOn10: 3.33,
      durationSec: 120,
    });

    expect(store.examAttempts().length).toBe(1);
    expect(store.latestExamAttempt()?.id).toBe(attempt.id);
    expect(store.getQuestionById(q1.id)?.stats).toMatchObject({
      attempts: 1,
      correct: 1,
      lastResult: 'correct',
    });
    expect(store.getQuestionById(q2.id)?.stats).toMatchObject({
      attempts: 1,
      correct: 0,
      lastResult: 'wrong',
    });
    expect(store.failedQuestions().map((q) => q.id)).toEqual([q2.id]);
    expect(store.overallTestAccuracy()).toBe(50);
    expect(store.studySessions().length).toBe(1);
    expect(store.studySessions()[0].type).toBe('test');
    expect(store.studySessions()[0].durationMinutes).toBe(2);
    expect(store.getTopicById(topic.id)?.lastReviewedAt).toBeDefined();
  });

  it('should create, review with SM-2, unlink on topic delete, and award XP/streak for flashcards', async () => {
    const topic = await store.createTopic({ blockId: 'B4', title: 'Protocolos' });
    const card = await store.createFlashcard({
      blockId: 'B4',
      topicId: topic.id,
      front: 'DNS',
      back: 'Domain Name System',
      hint: 'Puerto 53',
      tags: ['siglas', 'puertos'],
    });

    expect(store.totalFlashcards()).toBe(1);
    expect(store.dueFlashcardsCount()).toBe(1);
    expect(store.acronymFlashcards().length).toBe(1);
    expect(store.flashcardCountByTopic()[topic.id]).toBe(1);

    const reviewed = await store.reviewFlashcard(card.id, 'good');
    expect(reviewed?.srs.intervalDays).toBe(1);
    expect(reviewed?.srs.repetitions).toBe(1);
    expect(store.dueFlashcardsCount()).toBe(0);
    expect(store.gamificationProfile().xp).toBeGreaterThan(0);
    expect(store.gamificationProfile().streakDays).toBe(1);

    await store.updateWeeklyRestDays([0, 6]);
    expect(store.gamificationProfile().weeklyRestDays).toEqual([0, 6]);

    await store.deleteTopic(topic.id);
    expect(store.getFlashcardById(card.id)?.topicId).toBeUndefined();
    expect(store.totalFlashcards()).toBe(1);
  });

  it('should create, update, reorder, and cascade-delete dynamic blocks with reindexed orders', async () => {
    expect(store.defaultBlockId()).toBe('block-law');

    const created = await store.createBlock({
      code: '  HIST  ',
      title: '  Historia Contemporánea  ',
      description: '  Siglos XIX y XX  ',
      color: '#db2777',
      icon: 'history_edu',
    });

    expect(created.id.startsWith('block-')).toBe(true);
    expect(created.code).toBe('HIST');
    expect(created.title).toBe('Historia Contemporánea');
    expect(created.shortTitle).toBe('Historia Contemporánea');
    expect(created.order).toBe(5);
    expect(store.topicCountByBlock()[created.id]).toBe(0);
    expect(store.questionCountByBlock()[created.id]).toBe(0);
    expect(store.flashcardCountByBlock()[created.id]).toBe(0);

    const updated = await store.updateBlock(created.id, {
      shortTitle: 'Historia',
      color: '#4f46e5',
    });
    expect(updated?.shortTitle).toBe('Historia');
    expect(updated?.color).toBe('#4f46e5');
    expect(store.getBlockById(created.id)?.shortTitle).toBe('Historia');

    await store.reorderBlocks([created.id, 'block-net', 'block-law']);
    expect(store.blocks().map((b) => b.id)).toEqual([
      created.id,
      'block-net',
      'block-law',
      'block-os',
      'block-dev',
    ]);
    expect(store.blocks().map((b) => b.order)).toEqual([1, 2, 3, 4, 5]);
    expect(store.defaultBlockId()).toBe(created.id);

    const topic = await store.createTopic({ blockId: created.id, title: 'Revolución Industrial' });
    await store.addStudySession({
      topicId: topic.id,
      blockId: created.id,
      durationMinutes: 30,
      type: 'reading',
    });
    await store.createQuestion({
      blockId: created.id,
      topicId: topic.id,
      prompt: '¿Dónde comenzó la Revolución Industrial?',
      options: ['Francia', 'Gran Bretaña', 'España', 'Alemania'],
      correctIndex: 1,
    });
    await store.createFlashcard({
      blockId: created.id,
      topicId: topic.id,
      front: '1789',
      back: 'Revolución Francesa',
    });

    expect(store.topicCountByBlock()[created.id]).toBe(1);
    expect(store.studyMinutesByBlockThisWeek()[created.id]).toBe(30);
    expect(store.questionCountByBlock()[created.id]).toBe(1);
    expect(store.flashcardCountByBlock()[created.id]).toBe(1);

    await store.deleteBlock(created.id);

    expect(store.getBlockById(created.id)).toBeUndefined();
    expect(store.blocks().map((b) => b.order)).toEqual([1, 2, 3, 4]);
    expect(store.defaultBlockId()).toBe('block-net');
    expect(store.topics().some((t) => t.blockId === created.id)).toBe(false);
    expect(store.studySessions().some((s) => s.blockId === created.id)).toBe(false);
    expect(store.questions().some((q) => q.blockId === created.id)).toBe(false);
    expect(store.flashcards().some((f) => f.blockId === created.id)).toBe(false);
  });

  it('should use generic default title when recording an exam attempt with empty title', async () => {
    const attempt = await store.recordExamAttempt({
      title: '   ',
      mode: 'practice',
      penaltyRatio: 0,
      answers: [],
      correctCount: 0,
      wrongCount: 0,
      blankCount: 0,
      netScore: 0,
      maxScore: 0,
      scoreOn10: 0,
      durationSec: 10,
      logStudySession: false,
    });

    expect(attempt.title).toBe('Test de práctica');
  });
});
