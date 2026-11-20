import { Injectable } from '@angular/core';
import Dexie, { Table } from 'dexie';
import { TaiBlock, TaiBlockId, Topic } from '../models/study.models';
import { TAI_BLOCKS_SEED } from './tai-seed';

@Injectable({ providedIn: 'root' })
export class StudyDatabase extends Dexie {
  blocks!: Table<TaiBlock, TaiBlockId>;
  topics!: Table<Topic, string>;

  constructor() {
    super('TaiStudyDB');

    this.version(1).stores({
      blocks: 'id, order',
      topics: 'id, blockId, order, status, updatedAt, *tags',
    });
  }

  async ensureSeeded(): Promise<void> {
    const existingCount = await this.blocks.count();
    if (existingCount === 0) {
      await this.blocks.bulkPut(TAI_BLOCKS_SEED);
    }
  }

  async requestPersistentStorage(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !navigator.storage?.persist) {
      return false;
    }

    try {
      const alreadyPersisted = await navigator.storage.persisted();
      if (alreadyPersisted) {
        return true;
      }
      return await navigator.storage.persist();
    } catch {
      return false;
    }
  }
}
