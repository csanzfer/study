import { Injectable, inject, signal } from '@angular/core';
import { TAI_BLOCKS_SEED } from '../db/tai-seed';
import {
  BackupPayload,
  CaseStudy,
  ExamAnswer,
  ExamAttempt,
  ExamMode,
  Question,
  StudySession,
  TaiBlockId,
  Topic,
  WeeklyPlanItem,
} from '../models/study.models';
import { STUDY_REPOSITORY } from '../repositories/study.repository';

const LAST_BACKUP_STORAGE_KEY = 'tai-study:last-backup-at';
const VALID_BLOCK_IDS = new Set<TaiBlockId>(['B1', 'B2', 'B3', 'B4']);
const VALID_EXAM_MODES = new Set<ExamMode>(['practice', 'simulation', 'mistakes', 'case_study']);

export interface BackupImportResult {
  blocksCount: number;
  topicsCount: number;
  sessionsCount: number;
  weeklyPlanItemsCount: number;
  caseStudiesCount: number;
  questionsCount: number;
  examAttemptsCount: number;
}

@Injectable({ providedIn: 'root' })
export class BackupService {
  private readonly repository = inject(STUDY_REPOSITORY);
  readonly lastBackupAt = signal<string | null>(this.readLastBackupDate());

  async createBackupPayload(): Promise<BackupPayload> {
    const [blocks, topics, studySessions, weeklyPlanItems, caseStudies, questions, examAttempts] =
      await Promise.all([
        this.repository.getBlocks(),
        this.repository.getTopics(),
        this.repository.getStudySessions(),
        this.repository.getWeeklyPlanItems(),
        this.repository.getCaseStudies(),
        this.repository.getQuestions(),
        this.repository.getExamAttempts(),
      ]);

    return {
      schemaVersion: 3,
      appName: 'tai-study',
      exportedAt: new Date().toISOString(),
      blocks: blocks.length > 0 ? blocks : TAI_BLOCKS_SEED,
      topics,
      studySessions,
      weeklyPlanItems,
      caseStudies,
      questions,
      examAttempts,
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
    anchor.download = `tai-study-backup-${dateStamp}.json`;
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
      candidate.appName !== 'tai-study' ||
      (candidate.schemaVersion !== 1 &&
        candidate.schemaVersion !== 2 &&
        candidate.schemaVersion !== 3)
    ) {
      throw new Error(
        'Este archivo no corresponde a un backup compatible de TAI Study (v1/v2/v3).',
      );
    }

    if (!Array.isArray(candidate.blocks) || !Array.isArray(candidate.topics)) {
      throw new Error('Faltan las colecciones de bloques o temas en el backup.');
    }

    const validTopics = candidate.topics.every((topic) => this.isValidTopic(topic));
    if (!validTopics) {
      throw new Error('Algunos temas del backup tienen una estructura incompleta o corrupta.');
    }

    let studySessions: StudySession[] = [];
    let weeklyPlanItems: WeeklyPlanItem[] = [];
    let caseStudies: CaseStudy[] = [];
    let questions: Question[] = [];
    let examAttempts: ExamAttempt[] = [];

    if (candidate.studySessions !== undefined) {
      if (
        !Array.isArray(candidate.studySessions) ||
        !candidate.studySessions.every((session) => this.isValidStudySession(session))
      ) {
        throw new Error('Algunas sesiones de estudio del backup tienen una estructura inválida.');
      }
      studySessions = candidate.studySessions;
    }

    if (candidate.weeklyPlanItems !== undefined) {
      if (
        !Array.isArray(candidate.weeklyPlanItems) ||
        !candidate.weeklyPlanItems.every((item) => this.isValidWeeklyPlanItem(item))
      ) {
        throw new Error('Algunos elementos del plan semanal del backup tienen una estructura inválida.');
      }
      weeklyPlanItems = candidate.weeklyPlanItems;
    }

    if (candidate.caseStudies !== undefined) {
      if (
        !Array.isArray(candidate.caseStudies) ||
        !candidate.caseStudies.every((cs) => this.isValidCaseStudy(cs))
      ) {
        throw new Error('Algunos supuestos prácticos del backup tienen una estructura inválida.');
      }
      caseStudies = candidate.caseStudies;
    }

    if (candidate.questions !== undefined) {
      if (
        !Array.isArray(candidate.questions) ||
        !candidate.questions.every((q) => this.isValidQuestion(q))
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

    return {
      schemaVersion: candidate.schemaVersion,
      appName: 'tai-study',
      exportedAt:
        typeof candidate.exportedAt === 'string'
          ? candidate.exportedAt
          : new Date().toISOString(),
      blocks: candidate.blocks.length > 0 ? candidate.blocks : TAI_BLOCKS_SEED,
      topics: candidate.topics,
      studySessions,
      weeklyPlanItems,
      caseStudies,
      questions,
      examAttempts,
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

    await this.repository.replaceAllData(
      payload.blocks,
      payload.topics,
      sessions,
      planItems,
      caseStudies,
      questions,
      examAttempts,
    );
    return {
      blocksCount: payload.blocks.length,
      topicsCount: payload.topics.length,
      sessionsCount: sessions.length,
      weeklyPlanItemsCount: planItems.length,
      caseStudiesCount: caseStudies.length,
      questionsCount: questions.length,
      examAttemptsCount: examAttempts.length,
    };
  }

  private isValidTopic(item: unknown): item is Topic {
    if (!item || typeof item !== 'object') {
      return false;
    }

    const topic = item as Partial<Topic>;
    return (
      typeof topic.id === 'string' &&
      typeof topic.title === 'string' &&
      typeof topic.blockId === 'string' &&
      VALID_BLOCK_IDS.has(topic.blockId as TaiBlockId) &&
      typeof topic.order === 'number' &&
      typeof topic.status === 'string' &&
      Array.isArray(topic.tags)
    );
  }

  private isValidStudySession(item: unknown): item is StudySession {
    if (!item || typeof item !== 'object') {
      return false;
    }

    const session = item as Partial<StudySession>;
    return (
      typeof session.id === 'string' &&
      typeof session.topicId === 'string' &&
      typeof session.blockId === 'string' &&
      VALID_BLOCK_IDS.has(session.blockId as TaiBlockId) &&
      typeof session.startedAt === 'string' &&
      typeof session.endedAt === 'string' &&
      typeof session.durationMinutes === 'number' &&
      Number.isFinite(session.durationMinutes) &&
      session.durationMinutes > 0 &&
      typeof session.type === 'string'
    );
  }

  private isValidWeeklyPlanItem(item: unknown): item is WeeklyPlanItem {
    if (!item || typeof item !== 'object') {
      return false;
    }

    const planItem = item as Partial<WeeklyPlanItem>;
    return (
      typeof planItem.id === 'string' &&
      typeof planItem.weekStartDate === 'string' &&
      typeof planItem.dayOfWeek === 'number' &&
      Number.isInteger(planItem.dayOfWeek) &&
      planItem.dayOfWeek >= 1 &&
      planItem.dayOfWeek <= 7 &&
      typeof planItem.topicId === 'string' &&
      typeof planItem.blockId === 'string' &&
      VALID_BLOCK_IDS.has(planItem.blockId as TaiBlockId) &&
      typeof planItem.order === 'number' &&
      Number.isFinite(planItem.order) &&
      typeof planItem.completed === 'boolean'
    );
  }

  private isValidCaseStudy(item: unknown): item is CaseStudy {
    if (!item || typeof item !== 'object') {
      return false;
    }
    const cs = item as Partial<CaseStudy>;
    return (
      typeof cs.id === 'string' &&
      typeof cs.blockId === 'string' &&
      VALID_BLOCK_IDS.has(cs.blockId as TaiBlockId) &&
      typeof cs.title === 'string' &&
      typeof cs.statement === 'string' &&
      Array.isArray(cs.tags) &&
      typeof cs.createdAt === 'string' &&
      typeof cs.updatedAt === 'string'
    );
  }

  private isValidQuestion(item: unknown): item is Question {
    if (!item || typeof item !== 'object') {
      return false;
    }
    const q = item as Partial<Question>;
    return (
      typeof q.id === 'string' &&
      typeof q.blockId === 'string' &&
      VALID_BLOCK_IDS.has(q.blockId as TaiBlockId) &&
      typeof q.prompt === 'string' &&
      Array.isArray(q.options) &&
      q.options.length === 4 &&
      q.options.every((opt) => typeof opt === 'string') &&
      typeof q.correctIndex === 'number' &&
      Number.isInteger(q.correctIndex) &&
      q.correctIndex >= 0 &&
      q.correctIndex <= 3 &&
      typeof q.flagged === 'boolean' &&
      Array.isArray(q.tags) &&
      !!q.stats &&
      typeof q.stats.attempts === 'number' &&
      Number.isFinite(q.stats.attempts) &&
      q.stats.attempts >= 0 &&
      typeof q.stats.correct === 'number' &&
      Number.isFinite(q.stats.correct) &&
      q.stats.correct >= 0 &&
      typeof q.createdAt === 'string' &&
      typeof q.updatedAt === 'string'
    );
  }

  private isValidExamAnswer(item: unknown): item is ExamAnswer {
    if (!item || typeof item !== 'object') {
      return false;
    }
    const ans = item as Partial<ExamAnswer>;
    const validSelected =
      ans.selectedIndex === null ||
      (typeof ans.selectedIndex === 'number' &&
        Number.isInteger(ans.selectedIndex) &&
        ans.selectedIndex >= 0 &&
        ans.selectedIndex <= 3);
    return (
      typeof ans.questionId === 'string' &&
      typeof ans.blockId === 'string' &&
      VALID_BLOCK_IDS.has(ans.blockId as TaiBlockId) &&
      validSelected &&
      typeof ans.correctIndex === 'number' &&
      Number.isInteger(ans.correctIndex) &&
      ans.correctIndex >= 0 &&
      ans.correctIndex <= 3 &&
      typeof ans.isCorrect === 'boolean'
    );
  }

  private isValidExamAttempt(item: unknown): item is ExamAttempt {
    if (!item || typeof item !== 'object') {
      return false;
    }
    const a = item as Partial<ExamAttempt>;
    return (
      typeof a.id === 'string' &&
      typeof a.title === 'string' &&
      typeof a.date === 'string' &&
      typeof a.mode === 'string' &&
      VALID_EXAM_MODES.has(a.mode as ExamMode) &&
      typeof a.penaltyRatio === 'number' &&
      Number.isFinite(a.penaltyRatio) &&
      Array.isArray(a.answers) &&
      a.answers.every((ans) => this.isValidExamAnswer(ans)) &&
      typeof a.correctCount === 'number' &&
      Number.isFinite(a.correctCount) &&
      typeof a.wrongCount === 'number' &&
      Number.isFinite(a.wrongCount) &&
      typeof a.blankCount === 'number' &&
      Number.isFinite(a.blankCount) &&
      typeof a.netScore === 'number' &&
      Number.isFinite(a.netScore) &&
      typeof a.maxScore === 'number' &&
      Number.isFinite(a.maxScore) &&
      typeof a.scoreOn10 === 'number' &&
      Number.isFinite(a.scoreOn10) &&
      typeof a.durationSec === 'number' &&
      Number.isFinite(a.durationSec) &&
      a.durationSec >= 0
    );
  }

  private readLastBackupDate(): string | null {
    try {
      return localStorage.getItem(LAST_BACKUP_STORAGE_KEY);
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
