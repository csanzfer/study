import { Injectable, inject, signal } from '@angular/core';
import { TAI_BLOCKS_SEED } from '../db/tai-seed';
import {
  BackupPayload,
  StudySession,
  TaiBlockId,
  Topic,
  WeeklyPlanItem,
} from '../models/study.models';
import { STUDY_REPOSITORY } from '../repositories/study.repository';

const LAST_BACKUP_STORAGE_KEY = 'tai-study:last-backup-at';
const VALID_BLOCK_IDS = new Set<TaiBlockId>(['B1', 'B2', 'B3', 'B4']);

export interface BackupImportResult {
  blocksCount: number;
  topicsCount: number;
  sessionsCount: number;
  weeklyPlanItemsCount: number;
}

@Injectable({ providedIn: 'root' })
export class BackupService {
  private readonly repository = inject(STUDY_REPOSITORY);
  readonly lastBackupAt = signal<string | null>(this.readLastBackupDate());

  async createBackupPayload(): Promise<BackupPayload> {
    const [blocks, topics, studySessions, weeklyPlanItems] = await Promise.all([
      this.repository.getBlocks(),
      this.repository.getTopics(),
      this.repository.getStudySessions(),
      this.repository.getWeeklyPlanItems(),
    ]);

    return {
      schemaVersion: 2,
      appName: 'tai-study',
      exportedAt: new Date().toISOString(),
      blocks: blocks.length > 0 ? blocks : TAI_BLOCKS_SEED,
      topics,
      studySessions,
      weeklyPlanItems,
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
      (candidate.schemaVersion !== 1 && candidate.schemaVersion !== 2)
    ) {
      throw new Error(
        'Este archivo no corresponde a un backup compatible de TAI Study (v1/v2).',
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
    };
  }

  async importBackupFile(file: File): Promise<BackupImportResult> {
    const rawText = await file.text();
    const payload = this.parseBackupJson(rawText);

    const sessions = payload.studySessions ?? [];
    const planItems = payload.weeklyPlanItems ?? [];

    await this.repository.replaceAllData(payload.blocks, payload.topics, sessions, planItems);
    return {
      blocksCount: payload.blocks.length,
      topicsCount: payload.topics.length,
      sessionsCount: sessions.length,
      weeklyPlanItemsCount: planItems.length,
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
