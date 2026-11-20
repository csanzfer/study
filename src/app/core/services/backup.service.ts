import { Injectable, inject, signal } from '@angular/core';
import { TAI_BLOCKS_SEED } from '../db/tai-seed';
import { BackupPayload, TaiBlockId, Topic } from '../models/study.models';
import { STUDY_REPOSITORY } from '../repositories/study.repository';

const LAST_BACKUP_STORAGE_KEY = 'tai-study:last-backup-at';
const VALID_BLOCK_IDS = new Set<TaiBlockId>(['B1', 'B2', 'B3', 'B4']);

@Injectable({ providedIn: 'root' })
export class BackupService {
  private readonly repository = inject(STUDY_REPOSITORY);
  readonly lastBackupAt = signal<string | null>(this.readLastBackupDate());

  async createBackupPayload(): Promise<BackupPayload> {
    const [blocks, topics] = await Promise.all([
      this.repository.getBlocks(),
      this.repository.getTopics(),
    ]);

    return {
      schemaVersion: 1,
      appName: 'tai-study',
      exportedAt: new Date().toISOString(),
      blocks: blocks.length > 0 ? blocks : TAI_BLOCKS_SEED,
      topics,
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
    if (candidate.appName !== 'tai-study' || candidate.schemaVersion !== 1) {
      throw new Error('Este archivo no corresponde a un backup compatible de TAI Study (v1).');
    }

    if (!Array.isArray(candidate.blocks) || !Array.isArray(candidate.topics)) {
      throw new Error('Faltan las colecciones de bloques o temas en el backup.');
    }

    const validTopics = candidate.topics.every((topic) => this.isValidTopic(topic));
    if (!validTopics) {
      throw new Error('Algunos temas del backup tienen una estructura incompleta o corrupta.');
    }

    return {
      schemaVersion: 1,
      appName: 'tai-study',
      exportedAt: typeof candidate.exportedAt === 'string' ? candidate.exportedAt : new Date().toISOString(),
      blocks: candidate.blocks.length > 0 ? candidate.blocks : TAI_BLOCKS_SEED,
      topics: candidate.topics,
    };
  }

  async importBackupFile(file: File): Promise<{ blocksCount: number; topicsCount: number }> {
    const rawText = await file.text();
    const payload = this.parseBackupJson(rawText);

    await this.repository.replaceAllData(payload.blocks, payload.topics);
    return {
      blocksCount: payload.blocks.length,
      topicsCount: payload.topics.length,
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
