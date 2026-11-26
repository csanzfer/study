import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { StudyDatabase } from '../db/study.db';
import { StudyBlock, SyncMetaEntry, SyncOutboxEntry } from '../models/study.models';
import { IndexedDbStudyRepository } from '../repositories/study.repository';
import { SyncingStudyRepository } from '../repositories/syncing-study.repository';
import { StudyStoreService } from './study-store.service';
import { SupabaseAuthService } from './supabase-auth.service';
import { SupabaseClientService } from './supabase-client.service';
import { SupabaseSyncService } from './supabase-sync.service';

class InMemoryTable<T extends { id?: string; key?: string }> {
  readonly store = new Map<string, T>();

  constructor(private readonly pkField: 'id' | 'key' = 'id') {}

  async get(pk: string): Promise<T | undefined> {
    return this.store.get(pk);
  }

  async bulkGet(pks: string[]): Promise<Array<T | undefined>> {
    return pks.map((pk) => this.store.get(pk));
  }

  async put(item: T): Promise<void> {
    const pk = String(item[this.pkField]);
    this.store.set(pk, item);
  }

  async bulkPut(items: T[]): Promise<void> {
    for (const item of items) {
      await this.put(item);
    }
  }

  async delete(pk: string): Promise<void> {
    this.store.delete(pk);
  }

  async bulkDelete(pks: string[]): Promise<void> {
    for (const pk of pks) {
      this.store.delete(pk);
    }
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  async toArray(): Promise<T[]> {
    return Array.from(this.store.values());
  }

  async count(): Promise<number> {
    return this.store.size;
  }
}

describe('SupabaseSyncService', () => {
  const userId = 'user-111';

  function createHarness(mockSupabaseClient: SupabaseClient) {
    const blocks = new InMemoryTable<StudyBlock>('id');
    const topics = new InMemoryTable<{ id: string; updatedAt?: string }>('id');
    const studySessions = new InMemoryTable<{ id: string; updatedAt?: string }>('id');
    const weeklyPlanItems = new InMemoryTable<{ id: string; updatedAt?: string }>('id');
    const caseStudies = new InMemoryTable<{ id: string; updatedAt?: string }>('id');
    const questions = new InMemoryTable<{ id: string; updatedAt?: string }>('id');
    const examAttempts = new InMemoryTable<{ id: string; updatedAt?: string }>('id');
    const flashcards = new InMemoryTable<{ id: string; updatedAt?: string }>('id');
    const gamification = new InMemoryTable<{ id: string; updatedAt?: string }>('id');
    const syncOutbox = new InMemoryTable<SyncOutboxEntry>('key');
    const syncMeta = new InMemoryTable<SyncMetaEntry>('key');

    const dbMock = {
      blocks,
      topics,
      studySessions,
      weeklyPlanItems,
      caseStudies,
      questions,
      examAttempts,
      flashcards,
      gamification,
      syncOutbox,
      syncMeta,
      transaction: async (_mode: string, _tables: unknown, cb: () => Promise<void>) => cb(),
    };

    const userIdSig = signal<string | null>(userId);
    const isAuthSig = signal(true);
    const authMock = {
      userId: userIdSig,
      isAuthenticated: isAuthSig,
      signOut: vi.fn().mockImplementation(async () => {
        userIdSig.set(null);
        isAuthSig.set(false);
        return { error: null };
      }),
    };

    const localRepoMock = {
      replaceAllData: vi.fn().mockImplementation(async () => {
        await blocks.clear();
        await topics.clear();
      }),
    };

    const syncingRepoMock = {
      onLocalMutation: vi.fn().mockReturnValue(() => undefined),
    };

    const storeMock = {
      refresh: vi.fn().mockResolvedValue(undefined),
    };

    TestBed.configureTestingModule({
      providers: [
        SupabaseSyncService,
        {
          provide: SupabaseClientService,
          useValue: { client: mockSupabaseClient, isConfigured: true },
        },
        { provide: SupabaseAuthService, useValue: authMock },
        { provide: StudyDatabase, useValue: dbMock },
        { provide: IndexedDbStudyRepository, useValue: localRepoMock },
        { provide: SyncingStudyRepository, useValue: syncingRepoMock },
        { provide: StudyStoreService, useValue: storeMock },
      ],
    });

    const service = TestBed.inject(SupabaseSyncService);
    return {
      service,
      blocks,
      syncOutbox,
      syncMeta,
      authMock,
      localRepoMock,
      storeMock,
    };
  }

  function createSelectQuery(rowsByRange: (from: number, to: number) => unknown[]) {
    let rangeFrom = 0;
    let rangeTo = 499;
    const chain = {
      eq: () => chain,
      order: () => chain,
      gt: () => chain,
      range: (from: number, to: number) => {
        rangeFrom = from;
        rangeTo = to;
        return chain;
      },
      then: (resolve: (val: { data: unknown[]; error: null }) => void) =>
        resolve({ data: rowsByRange(rangeFrom, rangeTo), error: null }),
    };
    return chain;
  }

  it('preserves concurrent outbox edits made while an upsert is in flight', async () => {
    let simulateConcurrentEdit: (() => Promise<void>) | null = null;

    const mockClient = {
      from: (table: string) => ({
        upsert: vi.fn().mockImplementation(async () => {
          if (table === 'study_blocks' && simulateConcurrentEdit) {
            await simulateConcurrentEdit();
          }
          return { error: null };
        }),
        select: () => createSelectQuery(() => []),
      }),
    } as unknown as SupabaseClient;

    const { service, blocks, syncOutbox, syncMeta } = createHarness(mockClient);
    await syncMeta.put({ key: 'userId', value: userId });
    await syncMeta.put({ key: 'initialSyncedUserId', value: userId });

    await blocks.put({
      id: 'b1',
      code: 'B1',
      title: 'v1',
      shortTitle: 'v1',
      description: '',
      color: '#0891b2',
      icon: 'menu_book',
      order: 0,
      updatedAt: '2026-11-26T10:00:00.000Z',
    });
    await syncOutbox.put({
      key: 'blocks:b1',
      entityType: 'blocks',
      entityId: 'b1',
      operation: 'upsert',
      updatedAt: '2026-11-26T10:00:00.000Z',
    });

    simulateConcurrentEdit = async () => {
      // Simula que el usuario editó el mismo bloque mientras el upsert v1 estaba en vuelo
      await syncOutbox.put({
        key: 'blocks:b1',
        entityType: 'blocks',
        entityId: 'b1',
        operation: 'upsert',
        updatedAt: '2026-11-26T10:00:05.000Z',
      });
    };

    const ok = await service.syncNow();
    expect(ok).toBe(true);
    // La entrada más nueva NO debe haberse borrado
    const remaining = await syncOutbox.get('blocks:b1');
    expect(remaining?.updatedAt).toBe('2026-11-26T10:00:05.000Z');
  });

  it('paginates pullDelta beyond 500 rows and applies LWW + soft-deletes', async () => {
    const allBlockRows = Array.from({ length: 502 }, (_, index) => ({
      user_id: userId,
      id: `b-${index}`,
      code: `B${index}`,
      title: `Remote ${index}`,
      short_title: `R${index}`,
      description: '',
      color: '#0891b2',
      icon: 'menu_book',
      order: index,
      updated_at: '2026-11-26T12:00:00.000Z',
      server_updated_at: `2026-11-26T12:00:${String(index % 60).padStart(2, '0')}.000Z`,
      deleted_at: index === 501 ? '2026-11-26T12:00:00.000Z' : null,
    }));

    const mockClient = {
      from: (table: string) => ({
        select: () =>
          createSelectQuery((from, to) =>
            table === 'study_blocks' ? allBlockRows.slice(from, to + 1) : [],
          ),
      }),
    } as unknown as SupabaseClient;

    const { service, blocks, syncMeta, storeMock } = createHarness(mockClient);
    await syncMeta.put({ key: 'userId', value: userId });
    await syncMeta.put({ key: 'initialSyncedUserId', value: userId });

    // Local b-0 es más reciente que remoto (no debe ser sobrescrito)
    await blocks.put({
      id: 'b-0',
      code: 'B0',
      title: 'Local Newer',
      shortTitle: 'LN',
      description: '',
      color: '#0891b2',
      icon: 'menu_book',
      order: 0,
      updatedAt: '2026-11-26T15:00:00.000Z',
    });
    // Local b-501 existe y remoto viene con deleted_at más nuevo (debe borrarse)
    await blocks.put({
      id: 'b-501',
      code: 'B501',
      title: 'To delete',
      shortTitle: 'TD',
      description: '',
      color: '#0891b2',
      icon: 'menu_book',
      order: 501,
      updatedAt: '2026-11-26T10:00:00.000Z',
    });

    const ok = await service.syncNow();
    expect(ok).toBe(true);
    expect(await blocks.count()).toBe(501); // 0..500 presentes, 501 borrado
    expect((await blocks.get('b-0'))?.title).toBe('Local Newer');
    expect((await blocks.get('b-500'))?.title).toBe('Remote 500');
    expect(await blocks.get('b-501')).toBeUndefined();
    expect(storeMock.refresh).toHaveBeenCalledTimes(1);
  });

  it('aborts syncNow without merging if local data belongs to a different user', async () => {
    const mockClient = {
      from: vi.fn(),
    } as unknown as SupabaseClient;

    const { service, syncMeta } = createHarness(mockClient);
    await syncMeta.put({ key: 'userId', value: 'other-user-999' });

    const ok = await service.syncNow();
    expect(ok).toBe(false);
    expect(service.status()).toBe('error');
    expect(service.lastError()).toContain('otra cuenta');
    expect(mockClient.from).not.toHaveBeenCalled();
    expect((await syncMeta.get('userId'))?.value).toBe('other-user-999');
  });

  it('cleans outbox, metadata and optionally local data on signOutAndCleanup', async () => {
    const mockClient = { from: vi.fn() } as unknown as SupabaseClient;
    const { service, syncOutbox, syncMeta, authMock, localRepoMock, storeMock } =
      createHarness(mockClient);

    await syncMeta.put({ key: 'userId', value: userId });
    await syncMeta.put({ key: 'initialSyncedUserId', value: userId });
    await syncOutbox.put({
      key: 'blocks:b1',
      entityType: 'blocks',
      entityId: 'b1',
      operation: 'upsert',
      updatedAt: '2026-11-26T10:00:00.000Z',
    });

    await service.signOutAndCleanup(true);

    expect(await syncOutbox.count()).toBe(0);
    expect(await syncMeta.count()).toBe(0);
    expect(localRepoMock.replaceAllData).toHaveBeenCalledTimes(1);
    expect(storeMock.refresh).toHaveBeenCalledTimes(1);
    expect(authMock.signOut).toHaveBeenCalledTimes(1);
    expect(service.status()).toBe('local_only');
  });
});
