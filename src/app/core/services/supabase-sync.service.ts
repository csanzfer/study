import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { SupabaseClient } from '@supabase/supabase-js';
import { StudyDatabase } from '../db/study.db';
import {
  InitialSyncStrategy,
  SyncEntityType,
  SyncOutboxEntry,
  SyncStatus,
  createDefaultGamificationProfile,
} from '../models/study.models';
import { IndexedDbStudyRepository } from '../repositories/study.repository';
import { SyncingStudyRepository } from '../repositories/syncing-study.repository';
import {
  ALL_SYNC_ENTITY_TYPES,
  SYNC_ENTITY_TABLE_MAP,
  SupabaseSyncRow,
  blockToRow,
  caseStudyToRow,
  examAttemptToRow,
  flashcardToRow,
  gamificationToRow,
  isRemoteNewer,
  questionToRow,
  rowToBlock,
  rowToCaseStudy,
  rowToExamAttempt,
  rowToFlashcard,
  rowToGamification,
  rowToQuestion,
  rowToStudySession,
  rowToTopic,
  rowToWeeklyPlanItem,
  studySessionToRow,
  topicToRow,
  weeklyPlanItemToRow,
} from '../utils/supabase-sync-mapper.util';
import { StudyStoreService } from './study-store.service';
import { SupabaseAuthService } from './supabase-auth.service';
import { SupabaseClientService } from './supabase-client.service';

const META_LAST_PULLED_AT = 'lastPulledAt';
const META_USER_ID = 'userId';
const META_INITIAL_SYNCED = 'initialSyncedUserId';
const PUSH_DEBOUNCE_MS = 1500;
const BATCH_SIZE = 100;

export interface InitialSyncAssessment {
  isDifferentUser: boolean;
  previousUserId: string | null;
  hasLocalData: boolean;
  hasCloudData: boolean;
  localTopicCount: number;
  localBlockCount: number;
  cloudTopicCount: number;
  cloudBlockCount: number;
}

@Injectable({ providedIn: 'root' })
export class SupabaseSyncService {
  private readonly supabase = inject(SupabaseClientService);
  private readonly auth = inject(SupabaseAuthService);
  private readonly db = inject(StudyDatabase);
  private readonly localRepo = inject(IndexedDbStudyRepository);
  private readonly syncingRepo = inject(SyncingStudyRepository);
  private readonly store = inject(StudyStoreService);
  private readonly destroyRef = inject(DestroyRef);

  readonly status = signal<SyncStatus>('local_only');
  readonly lastSyncedAt = signal<string | null>(null);
  readonly pendingCount = signal(0);
  readonly lastError = signal<string | null>(null);
  readonly isOnline = signal(typeof navigator !== 'undefined' ? navigator.onLine : true);

  private pushTimer: ReturnType<typeof setTimeout> | null = null;
  private syncInFlight: Promise<boolean> | null = null;
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    this.initialized = true;

    const unsubMutation = this.syncingRepo.onLocalMutation(() => {
      void this.refreshPendingCount();
      this.schedulePush();
    });
    this.destroyRef.onDestroy(unsubMutation);

    if (typeof window !== 'undefined') {
      const handleOnline = () => {
        this.isOnline.set(true);
        if (this.auth.isAuthenticated()) {
          void this.syncNow();
        }
      };
      const handleOffline = () => {
        this.isOnline.set(false);
        if (this.auth.isAuthenticated()) {
          this.status.set('offline_pending');
        }
      };
      const handleVisibility = () => {
        if (document.visibilityState === 'visible' && this.auth.isAuthenticated() && this.isOnline()) {
          void this.syncNow();
        }
      };

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      document.addEventListener('visibilitychange', handleVisibility);

      this.destroyRef.onDestroy(() => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        document.removeEventListener('visibilitychange', handleVisibility);
        if (this.pushTimer) {
          clearTimeout(this.pushTimer);
          this.pushTimer = null;
        }
      });
    }

    await this.refreshPendingCount();
    const lastPulled = await this.getMeta(META_LAST_PULLED_AT);
    if (lastPulled) {
      this.lastSyncedAt.set(lastPulled);
    }

    if (this.auth.isAuthenticated()) {
      const storedUserId = await this.getMeta(META_USER_ID);
      const currentUserId = this.auth.userId();
      if (currentUserId && storedUserId === currentUserId) {
        this.status.set(this.isOnline() ? 'idle' : 'offline_pending');
        if (this.isOnline()) {
          void this.syncNow();
        }
      } else {
        this.status.set('idle');
      }
    } else {
      this.status.set('local_only');
    }
  }

  async assessInitialSync(userId: string): Promise<InitialSyncAssessment> {
    const client = this.supabase.client;
    const previousUserId = await this.getMeta(META_USER_ID);
    const isDifferentUser = Boolean(previousUserId && previousUserId !== userId);

    const [
      localBlockCount,
      localTopicCount,
      localQuestionCount,
      localFlashcardCount,
      localSessionCount,
    ] = await Promise.all([
      this.db.blocks.count(),
      this.db.topics.count(),
      this.db.questions.count(),
      this.db.flashcards.count(),
      this.db.studySessions.count(),
    ]);

    const hasLocalData =
      localBlockCount +
        localTopicCount +
        localQuestionCount +
        localFlashcardCount +
        localSessionCount >
      0;

    let cloudBlockCount = 0;
    let cloudTopicCount = 0;
    let cloudOtherCount = 0;

    if (client) {
      const [blocksRes, topicsRes, questionsRes, flashcardsRes] = await Promise.all([
        client
          .from('study_blocks')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .is('deleted_at', null),
        client
          .from('topics')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .is('deleted_at', null),
        client
          .from('questions')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .is('deleted_at', null),
        client
          .from('flashcards')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .is('deleted_at', null),
      ]);

      if (blocksRes.error) throw blocksRes.error;
      if (topicsRes.error) throw topicsRes.error;

      cloudBlockCount = blocksRes.count ?? 0;
      cloudTopicCount = topicsRes.count ?? 0;
      cloudOtherCount = (questionsRes.count ?? 0) + (flashcardsRes.count ?? 0);
    }

    return {
      isDifferentUser,
      previousUserId,
      hasLocalData,
      hasCloudData: cloudBlockCount + cloudTopicCount + cloudOtherCount > 0,
      localTopicCount,
      localBlockCount,
      cloudTopicCount,
      cloudBlockCount,
    };
  }

  async executeInitialSync(strategy: InitialSyncStrategy): Promise<boolean> {
    const client = this.supabase.client;
    const userId = this.auth.userId();
    if (!client || !userId) {
      return false;
    }

    this.status.set('syncing');
    this.lastError.set(null);

    try {
      await this.setMeta(META_USER_ID, userId);

      if (strategy === 'use_cloud') {
        await this.db.syncOutbox.clear();
        await this.deleteMeta(META_LAST_PULLED_AT);
        await this.localRepo.replaceAllData(
          [],
          [],
          [],
          [],
          [],
          [],
          [],
          [],
          createDefaultGamificationProfile(),
        );
        const maxServerTs = await this.pullFromCloud(client, userId, null);
        if (maxServerTs) {
          await this.setMeta(META_LAST_PULLED_AT, maxServerTs);
        }
        await this.setMeta(META_INITIAL_SYNCED, userId);
        this.lastSyncedAt.set(new Date().toISOString());
        await this.store.refresh();
      } else if (strategy === 'upload_local') {
        await this.db.syncOutbox.clear();
        await this.deleteMeta(META_LAST_PULLED_AT);
        await this.softDeleteAllCloudData(client, userId);
        await this.pushAllLocalData(client, userId);
        await this.setMeta(META_INITIAL_SYNCED, userId);
        this.lastSyncedAt.set(new Date().toISOString());
      } else {
        // merge (Last-Write-Wins): primero bajamos deltas de la nube (LWW) y luego subimos todo local
        await this.db.syncOutbox.clear();
        const maxServerTs = await this.pullFromCloud(client, userId, null);
        await this.pushAllLocalData(client, userId);
        if (maxServerTs) {
          await this.setMeta(META_LAST_PULLED_AT, maxServerTs);
        }
        await this.setMeta(META_INITIAL_SYNCED, userId);
        this.lastSyncedAt.set(new Date().toISOString());
        await this.store.refresh();
      }

      await this.refreshPendingCount();
      this.status.set('idle');
      return true;
    } catch (err) {
      this.lastError.set(this.formatError(err));
      this.status.set('error');
      return false;
    }
  }

  schedulePush(): void {
    if (!this.auth.isAuthenticated()) {
      return;
    }
    if (!this.isOnline()) {
      this.status.set('offline_pending');
      return;
    }
    if (this.pushTimer) {
      clearTimeout(this.pushTimer);
    }
    this.pushTimer = setTimeout(() => {
      this.pushTimer = null;
      void this.syncNow();
    }, PUSH_DEBOUNCE_MS);
  }

  async syncNow(): Promise<boolean> {
    const client = this.supabase.client;
    const userId = this.auth.userId();

    if (!client || !userId) {
      this.status.set('local_only');
      return false;
    }

    if (!this.isOnline()) {
      await this.refreshPendingCount();
      this.status.set('offline_pending');
      return false;
    }

    if (this.syncInFlight) {
      return this.syncInFlight;
    }

    this.syncInFlight = this.runSyncCycle(client, userId).finally(() => {
      this.syncInFlight = null;
    });
    return this.syncInFlight;
  }

  async signOutAndCleanup(clearLocalData: boolean): Promise<void> {
    if (this.pushTimer) {
      clearTimeout(this.pushTimer);
      this.pushTimer = null;
    }

    await this.db.syncOutbox.clear();
    await this.deleteMeta(META_LAST_PULLED_AT);
    await this.deleteMeta(META_USER_ID);
    await this.deleteMeta(META_INITIAL_SYNCED);

    if (clearLocalData) {
      await this.localRepo.replaceAllData(
        [],
        [],
        [],
        [],
        [],
        [],
        [],
        [],
        createDefaultGamificationProfile(),
      );
      await this.store.refresh();
    }

    await this.auth.signOut();
    this.pendingCount.set(0);
    this.lastSyncedAt.set(null);
    this.lastError.set(null);
    this.status.set('local_only');
  }

  private async runSyncCycle(client: SupabaseClient, userId: string): Promise<boolean> {
    this.status.set('syncing');
    this.lastError.set(null);

    try {
      await this.setMeta(META_USER_ID, userId);

      const initialSyncedUserId = await this.getMeta(META_INITIAL_SYNCED);
      if (initialSyncedUserId !== userId) {
        // Autorrecuperación: si nunca se completó la sincronización inicial,
        // hacemos pull completo LWW + subida completa de los datos locales.
        const { maxServerUpdatedAt, appliedCount } = await this.pullDelta(client, userId, null);
        await this.pushAllLocalData(client, userId);
        await this.db.syncOutbox.clear();
        if (maxServerUpdatedAt) {
          await this.setMeta(META_LAST_PULLED_AT, maxServerUpdatedAt);
        }
        await this.setMeta(META_INITIAL_SYNCED, userId);
        this.lastSyncedAt.set(new Date().toISOString());
        if (appliedCount > 0) {
          await this.store.refresh();
        }
      } else {
        await this.pushOutbox(client, userId);

        const lastPulledAt = await this.getMeta(META_LAST_PULLED_AT);
        const { maxServerUpdatedAt, appliedCount } = await this.pullDelta(
          client,
          userId,
          lastPulledAt,
        );

        if (maxServerUpdatedAt) {
          await this.setMeta(META_LAST_PULLED_AT, maxServerUpdatedAt);
        }
        this.lastSyncedAt.set(new Date().toISOString());

        if (appliedCount > 0) {
          await this.store.refresh();
        }
      }

      await this.refreshPendingCount();
      this.status.set(this.pendingCount() > 0 && !this.isOnline() ? 'offline_pending' : 'idle');
      return true;
    } catch (err) {
      this.lastError.set(this.formatError(err));
      this.status.set(this.isOnline() ? 'error' : 'offline_pending');
      return false;
    }
  }

  private async pushOutbox(client: SupabaseClient, userId: string): Promise<void> {
    const entries = await this.db.syncOutbox.toArray();
    if (entries.length === 0) {
      return;
    }

    const byEntity = new Map<SyncEntityType, SyncOutboxEntry[]>();
    for (const entry of entries) {
      const list = byEntity.get(entry.entityType) ?? [];
      list.push(entry);
      byEntity.set(entry.entityType, list);
    }

    const nowIso = new Date().toISOString();

    for (const [entityType, entityEntries] of byEntity.entries()) {
      const tableName = SYNC_ENTITY_TABLE_MAP[entityType];
      const upsertIds = entityEntries
        .filter((e) => e.operation === 'upsert')
        .map((e) => e.entityId);
      const deleteEntries = entityEntries.filter((e) => e.operation === 'delete');

      if (upsertIds.length > 0) {
        const rows = await this.loadLocalRowsForUpsert(entityType, userId, upsertIds, nowIso);
        if (rows.length > 0) {
          const onConflict = entityType === 'gamification' ? 'user_id' : 'user_id,id';
          for (const chunk of this.chunkArray(rows, BATCH_SIZE)) {
            const { error } = await client.from(tableName).upsert(chunk, { onConflict });
            if (error) throw error;
          }
        }
      }

      if (deleteEntries.length > 0 && entityType !== 'gamification') {
        const deleteIds = deleteEntries.map((e) => e.entityId);
        for (const chunk of this.chunkArray(deleteIds, BATCH_SIZE)) {
          const { error } = await client
            .from(tableName)
            .update({ deleted_at: nowIso, updated_at: nowIso })
            .eq('user_id', userId)
            .in('id', chunk);
          if (error) throw error;
        }
      }

      await this.db.syncOutbox.bulkDelete(entityEntries.map((e) => e.key));
    }
  }

  private async pushAllLocalData(client: SupabaseClient, userId: string): Promise<void> {
    const nowIso = new Date().toISOString();
    const [
      blocks,
      topics,
      studySessions,
      weeklyPlanItems,
      caseStudies,
      questions,
      examAttempts,
      flashcards,
      gamification,
    ] = await Promise.all([
      this.db.blocks.toArray(),
      this.db.topics.toArray(),
      this.db.studySessions.toArray(),
      this.db.weeklyPlanItems.toArray(),
      this.db.caseStudies.toArray(),
      this.db.questions.toArray(),
      this.db.examAttempts.toArray(),
      this.db.flashcards.toArray(),
      this.db.gamification.get('local-user'),
    ]);

    const payloads: Array<{ entityType: SyncEntityType; rows: SupabaseSyncRow[] }> = [
      { entityType: 'blocks', rows: blocks.map((b) => blockToRow(userId, b, nowIso)) },
      { entityType: 'topics', rows: topics.map((t) => topicToRow(userId, t)) },
      {
        entityType: 'studySessions',
        rows: studySessions.map((s) => studySessionToRow(userId, s, nowIso)),
      },
      {
        entityType: 'weeklyPlanItems',
        rows: weeklyPlanItems.map((w) => weeklyPlanItemToRow(userId, w, nowIso)),
      },
      { entityType: 'caseStudies', rows: caseStudies.map((c) => caseStudyToRow(userId, c)) },
      { entityType: 'questions', rows: questions.map((q) => questionToRow(userId, q)) },
      {
        entityType: 'examAttempts',
        rows: examAttempts.map((a) => examAttemptToRow(userId, a, nowIso)),
      },
      { entityType: 'flashcards', rows: flashcards.map((f) => flashcardToRow(userId, f)) },
      {
        entityType: 'gamification',
        rows: gamification ? [gamificationToRow(userId, gamification)] : [],
      },
    ];

    for (const { entityType, rows } of payloads) {
      if (rows.length === 0) continue;
      const tableName = SYNC_ENTITY_TABLE_MAP[entityType];
      const onConflict = entityType === 'gamification' ? 'user_id' : 'user_id,id';
      for (const chunk of this.chunkArray(rows, BATCH_SIZE)) {
        const { error } = await client.from(tableName).upsert(chunk, { onConflict });
        if (error) throw error;
      }
    }
  }

  private async softDeleteAllCloudData(client: SupabaseClient, userId: string): Promise<void> {
    const nowIso = new Date().toISOString();
    const softDeletableEntities = ALL_SYNC_ENTITY_TYPES.filter((e) => e !== 'gamification');
    for (const entityType of softDeletableEntities) {
      const tableName = SYNC_ENTITY_TABLE_MAP[entityType];
      const { error } = await client
        .from(tableName)
        .update({ deleted_at: nowIso, updated_at: nowIso })
        .eq('user_id', userId)
        .is('deleted_at', null);
      if (error) throw error;
    }
  }

  private async pullFromCloud(
    client: SupabaseClient,
    userId: string,
    sinceIso: string | null,
  ): Promise<string | null> {
    const { maxServerUpdatedAt } = await this.pullDelta(client, userId, sinceIso);
    return maxServerUpdatedAt;
  }

  private async pullDelta(
    client: SupabaseClient,
    userId: string,
    sinceIso: string | null,
  ): Promise<{ maxServerUpdatedAt: string | null; appliedCount: number }> {
    let maxServerUpdatedAt: string | null = sinceIso;
    let appliedCount = 0;

    for (const entityType of ALL_SYNC_ENTITY_TYPES) {
      const tableName = SYNC_ENTITY_TABLE_MAP[entityType];
      let query = client.from(tableName).select('*').eq('user_id', userId);
      if (sinceIso) {
        query = query.gt('server_updated_at', sinceIso);
      }

      const { data, error } = await query;
      if (error) throw error;

      const rows = (data ?? []) as SupabaseSyncRow[];
      if (rows.length === 0) {
        continue;
      }

      for (const row of rows) {
        const serverTs = typeof row.server_updated_at === 'string' ? row.server_updated_at : null;
        if (serverTs && (!maxServerUpdatedAt || serverTs > maxServerUpdatedAt)) {
          maxServerUpdatedAt = serverTs;
        }
      }

      appliedCount += await this.applyRemoteRowsLww(entityType, rows);
    }

    return { maxServerUpdatedAt, appliedCount };
  }

  private async applyRemoteRowsLww(
    entityType: SyncEntityType,
    rows: SupabaseSyncRow[],
  ): Promise<number> {
    let applied = 0;

    if (entityType === 'gamification') {
      const row = rows[0];
      if (!row) return 0;
      const local = await this.db.gamification.get('local-user');
      if (!local || isRemoteNewer(local.updatedAt, row.updated_at)) {
        await this.db.gamification.put(rowToGamification(row));
        return 1;
      }
      return 0;
    }

    for (const row of rows) {
      const id = String(row.id ?? '');
      if (!id) continue;

      const isDeleted = Boolean(row.deleted_at);
      const remoteUpdatedAt = row.updated_at;

      switch (entityType) {
        case 'blocks': {
          const local = await this.db.blocks.get(id);
          if (isDeleted) {
            if (local && isRemoteNewer(local.updatedAt, remoteUpdatedAt)) {
              await this.db.blocks.delete(id);
              applied++;
            }
          } else if (!local || isRemoteNewer(local.updatedAt, remoteUpdatedAt)) {
            await this.db.blocks.put(rowToBlock(row));
            applied++;
          }
          break;
        }
        case 'topics': {
          const local = await this.db.topics.get(id);
          if (isDeleted) {
            if (local && isRemoteNewer(local.updatedAt, remoteUpdatedAt)) {
              await this.db.topics.delete(id);
              applied++;
            }
          } else if (!local || isRemoteNewer(local.updatedAt, remoteUpdatedAt)) {
            await this.db.topics.put(rowToTopic(row));
            applied++;
          }
          break;
        }
        case 'studySessions': {
          const local = await this.db.studySessions.get(id);
          if (isDeleted) {
            if (local && isRemoteNewer(local.updatedAt, remoteUpdatedAt)) {
              await this.db.studySessions.delete(id);
              applied++;
            }
          } else if (!local || isRemoteNewer(local.updatedAt, remoteUpdatedAt)) {
            await this.db.studySessions.put(rowToStudySession(row));
            applied++;
          }
          break;
        }
        case 'weeklyPlanItems': {
          const local = await this.db.weeklyPlanItems.get(id);
          if (isDeleted) {
            if (local && isRemoteNewer(local.updatedAt, remoteUpdatedAt)) {
              await this.db.weeklyPlanItems.delete(id);
              applied++;
            }
          } else if (!local || isRemoteNewer(local.updatedAt, remoteUpdatedAt)) {
            await this.db.weeklyPlanItems.put(rowToWeeklyPlanItem(row));
            applied++;
          }
          break;
        }
        case 'caseStudies': {
          const local = await this.db.caseStudies.get(id);
          if (isDeleted) {
            if (local && isRemoteNewer(local.updatedAt, remoteUpdatedAt)) {
              await this.db.caseStudies.delete(id);
              applied++;
            }
          } else if (!local || isRemoteNewer(local.updatedAt, remoteUpdatedAt)) {
            await this.db.caseStudies.put(rowToCaseStudy(row));
            applied++;
          }
          break;
        }
        case 'questions': {
          const local = await this.db.questions.get(id);
          if (isDeleted) {
            if (local && isRemoteNewer(local.updatedAt, remoteUpdatedAt)) {
              await this.db.questions.delete(id);
              applied++;
            }
          } else if (!local || isRemoteNewer(local.updatedAt, remoteUpdatedAt)) {
            await this.db.questions.put(rowToQuestion(row));
            applied++;
          }
          break;
        }
        case 'examAttempts': {
          const local = await this.db.examAttempts.get(id);
          if (isDeleted) {
            if (local && isRemoteNewer(local.updatedAt, remoteUpdatedAt)) {
              await this.db.examAttempts.delete(id);
              applied++;
            }
          } else if (!local || isRemoteNewer(local.updatedAt, remoteUpdatedAt)) {
            await this.db.examAttempts.put(rowToExamAttempt(row));
            applied++;
          }
          break;
        }
        case 'flashcards': {
          const local = await this.db.flashcards.get(id);
          if (isDeleted) {
            if (local && isRemoteNewer(local.updatedAt, remoteUpdatedAt)) {
              await this.db.flashcards.delete(id);
              applied++;
            }
          } else if (!local || isRemoteNewer(local.updatedAt, remoteUpdatedAt)) {
            await this.db.flashcards.put(rowToFlashcard(row));
            applied++;
          }
          break;
        }
      }
    }

    return applied;
  }

  private async loadLocalRowsForUpsert(
    entityType: SyncEntityType,
    userId: string,
    ids: string[],
    nowIso: string,
  ): Promise<SupabaseSyncRow[]> {
    switch (entityType) {
      case 'blocks': {
        const items = (await this.db.blocks.bulkGet(ids)).filter((x): x is NonNullable<typeof x> => Boolean(x));
        return items.map((item) => blockToRow(userId, item, nowIso));
      }
      case 'topics': {
        const items = (await this.db.topics.bulkGet(ids)).filter((x): x is NonNullable<typeof x> => Boolean(x));
        return items.map((item) => topicToRow(userId, item));
      }
      case 'studySessions': {
        const items = (await this.db.studySessions.bulkGet(ids)).filter((x): x is NonNullable<typeof x> => Boolean(x));
        return items.map((item) => studySessionToRow(userId, item, nowIso));
      }
      case 'weeklyPlanItems': {
        const items = (await this.db.weeklyPlanItems.bulkGet(ids)).filter((x): x is NonNullable<typeof x> => Boolean(x));
        return items.map((item) => weeklyPlanItemToRow(userId, item, nowIso));
      }
      case 'caseStudies': {
        const items = (await this.db.caseStudies.bulkGet(ids)).filter((x): x is NonNullable<typeof x> => Boolean(x));
        return items.map((item) => caseStudyToRow(userId, item));
      }
      case 'questions': {
        const items = (await this.db.questions.bulkGet(ids)).filter((x): x is NonNullable<typeof x> => Boolean(x));
        return items.map((item) => questionToRow(userId, item));
      }
      case 'examAttempts': {
        const items = (await this.db.examAttempts.bulkGet(ids)).filter((x): x is NonNullable<typeof x> => Boolean(x));
        return items.map((item) => examAttemptToRow(userId, item, nowIso));
      }
      case 'flashcards': {
        const items = (await this.db.flashcards.bulkGet(ids)).filter((x): x is NonNullable<typeof x> => Boolean(x));
        return items.map((item) => flashcardToRow(userId, item));
      }
      case 'gamification': {
        const profile = await this.db.gamification.get('local-user');
        return profile ? [gamificationToRow(userId, profile)] : [];
      }
    }
  }

  private async refreshPendingCount(): Promise<void> {
    try {
      const count = await this.db.syncOutbox.count();
      this.pendingCount.set(count);
    } catch {
      this.pendingCount.set(0);
    }
  }

  private async getMeta(key: string): Promise<string | null> {
    const entry = await this.db.syncMeta.get(key);
    return entry?.value ?? null;
  }

  private async setMeta(key: string, value: string): Promise<void> {
    await this.db.syncMeta.put({ key, value });
  }

  private async deleteMeta(key: string): Promise<void> {
    await this.db.syncMeta.delete(key);
  }

  private chunkArray<T>(items: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
      chunks.push(items.slice(i, i + size));
    }
    return chunks;
  }

  private formatError(err: unknown): string {
    if (err instanceof Error) {
      return err.message;
    }
    if (typeof err === 'object' && err !== null && 'message' in err) {
      return String((err as { message: unknown }).message);
    }
    return 'Error al sincronizar con la nube.';
  }
}
