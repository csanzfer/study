import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { StudyDatabase } from '../db/study.db';
import {
  BLOCK_COLOR_PRESETS,
  BLOCK_ICON_PRESETS,
  CaseStudy,
  EXAM_MODE_LABELS,
  ExamAttempt,
  FLASHCARD_SUGGESTED_TAGS,
  Flashcard,
  GamificationProfile,
  PENALTY_PRESETS,
  Question,
  StudyBlock,
  StudySession,
  Topic,
  WeeklyPlanItem,
  createDefaultGamificationProfile,
} from '../models/study.models';
import { IndexedDbStudyRepository } from './study.repository';

interface FakeTable<T extends { id: string }> {
  rows: T[];
  orderBy: (field: keyof T) => { toArray: () => Promise<T[]> };
  toArray: () => Promise<T[]>;
  get: (id: string) => Promise<T | undefined>;
  put: (item: T) => Promise<string>;
  bulkPut: (items: T[]) => Promise<void>;
  delete: (id: string) => Promise<void>;
  clear: () => Promise<void>;
  where: (field: keyof T) => {
    equals: (value: unknown) => {
      toArray: () => Promise<T[]>;
      delete: () => Promise<number>;
    };
  };
}

function createFakeTable<T extends { id: string }>(initial: T[] = []): FakeTable<T> {
  const table: FakeTable<T> = {
    rows: [...initial],
    orderBy(field: keyof T) {
      return {
        toArray: async () =>
          [...table.rows].sort((a, b) => Number(a[field]) - Number(b[field])),
      };
    },
    async toArray() {
      return [...table.rows];
    },
    async get(id: string) {
      return table.rows.find((row) => row.id === id);
    },
    async put(item: T) {
      const idx = table.rows.findIndex((row) => row.id === item.id);
      if (idx >= 0) {
        table.rows[idx] = item;
      } else {
        table.rows.push(item);
      }
      return item.id;
    },
    async bulkPut(items: T[]) {
      for (const item of items) {
        await table.put(item);
      }
    },
    async delete(id: string) {
      table.rows = table.rows.filter((row) => row.id !== id);
    },
    async clear() {
      table.rows = [];
    },
    where(field: keyof T) {
      return {
        equals(value: unknown) {
          return {
            toArray: async () => table.rows.filter((row) => row[field] === value),
            delete: async () => {
              const before = table.rows.length;
              table.rows = table.rows.filter((row) => row[field] !== value);
              return before - table.rows.length;
            },
          };
        },
      };
    },
  };
  return table;
}

describe('IndexedDbStudyRepository (Fase 1 - Bloques dinámicos)', () => {
  const createRepoWithFakeDb = () => {
    const blocks = createFakeTable<StudyBlock>();
    const topics = createFakeTable<Topic>();
    const studySessions = createFakeTable<StudySession>();
    const weeklyPlanItems = createFakeTable<WeeklyPlanItem>();
    const caseStudies = createFakeTable<CaseStudy>();
    const questions = createFakeTable<Question>();
    const examAttempts = createFakeTable<ExamAttempt>();
    const flashcards = createFakeTable<Flashcard>();
    const gamification = createFakeTable<GamificationProfile>([
      createDefaultGamificationProfile('2026-11-25T09:00:00.000Z'),
    ]);

    const transactionSpy = vi.fn(
      async (_mode: string, _tables: unknown, callback: () => Promise<void>) => {
        await callback();
      },
    );

    const fakeDb = {
      blocks,
      topics,
      studySessions,
      weeklyPlanItems,
      caseStudies,
      questions,
      examAttempts,
      flashcards,
      gamification,
      transaction: transactionSpy,
      ensureSeeded: vi.fn(async () => undefined),
      requestPersistentStorage: vi.fn(async () => false),
    };

    TestBed.configureTestingModule({
      providers: [
        IndexedDbStudyRepository,
        { provide: StudyDatabase, useValue: fakeDb },
      ],
    });

    const repo = TestBed.inject(IndexedDbStudyRepository);
    return { repo, fakeDb, transactionSpy };
  };

  it('should save a single block and retrieve blocks ordered by order', async () => {
    const { repo } = createRepoWithFakeDb();

    const blockB: StudyBlock = {
      id: 'block-hist',
      code: 'HIST',
      title: 'Historia Contemporánea',
      shortTitle: 'Historia',
      description: 'Siglos XIX y XX',
      color: '#7c3aed',
      icon: 'history_edu',
      order: 2,
    };
    const blockA: StudyBlock = {
      id: 'block-math',
      code: 'MAT',
      title: 'Matemáticas',
      shortTitle: 'Matemáticas',
      description: 'Álgebra y cálculo',
      color: '#2563eb',
      icon: 'calculate',
      order: 1,
    };

    await repo.saveBlock(blockB);
    await repo.saveBlock(blockA);

    const result = await repo.getBlocks();
    expect(result.map((b) => b.id)).toEqual(['block-math', 'block-hist']);
  });

  it('should bulk save blocks in a transaction and ignore empty array', async () => {
    const { repo, transactionSpy } = createRepoWithFakeDb();

    await repo.saveBlocks([]);
    expect(transactionSpy).not.toHaveBeenCalled();

    await repo.saveBlocks([
      {
        id: 'block-1',
        code: 'A1',
        title: 'Asignatura 1',
        shortTitle: 'Asig 1',
        description: '',
        color: '#2563eb',
        icon: 'menu_book',
        order: 1,
      },
      {
        id: 'block-2',
        code: 'A2',
        title: 'Asignatura 2',
        shortTitle: 'Asig 2',
        description: '',
        color: '#059669',
        icon: 'science',
        order: 2,
      },
    ]);

    expect(transactionSpy).toHaveBeenCalledTimes(1);
    expect((await repo.getBlocks()).length).toBe(2);
  });

  it('should delete a block and cascade-delete all linked entities in a single transaction without touching other blocks or examAttempts', async () => {
    const { repo, fakeDb, transactionSpy } = createRepoWithFakeDb();

    await repo.saveBlocks([
      {
        id: 'block-del',
        code: 'DEL',
        title: 'A borrar',
        shortTitle: 'A borrar',
        description: '',
        color: '#dc2626',
        icon: 'folder',
        order: 1,
      },
      {
        id: 'block-keep',
        code: 'KEEP',
        title: 'Conservar',
        shortTitle: 'Conservar',
        description: '',
        color: '#059669',
        icon: 'school',
        order: 2,
      },
    ]);

    await fakeDb.topics.bulkPut([
      {
        id: 't-del',
        blockId: 'block-del',
        order: 1,
        title: 'Tema borrado',
        status: 'pending',
        roundCount: 0,
        tags: [],
        contentJson: {},
        plainText: '',
        createdAt: '2026-11-25T09:00:00.000Z',
        updatedAt: '2026-11-25T09:00:00.000Z',
      },
      {
        id: 't-keep',
        blockId: 'block-keep',
        order: 1,
        title: 'Tema conservado',
        status: 'pending',
        roundCount: 0,
        tags: [],
        contentJson: {},
        plainText: '',
        createdAt: '2026-11-25T09:00:00.000Z',
        updatedAt: '2026-11-25T09:00:00.000Z',
      },
    ]);

    await fakeDb.weeklyPlanItems.bulkPut([
      {
        id: 'w-del',
        weekStartDate: '2026-11-23',
        dayOfWeek: 1,
        topicId: 't-del',
        blockId: 'block-del',
        order: 1,
        completed: false,
      },
      {
        id: 'w-keep',
        weekStartDate: '2026-11-23',
        dayOfWeek: 2,
        topicId: 't-keep',
        blockId: 'block-keep',
        order: 1,
        completed: false,
      },
    ]);

    await fakeDb.studySessions.bulkPut([
      {
        id: 's-del',
        topicId: 't-del',
        blockId: 'block-del',
        startedAt: '2026-11-25T08:00:00.000Z',
        endedAt: '2026-11-25T08:25:00.000Z',
        durationMinutes: 25,
        type: 'reading',
      },
      {
        id: 's-keep',
        topicId: 't-keep',
        blockId: 'block-keep',
        startedAt: '2026-11-25T08:30:00.000Z',
        endedAt: '2026-11-25T08:55:00.000Z',
        durationMinutes: 25,
        type: 'reading',
      },
    ]);

    await fakeDb.caseStudies.bulkPut([
      {
        id: 'cs-del',
        blockId: 'block-del',
        title: 'Supuesto del',
        statement: 'Enunciado',
        tags: [],
        createdAt: '2026-11-25T09:00:00.000Z',
        updatedAt: '2026-11-25T09:00:00.000Z',
      },
      {
        id: 'cs-keep',
        blockId: 'block-keep',
        title: 'Supuesto keep',
        statement: 'Enunciado',
        tags: [],
        createdAt: '2026-11-25T09:00:00.000Z',
        updatedAt: '2026-11-25T09:00:00.000Z',
      },
    ]);

    await fakeDb.questions.bulkPut([
      {
        id: 'q-del',
        blockId: 'block-del',
        topicId: 't-del',
        prompt: 'Pregunta del',
        options: ['A', 'B', 'C', 'D'],
        correctIndex: 0,
        tags: [],
        flagged: false,
        stats: { attempts: 0, correct: 0 },
        createdAt: '2026-11-25T09:00:00.000Z',
        updatedAt: '2026-11-25T09:00:00.000Z',
      },
      {
        id: 'q-keep',
        blockId: 'block-keep',
        topicId: 't-keep',
        prompt: 'Pregunta keep',
        options: ['A', 'B', 'C', 'D'],
        correctIndex: 1,
        tags: [],
        flagged: false,
        stats: { attempts: 0, correct: 0 },
        createdAt: '2026-11-25T09:00:00.000Z',
        updatedAt: '2026-11-25T09:00:00.000Z',
      },
    ]);

    await fakeDb.flashcards.bulkPut([
      {
        id: 'fc-del',
        blockId: 'block-del',
        topicId: 't-del',
        front: 'Frente del',
        back: 'Reverso del',
        tags: ['conceptos'],
        srs: {
          intervalDays: 1,
          easeFactor: 2.5,
          repetitions: 0,
          lapses: 0,
          dueDate: '2026-11-25',
        },
        createdAt: '2026-11-25T09:00:00.000Z',
        updatedAt: '2026-11-25T09:00:00.000Z',
      },
      {
        id: 'fc-keep',
        blockId: 'block-keep',
        topicId: 't-keep',
        front: 'Frente keep',
        back: 'Reverso keep',
        tags: ['definiciones'],
        srs: {
          intervalDays: 1,
          easeFactor: 2.5,
          repetitions: 0,
          lapses: 0,
          dueDate: '2026-11-25',
        },
        createdAt: '2026-11-25T09:00:00.000Z',
        updatedAt: '2026-11-25T09:00:00.000Z',
      },
    ]);

    await fakeDb.examAttempts.put({
      id: 'attempt-1',
      title: 'Simulacro',
      date: '2026-11-25T09:00:00.000Z',
      mode: 'simulation',
      penaltyRatio: 1 / 3,
      answers: [
        {
          questionId: 'q-del',
          blockId: 'block-del',
          selectedIndex: 0,
          correctIndex: 0,
          isCorrect: true,
        },
      ],
      correctCount: 1,
      wrongCount: 0,
      blankCount: 0,
      netScore: 1,
      maxScore: 1,
      scoreOn10: 10,
      durationSec: 60,
    });

    transactionSpy.mockClear();

    await repo.deleteBlock('block-del');

    expect(transactionSpy).toHaveBeenCalledTimes(1);
    const [, txTables] = transactionSpy.mock.calls[0];
    expect(txTables).toEqual([
      fakeDb.blocks,
      fakeDb.topics,
      fakeDb.weeklyPlanItems,
      fakeDb.studySessions,
      fakeDb.caseStudies,
      fakeDb.questions,
      fakeDb.flashcards,
    ]);

    expect(fakeDb.blocks.rows.map((b) => b.id)).toEqual(['block-keep']);
    expect(fakeDb.topics.rows.map((t) => t.id)).toEqual(['t-keep']);
    expect(fakeDb.weeklyPlanItems.rows.map((w) => w.id)).toEqual(['w-keep']);
    expect(fakeDb.studySessions.rows.map((s) => s.id)).toEqual(['s-keep']);
    expect(fakeDb.caseStudies.rows.map((c) => c.id)).toEqual(['cs-keep']);
    expect(fakeDb.questions.rows.map((q) => q.id)).toEqual(['q-keep']);
    expect(fakeDb.flashcards.rows.map((f) => f.id)).toEqual(['fc-keep']);
    expect(fakeDb.examAttempts.rows.map((a) => a.id)).toEqual(['attempt-1']);
    expect(fakeDb.gamification.rows.length).toBe(1);
  });

  it('should expose generic domain constants and unique block presets', () => {
    expect(EXAM_MODE_LABELS.simulation).toBe('Simulacro de examen');
    expect(PENALTY_PRESETS[0].label).toBe('Penalización -1/3');
    expect(FLASHCARD_SUGGESTED_TAGS).toContain('definiciones');
    expect(FLASHCARD_SUGGESTED_TAGS).toContain('conceptos');

    const hexes = BLOCK_COLOR_PRESETS.map((c) => c.hex);
    expect(hexes.length).toBeGreaterThanOrEqual(8);
    expect(new Set(hexes).size).toBe(hexes.length);

    const icons = BLOCK_ICON_PRESETS.map((i) => i.name);
    expect(icons.length).toBeGreaterThanOrEqual(12);
    expect(new Set(icons).size).toBe(icons.length);
  });
});
