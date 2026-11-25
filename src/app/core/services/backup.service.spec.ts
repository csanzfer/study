import { TestBed } from '@angular/core/testing';
import { TAI_BLOCKS_SEED } from '../db/tai-seed';
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
  createDefaultGamificationProfile,
} from '../models/study.models';
import { STUDY_REPOSITORY, StudyRepository } from '../repositories/study.repository';
import { BackupService } from './backup.service';

class MockStudyRepository implements StudyRepository {
  blocks: TaiBlock[] = [...TAI_BLOCKS_SEED];
  topics: Topic[] = [
    {
      id: 't-1',
      blockId: 'B1',
      order: 1,
      title: 'Constitución Española',
      status: 'first_round',
      roundCount: 1,
      tags: ['leyes'],
      contentJson: { type: 'doc', content: [] },
      plainText: 'Título preliminar',
      customOutlineMd: '# Constitución\n## Título Preliminar\n- Art. 1',
      createdAt: '2026-11-20T12:00:00.000Z',
      updatedAt: '2026-11-20T12:00:00.000Z',
    },
  ];
  sessions: StudySession[] = [
    {
      id: 's-1',
      topicId: 't-1',
      blockId: 'B1',
      startedAt: '2026-11-23T09:00:00.000Z',
      endedAt: '2026-11-23T09:25:00.000Z',
      durationMinutes: 25,
      type: 'reading',
    },
  ];
  weeklyPlan: WeeklyPlanItem[] = [
    {
      id: 'w-1',
      weekStartDate: '2026-11-23',
      dayOfWeek: 1,
      topicId: 't-1',
      blockId: 'B1',
      order: 1,
      completed: false,
      targetPomodoros: 2,
    },
  ];
  caseStudies: CaseStudy[] = [
    {
      id: 'cs-1',
      blockId: 'B3',
      title: 'Supuesto REST API',
      statement: 'Una entidad pública expone un API REST...',
      tags: ['rest'],
      createdAt: '2026-11-23T10:00:00.000Z',
      updatedAt: '2026-11-23T10:00:00.000Z',
    },
  ];
  questions: Question[] = [
    {
      id: 'q-1',
      blockId: 'B1',
      topicId: 't-1',
      prompt: '¿En qué año se aprobó la Constitución Española?',
      options: ['1975', '1978', '1981', '1979'],
      correctIndex: 1,
      explanation: 'Aprobada en referéndum el 6 de diciembre de 1978.',
      reference: 'CE 1978',
      tags: ['ce'],
      flagged: false,
      stats: { attempts: 1, correct: 1, lastResult: 'correct' },
      createdAt: '2026-11-23T10:00:00.000Z',
      updatedAt: '2026-11-23T10:00:00.000Z',
    },
  ];
  examAttempts: ExamAttempt[] = [
    {
      id: 'a-1',
      title: 'Práctica Bloque I',
      date: '2026-11-23T11:00:00.000Z',
      mode: 'practice',
      penaltyRatio: 1 / 3,
      answers: [
        {
          questionId: 'q-1',
          blockId: 'B1',
          topicId: 't-1',
          selectedIndex: 1,
          correctIndex: 1,
          isCorrect: true,
        },
      ],
      correctCount: 1,
      wrongCount: 0,
      blankCount: 0,
      netScore: 1,
      maxScore: 1,
      scoreOn10: 10,
      durationSec: 45,
    },
  ];
  flashcards: Flashcard[] = [
    {
      id: 'fc-1',
      blockId: 'B4',
      topicId: 't-1',
      front: 'DNS',
      back: 'Domain Name System',
      hint: 'Puerto 53',
      tags: ['siglas', 'puertos'],
      srs: {
        intervalDays: 6,
        easeFactor: 2.5,
        repetitions: 2,
        lapses: 0,
        dueDate: '2026-11-29',
      },
      createdAt: '2026-11-23T10:00:00.000Z',
      updatedAt: '2026-11-23T10:00:00.000Z',
    },
  ];
  profile: GamificationProfile | undefined = {
    ...createDefaultGamificationProfile('2026-11-23T11:00:00.000Z'),
    xp: 120,
    streakDays: 3,
    longestStreakDays: 5,
    lastActiveDate: '2026-11-23',
    activeDates: ['2026-11-21', '2026-11-22', '2026-11-23'],
  };

  async initialize(): Promise<void> {}
  async getBlocks(): Promise<TaiBlock[]> {
    return this.blocks;
  }
  async saveBlock(block: TaiBlock): Promise<void> {
    const idx = this.blocks.findIndex((b) => b.id === block.id);
    if (idx >= 0) {
      this.blocks[idx] = block;
    } else {
      this.blocks.push(block);
    }
  }
  async saveBlocks(blocks: TaiBlock[]): Promise<void> {
    for (const block of blocks) {
      await this.saveBlock(block);
    }
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
  }
  async getStudySessions(): Promise<StudySession[]> {
    return this.sessions;
  }
  async saveStudySession(session: StudySession): Promise<void> {
    this.sessions.push(session);
  }
  async deleteStudySession(id: string): Promise<void> {
    this.sessions = this.sessions.filter((s) => s.id !== id);
  }
  async getWeeklyPlanItems(weekStartDate?: string): Promise<WeeklyPlanItem[]> {
    return weekStartDate
      ? this.weeklyPlan.filter((w) => w.weekStartDate === weekStartDate)
      : this.weeklyPlan;
  }
  async saveWeeklyPlanItem(item: WeeklyPlanItem): Promise<void> {
    this.weeklyPlan.push(item);
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
    return this.caseStudies;
  }
  async saveCaseStudy(cs: CaseStudy): Promise<void> {
    this.caseStudies.push(cs);
  }
  async deleteCaseStudy(id: string): Promise<void> {
    this.caseStudies = this.caseStudies.filter((c) => c.id !== id);
  }
  async getQuestions(): Promise<Question[]> {
    return this.questions;
  }
  async saveQuestion(q: Question): Promise<void> {
    this.questions.push(q);
  }
  async saveQuestions(qs: Question[]): Promise<void> {
    this.questions.push(...qs);
  }
  async deleteQuestion(id: string): Promise<void> {
    this.questions = this.questions.filter((q) => q.id !== id);
  }
  async getExamAttempts(): Promise<ExamAttempt[]> {
    return this.examAttempts;
  }
  async saveExamAttempt(attempt: ExamAttempt): Promise<void> {
    this.examAttempts.push(attempt);
  }
  async deleteExamAttempt(id: string): Promise<void> {
    this.examAttempts = this.examAttempts.filter((a) => a.id !== id);
  }
  async getFlashcards(): Promise<Flashcard[]> {
    return this.flashcards;
  }
  async saveFlashcard(fc: Flashcard): Promise<void> {
    this.flashcards.push(fc);
  }
  async saveFlashcards(fcs: Flashcard[]): Promise<void> {
    this.flashcards.push(...fcs);
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
    blocks: TaiBlock[],
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

describe('BackupService', () => {
  let service: BackupService;
  let repo: MockStudyRepository;

  beforeEach(() => {
    repo = new MockStudyRepository();
    TestBed.configureTestingModule({
      providers: [
        BackupService,
        { provide: STUDY_REPOSITORY, useValue: repo },
      ],
    });
    service = TestBed.inject(BackupService);
  });

  it('should create a valid v4 backup payload including flashcards and gamification profile', async () => {
    const payload = await service.createBackupPayload();
    expect(payload.appName).toBe('tai-study');
    expect(payload.schemaVersion).toBe(4);
    expect(payload.blocks.length).toBe(4);
    expect(payload.topics.length).toBe(1);
    expect(payload.studySessions?.length).toBe(1);
    expect(payload.weeklyPlanItems?.length).toBe(1);
    expect(payload.caseStudies?.length).toBe(1);
    expect(payload.questions?.length).toBe(1);
    expect(payload.examAttempts?.length).toBe(1);
    expect(payload.flashcards?.length).toBe(1);
    expect(payload.gamificationProfile?.xp).toBe(120);
  });

  it('should accept legacy v1 and v2 backup files for backward compatibility', async () => {
    const legacyV1 = {
      schemaVersion: 1,
      appName: 'tai-study',
      exportedAt: '2026-11-20T12:00:00.000Z',
      blocks: repo.blocks,
      topics: repo.topics,
    };

    const parsedV1 = service.parseBackupJson(JSON.stringify(legacyV1));
    expect(parsedV1.schemaVersion).toBe(1);
    expect(parsedV1.topics.length).toBe(1);
    expect(parsedV1.studySessions).toEqual([]);
    expect(parsedV1.weeklyPlanItems).toEqual([]);
    expect(parsedV1.questions).toEqual([]);
    expect(parsedV1.caseStudies).toEqual([]);
    expect(parsedV1.examAttempts).toEqual([]);

    const legacyV2 = {
      schemaVersion: 2,
      appName: 'tai-study',
      exportedAt: '2026-11-21T12:00:00.000Z',
      blocks: repo.blocks,
      topics: repo.topics,
      studySessions: repo.sessions,
      weeklyPlanItems: repo.weeklyPlan,
    };

    const parsedV2 = service.parseBackupJson(JSON.stringify(legacyV2));
    expect(parsedV2.schemaVersion).toBe(2);
    expect(parsedV2.studySessions?.length).toBe(1);
    expect(parsedV2.questions).toEqual([]);
  });

  it('should reject an invalid backup JSON', () => {
    expect(() => service.parseBackupJson('{invalid')).toThrow();
    expect(() =>
      service.parseBackupJson(JSON.stringify({ appName: 'other', schemaVersion: 2 })),
    ).toThrow();
  });

  it('should preserve rich topics, studySessions, and weeklyPlanItems across export/import round-trip', async () => {
    const richContentJson = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Ley 39/2015' }] },
        {
          type: 'examCallout',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Plazo general: 3 meses' }] }],
        },
      ],
    };

    repo.topics = [
      {
        ...repo.topics[0],
        contentJson: richContentJson,
        plainText: 'Ley 39/2015 Plazo general: 3 meses',
        customOutlineMd: '# Ley 39/2015\n- ⚠️ Plazo general: 3 meses',
      },
    ];

    const exported = await service.createBackupPayload();
    const jsonString = JSON.stringify(exported);

    // Wipe repository before restoring
    await repo.replaceAllData([], [], [], [], [], [], []);
    expect((await repo.getTopics()).length).toBe(0);
    expect((await repo.getStudySessions()).length).toBe(0);
    expect((await repo.getWeeklyPlanItems()).length).toBe(0);
    expect((await repo.getQuestions()).length).toBe(0);

    const file = new File([jsonString], 'tai-study-backup.json', { type: 'application/json' });
    const result = await service.importBackupFile(file);

    expect(result.blocksCount).toBe(4);
    expect(result.topicsCount).toBe(1);
    expect(result.sessionsCount).toBe(1);
    expect(result.weeklyPlanItemsCount).toBe(1);
    expect(result.caseStudiesCount).toBe(1);
    expect(result.questionsCount).toBe(1);
    expect(result.examAttemptsCount).toBe(1);
    expect(result.flashcardsCount).toBe(1);
    expect((await repo.getGamificationProfile())?.streakDays).toBe(3);

    const [restored] = await repo.getTopics();
    expect(restored.contentJson).toEqual(richContentJson);
    expect(restored.plainText).toBe('Ley 39/2015 Plazo general: 3 meses');
    expect(restored.customOutlineMd).toBe('# Ley 39/2015\n- ⚠️ Plazo general: 3 meses');
    expect((await repo.getStudySessions())[0].durationMinutes).toBe(25);
    expect((await repo.getWeeklyPlanItems())[0].weekStartDate).toBe('2026-11-23');
  });

  it('should reject malformed studySessions and weeklyPlanItems in v2 backups', async () => {
    const base = await service.createBackupPayload();

    const invalidSessionPayload = {
      ...base,
      studySessions: [{ ...base.studySessions![0], durationMinutes: 0 }],
    };
    expect(() => service.parseBackupJson(JSON.stringify(invalidSessionPayload))).toThrow();

    const missingEndedAtPayload = {
      ...base,
      studySessions: [{ ...base.studySessions![0], endedAt: undefined }],
    };
    expect(() => service.parseBackupJson(JSON.stringify(missingEndedAtPayload))).toThrow();

    const invalidPlanOrderPayload = {
      ...base,
      weeklyPlanItems: [{ ...base.weeklyPlanItems![0], order: undefined }],
    };
    expect(() => service.parseBackupJson(JSON.stringify(invalidPlanOrderPayload))).toThrow();

    const nonIntegerDayPayload = {
      ...base,
      weeklyPlanItems: [{ ...base.weeklyPlanItems![0], dayOfWeek: 1.5 }],
    };
    expect(() => service.parseBackupJson(JSON.stringify(nonIntegerDayPayload))).toThrow();

    const invalidQuestionPayload = {
      ...base,
      questions: [{ ...base.questions![0], correctIndex: 5 }],
    };
    expect(() => service.parseBackupJson(JSON.stringify(invalidQuestionPayload))).toThrow();

    const missingQuestionUpdatedAt = {
      ...base,
      questions: [{ ...base.questions![0], updatedAt: undefined }],
    };
    expect(() => service.parseBackupJson(JSON.stringify(missingQuestionUpdatedAt))).toThrow();

    const missingCaseStudyUpdatedAt = {
      ...base,
      caseStudies: [{ ...base.caseStudies![0], updatedAt: undefined }],
    };
    expect(() => service.parseBackupJson(JSON.stringify(missingCaseStudyUpdatedAt))).toThrow();

    const invalidAttemptMode = {
      ...base,
      examAttempts: [{ ...base.examAttempts![0], mode: 'unknown_mode' }],
    };
    expect(() => service.parseBackupJson(JSON.stringify(invalidAttemptMode))).toThrow();

    const missingAttemptScoreOn10 = {
      ...base,
      examAttempts: [{ ...base.examAttempts![0], scoreOn10: undefined }],
    };
    expect(() => service.parseBackupJson(JSON.stringify(missingAttemptScoreOn10))).toThrow();

    const invalidFlashcardPayload = {
      ...base,
      flashcards: [{ ...base.flashcards![0], srs: { ...base.flashcards![0].srs, easeFactor: 0.5 } }],
    };
    expect(() => service.parseBackupJson(JSON.stringify(invalidFlashcardPayload))).toThrow();

    const missingFlashcardLapsesPayload = {
      ...base,
      flashcards: [{ ...base.flashcards![0], srs: { ...base.flashcards![0].srs, lapses: undefined } }],
    };
    expect(() => service.parseBackupJson(JSON.stringify(missingFlashcardLapsesPayload))).toThrow();

    const invalidProfilePayload = {
      ...base,
      gamificationProfile: { ...base.gamificationProfile!, xp: -10 },
    };
    expect(() => service.parseBackupJson(JSON.stringify(invalidProfilePayload))).toThrow();

    const missingFreezeUsedDatesPayload = {
      ...base,
      gamificationProfile: { ...base.gamificationProfile!, freezeUsedDates: undefined },
    };
    expect(() => service.parseBackupJson(JSON.stringify(missingFreezeUsedDatesPayload))).toThrow();

    const missingClaimedMissionsPayload = {
      ...base,
      gamificationProfile: { ...base.gamificationProfile!, claimedMissionIds: undefined },
    };
    expect(() => service.parseBackupJson(JSON.stringify(missingClaimedMissionsPayload))).toThrow();

    const invalidRestDaysPayload = {
      ...base,
      gamificationProfile: { ...base.gamificationProfile!, weeklyRestDays: [9] },
    };
    expect(() => service.parseBackupJson(JSON.stringify(invalidRestDaysPayload))).toThrow();
  });
});
