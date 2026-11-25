import { Injectable, inject, signal } from '@angular/core';
import {
  BackupPayload,
  CaseStudy,
  ExamAnswer,
  ExamAttempt,
  ExamMode,
  Flashcard,
  FlashcardSrsState,
  GamificationProfile,
  Question,
  StudyBlock,
  StudyBlockId,
  StudySession,
  Topic,
  WeeklyPlanItem,
} from '../models/study.models';
import { STUDY_REPOSITORY } from '../repositories/study.repository';

const LAST_BACKUP_STORAGE_KEY = 'crisisstudent:last-backup-at';
const LEGACY_LAST_BACKUP_STORAGE_KEY = 'tai-study:last-backup-at';
const VALID_EXAM_MODES = new Set<ExamMode>(['practice', 'simulation', 'mistakes', 'case_study']);
const VALID_SCHEMA_VERSIONS = new Set<BackupPayload['schemaVersion']>([1, 2, 3, 4, 5]);
const VALID_APP_NAMES = new Set<BackupPayload['appName']>(['tai-study', 'crisisstudent']);

export interface BackupImportResult {
  blocksCount: number;
  topicsCount: number;
  sessionsCount: number;
  weeklyPlanItemsCount: number;
  caseStudiesCount: number;
  questionsCount: number;
  examAttemptsCount: number;
  flashcardsCount: number;
}

@Injectable({ providedIn: 'root' })
export class BackupService {
  private readonly repository = inject(STUDY_REPOSITORY);
  readonly lastBackupAt = signal<string | null>(this.readLastBackupDate());

  async createBackupPayload(): Promise<BackupPayload> {
    const [
      blocks,
      topics,
      studySessions,
      weeklyPlanItems,
      caseStudies,
      questions,
      examAttempts,
      flashcards,
      gamificationProfile,
    ] = await Promise.all([
      this.repository.getBlocks(),
      this.repository.getTopics(),
      this.repository.getStudySessions(),
      this.repository.getWeeklyPlanItems(),
      this.repository.getCaseStudies(),
      this.repository.getQuestions(),
      this.repository.getExamAttempts(),
      this.repository.getFlashcards(),
      this.repository.getGamificationProfile(),
    ]);

    return {
      schemaVersion: 5,
      appName: 'crisisstudent',
      exportedAt: new Date().toISOString(),
      blocks,
      topics,
      studySessions,
      weeklyPlanItems,
      caseStudies,
      questions,
      examAttempts,
      flashcards,
      gamificationProfile,
    };
  }

  async downloadBackup(): Promise<BackupPayload> {
    const payload = await this.createBackupPayload();
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const dateStamp = payload.exportedAt.slice(0, 10);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `crisisstudent-backup-${dateStamp}.json`;
    anchor.click();

    URL.revokeObjectURL(url);
    this.saveLastBackupDate(payload.exportedAt);

    return payload;
  }

  parseBackupJson(rawJson: string): BackupPayload {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawJson);
    } catch {
      throw new Error('El archivo no contiene un JSON válido.');
    }

    if (!parsed || typeof parsed !== 'object') {
      throw new Error('El formato del archivo de copia de seguridad no es válido.');
    }

    const candidate = parsed as Partial<BackupPayload>;
    if (
      !candidate.appName ||
      !VALID_APP_NAMES.has(candidate.appName) ||
      !candidate.schemaVersion ||
      !VALID_SCHEMA_VERSIONS.has(candidate.schemaVersion)
    ) {
      throw new Error(
        'Este archivo no corresponde a un backup compatible de CrisIsStudent / TAI Study (v1–v5).',
      );
    }

    if (!Array.isArray(candidate.blocks) || !Array.isArray(candidate.topics)) {
      throw new Error('Faltan las colecciones de bloques o temas en el backup.');
    }

    const validBlocks = candidate.blocks.every((block) => this.isValidBlock(block));
    if (!validBlocks) {
      throw new Error('Algunos bloques del backup tienen una estructura incompleta o corrupta.');
    }

    const validBlockIds = new Set<StudyBlockId>(candidate.blocks.map((block) => block.id));

    const validTopics = candidate.topics.every((topic) => this.isValidTopic(topic, validBlockIds));
    if (!validTopics) {
      throw new Error('Algunos temas del backup tienen una estructura incompleta o corrupta.');
    }

    let studySessions: StudySession[] = [];
    let weeklyPlanItems: WeeklyPlanItem[] = [];
    let caseStudies: CaseStudy[] = [];
    let questions: Question[] = [];
    let examAttempts: ExamAttempt[] = [];
    let flashcards: Flashcard[] = [];
    let gamificationProfile: GamificationProfile | undefined;

    if (candidate.studySessions !== undefined) {
      if (
        !Array.isArray(candidate.studySessions) ||
        !candidate.studySessions.every((session) =>
          this.isValidStudySession(session, validBlockIds),
        )
      ) {
        throw new Error('Algunas sesiones de estudio del backup tienen una estructura inválida.');
      }
      studySessions = candidate.studySessions;
    }

    if (candidate.weeklyPlanItems !== undefined) {
      if (
        !Array.isArray(candidate.weeklyPlanItems) ||
        !candidate.weeklyPlanItems.every((item) =>
          this.isValidWeeklyPlanItem(item, validBlockIds),
        )
      ) {
        throw new Error(
          'Algunos elementos del plan semanal del backup tienen una estructura inválida.',
        );
      }
      weeklyPlanItems = candidate.weeklyPlanItems;
    }

    if (candidate.caseStudies !== undefined) {
      if (
        !Array.isArray(candidate.caseStudies) ||
        !candidate.caseStudies.every((cs) => this.isValidCaseStudy(cs, validBlockIds))
      ) {
        throw new Error('Algunos supuestos prácticos del backup tienen una estructura inválida.');
      }
      caseStudies = candidate.caseStudies;
    }

    if (candidate.questions !== undefined) {
      if (
        !Array.isArray(candidate.questions) ||
        !candidate.questions.every((q) => this.isValidQuestion(q, validBlockIds))
      ) {
        throw new Error('Algunas preguntas del backup tienen una estructura inválida.');
      }
      questions = candidate.questions;
    }

    if (candidate.examAttempts !== undefined) {
      if (
        !Array.isArray(candidate.examAttempts) ||
        !candidate.examAttempts.every((attempt) => this.isValidExamAttempt(attempt))
      ) {
        throw new Error('Algunos intentos de test del backup tienen una estructura inválida.');
      }
      examAttempts = candidate.examAttempts;
    }

    if (candidate.flashcards !== undefined) {
      if (
        !Array.isArray(candidate.flashcards) ||
        !candidate.flashcards.every((card) => this.isValidFlashcard(card, validBlockIds))
      ) {
        throw new Error('Algunas flashcards del backup tienen una estructura inválida.');
      }
      flashcards = candidate.flashcards;
    }

    if (candidate.gamificationProfile !== undefined) {
      if (!this.isValidGamificationProfile(candidate.gamificationProfile)) {
        throw new Error('El perfil de gamificación del backup tiene una estructura inválida.');
      }
      gamificationProfile = candidate.gamificationProfile;
    }

    return {
      schemaVersion: candidate.schemaVersion,
      appName: candidate.appName,
      exportedAt:
        typeof candidate.exportedAt === 'string'
          ? candidate.exportedAt
          : new Date().toISOString(),
      blocks: candidate.blocks,
      topics: candidate.topics,
      studySessions,
      weeklyPlanItems,
      caseStudies,
      questions,
      examAttempts,
      flashcards,
      gamificationProfile,
    };
  }

  async importBackupFile(file: File): Promise<BackupImportResult> {
    const rawText = await file.text();
    const payload = this.parseBackupJson(rawText);

    const sessions = payload.studySessions ?? [];
    const planItems = payload.weeklyPlanItems ?? [];
    const caseStudies = payload.caseStudies ?? [];
    const questions = payload.questions ?? [];
    const examAttempts = payload.examAttempts ?? [];
    const flashcards = payload.flashcards ?? [];

    await this.repository.replaceAllData(
      payload.blocks,
      payload.topics,
      sessions,
      planItems,
      caseStudies,
      questions,
      examAttempts,
      flashcards,
      payload.gamificationProfile,
    );
    return {
      blocksCount: payload.blocks.length,
      topicsCount: payload.topics.length,
      sessionsCount: sessions.length,
      weeklyPlanItemsCount: planItems.length,
      caseStudiesCount: caseStudies.length,
      questionsCount: questions.length,
      examAttemptsCount: examAttempts.length,
      flashcardsCount: flashcards.length,
    };
  }

  private isValidBlock(item: unknown): item is StudyBlock {
    if (!this.isRecord(item)) {
      return false;
    }

    const block = item as Partial<StudyBlock>;
    return (
      this.isNonEmptyString(block.id) &&
      this.isString(block.code) &&
      this.isString(block.title) &&
      this.isString(block.shortTitle) &&
      this.isString(block.description) &&
      this.isString(block.color) &&
      this.isString(block.icon) &&
      this.isFiniteNumber(block.order)
    );
  }

  private isValidTopic(item: unknown, validBlockIds: ReadonlySet<StudyBlockId>): item is Topic {
    if (!this.isRecord(item)) {
      return false;
    }

    const topic = item as Partial<Topic>;
    return (
      this.isString(topic.id) &&
      this.isString(topic.title) &&
      this.isValidBlockId(topic.blockId, validBlockIds) &&
      this.isFiniteNumber(topic.order) &&
      this.isString(topic.status) &&
      Array.isArray(topic.tags)
    );
  }

  private isValidStudySession(
    item: unknown,
    validBlockIds: ReadonlySet<StudyBlockId>,
  ): item is StudySession {
    if (!this.isRecord(item)) {
      return false;
    }

    const session = item as Partial<StudySession>;
    return (
      this.isString(session.id) &&
      this.isString(session.topicId) &&
      this.isValidBlockId(session.blockId, validBlockIds) &&
      this.isString(session.startedAt) &&
      this.isString(session.endedAt) &&
      typeof session.durationMinutes === 'number' &&
      Number.isFinite(session.durationMinutes) &&
      session.durationMinutes > 0 &&
      this.isString(session.type)
    );
  }

  private isValidWeeklyPlanItem(
    item: unknown,
    validBlockIds: ReadonlySet<StudyBlockId>,
  ): item is WeeklyPlanItem {
    if (!this.isRecord(item)) {
      return false;
    }

    const planItem = item as Partial<WeeklyPlanItem>;
    return (
      this.isString(planItem.id) &&
      this.isString(planItem.weekStartDate) &&
      this.isIntInRange(planItem.dayOfWeek, 1, 7) &&
      this.isString(planItem.topicId) &&
      this.isValidBlockId(planItem.blockId, validBlockIds) &&
      this.isFiniteNumber(planItem.order) &&
      typeof planItem.completed === 'boolean'
    );
  }

  private isValidCaseStudy(
    item: unknown,
    validBlockIds: ReadonlySet<StudyBlockId>,
  ): item is CaseStudy {
    if (!this.isRecord(item)) {
      return false;
    }
    const cs = item as Partial<CaseStudy>;
    return (
      this.isString(cs.id) &&
      this.isValidBlockId(cs.blockId, validBlockIds) &&
      this.isString(cs.title) &&
      this.isString(cs.statement) &&
      Array.isArray(cs.tags) &&
      this.isString(cs.createdAt) &&
      this.isString(cs.updatedAt)
    );
  }

  private isValidQuestion(
    item: unknown,
    validBlockIds: ReadonlySet<StudyBlockId>,
  ): item is Question {
    if (!this.isRecord(item)) {
      return false;
    }
    const q = item as Partial<Question>;
    return (
      this.isString(q.id) &&
      this.isValidBlockId(q.blockId, validBlockIds) &&
      this.isString(q.prompt) &&
      Array.isArray(q.options) &&
      q.options.length === 4 &&
      q.options.every((opt) => typeof opt === 'string') &&
      this.isIntInRange(q.correctIndex, 0, 3) &&
      typeof q.flagged === 'boolean' &&
      Array.isArray(q.tags) &&
      !!q.stats &&
      this.isFiniteNumber(q.stats.attempts, 0) &&
      this.isFiniteNumber(q.stats.correct, 0) &&
      this.isString(q.createdAt) &&
      this.isString(q.updatedAt)
    );
  }

  private isValidExamAnswer(item: unknown): item is ExamAnswer {
    if (!this.isRecord(item)) {
      return false;
    }
    const ans = item as Partial<ExamAnswer>;
    const validSelected =
      ans.selectedIndex === null || this.isIntInRange(ans.selectedIndex, 0, 3);
    return (
      this.isString(ans.questionId) &&
      this.isNonEmptyString(ans.blockId) &&
      validSelected &&
      this.isIntInRange(ans.correctIndex, 0, 3) &&
      typeof ans.isCorrect === 'boolean'
    );
  }

  private isValidExamAttempt(item: unknown): item is ExamAttempt {
    if (!this.isRecord(item)) {
      return false;
    }
    const a = item as Partial<ExamAttempt>;
    return (
      this.isString(a.id) &&
      this.isString(a.title) &&
      this.isString(a.date) &&
      typeof a.mode === 'string' &&
      VALID_EXAM_MODES.has(a.mode as ExamMode) &&
      this.isFiniteNumber(a.penaltyRatio) &&
      Array.isArray(a.answers) &&
      a.answers.every((ans) => this.isValidExamAnswer(ans)) &&
      this.isFiniteNumber(a.correctCount) &&
      this.isFiniteNumber(a.wrongCount) &&
      this.isFiniteNumber(a.blankCount) &&
      this.isFiniteNumber(a.netScore) &&
      this.isFiniteNumber(a.maxScore) &&
      this.isFiniteNumber(a.scoreOn10) &&
      this.isFiniteNumber(a.durationSec, 0)
    );
  }

  private isValidFlashcard(
    item: unknown,
    validBlockIds: ReadonlySet<StudyBlockId>,
  ): item is Flashcard {
    if (!this.isRecord(item)) {
      return false;
    }
    const f = item as Partial<Flashcard>;
    return (
      this.isString(f.id) &&
      this.isValidBlockId(f.blockId, validBlockIds) &&
      this.isString(f.front) &&
      this.isString(f.back) &&
      this.isStringArray(f.tags) &&
      this.isValidFlashcardSrs(f.srs) &&
      this.isString(f.createdAt) &&
      this.isString(f.updatedAt)
    );
  }

  private isValidFlashcardSrs(item: unknown): item is FlashcardSrsState {
    if (!this.isRecord(item)) {
      return false;
    }
    const srs = item as Partial<FlashcardSrsState>;
    return (
      this.isFiniteNumber(srs.intervalDays, 0) &&
      this.isFiniteNumber(srs.easeFactor, 1.0) &&
      this.isFiniteNumber(srs.repetitions, 0) &&
      this.isFiniteNumber(srs.lapses, 0) &&
      this.isString(srs.dueDate)
    );
  }

  private isValidGamificationProfile(item: unknown): item is GamificationProfile {
    if (!this.isRecord(item)) {
      return false;
    }
    const p = item as Partial<GamificationProfile>;
    return (
      p.id === 'local-user' &&
      this.isFiniteNumber(p.xp, 0) &&
      this.isFiniteNumber(p.streakDays, 0) &&
      this.isFiniteNumber(p.longestStreakDays, 0) &&
      this.isFiniteNumber(p.streakFreezes, 0) &&
      this.isFiniteNumber(p.maxStreakFreezes, 1) &&
      Array.isArray(p.weeklyRestDays) &&
      p.weeklyRestDays.every((d) => this.isIntInRange(d, 0, 6)) &&
      this.isStringArray(p.activeDates) &&
      this.isStringArray(p.freezeUsedDates) &&
      this.isStringArray(p.claimedMissionIds) &&
      this.isString(p.updatedAt)
    );
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  private isString(value: unknown): value is string {
    return typeof value === 'string';
  }

  private isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
  }

  private isStringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every((item) => typeof item === 'string');
  }

  private isFiniteNumber(value: unknown, min = -Infinity): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value >= min;
  }

  private isIntInRange(value: unknown, min: number, max: number): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
  }

  private isValidBlockId(
    value: unknown,
    validBlockIds: ReadonlySet<StudyBlockId>,
  ): value is StudyBlockId {
    return typeof value === 'string' && validBlockIds.has(value);
  }

  private readLastBackupDate(): string | null {
    try {
      return (
        localStorage.getItem(LAST_BACKUP_STORAGE_KEY) ??
        localStorage.getItem(LEGACY_LAST_BACKUP_STORAGE_KEY)
      );
    } catch {
      return null;
    }
  }

  private saveLastBackupDate(isoDate: string): void {
    this.lastBackupAt.set(isoDate);
    try {
      localStorage.setItem(LAST_BACKUP_STORAGE_KEY, isoDate);
    } catch {
      // Ignore storage write errors.
    }
  }
}
