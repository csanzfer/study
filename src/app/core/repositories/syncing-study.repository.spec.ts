import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { StudyDatabase } from '../db/study.db';
import { StudyBlock, SyncOutboxEntry, Topic } from '../models/study.models';
import { SupabaseAuthService } from '../services/supabase-auth.service';
import { IndexedDbStudyRepository } from './study.repository';
import { SyncingStudyRepository } from './syncing-study.repository';

function createWhereMock(keysByValue: Record<string, string[]>) {
  return {
    where: () => ({
      equals: (value: string) => ({
        primaryKeys: async () => keysByValue[value] ?? [],
      }),
    }),
    toCollection: () => ({
      primaryKeys: async () => Object.values(keysByValue).flat(),
    }),
  };
}

describe('SyncingStudyRepository', () => {
  const sampleBlock: StudyBlock = {
    id: 'block-1',
    code: 'B1',
    title: 'Bloque 1',
    shortTitle: 'B1',
    description: '',
    color: '#0891b2',
    icon: 'menu_book',
    order: 0,
  };

  function setup(isAuthenticatedInitial: boolean) {
    const isAuthSig = signal(isAuthenticatedInitial);
    const outboxMap = new Map<string, SyncOutboxEntry>();

    const localRepoMock = {
      initialize: vi.fn().mockResolvedValue(undefined),
      getBlocks: vi.fn().mockResolvedValue([]),
      saveBlock: vi.fn().mockResolvedValue(undefined),
      saveBlocks: vi.fn().mockResolvedValue(undefined),
      deleteBlock: vi.fn().mockResolvedValue(undefined),
      deleteTopic: vi.fn().mockResolvedValue(undefined),
      replaceAllData: vi.fn().mockResolvedValue(undefined),
    };

    const dbMock = {
      blocks: createWhereMock({ 'block-1': ['block-1', 'block-old'] }),
      topics: createWhereMock({ 'block-1': ['topic-1'] }),
      weeklyPlanItems: createWhereMock({ 'block-1': ['plan-1'], 'topic-1': ['plan-1'] }),
      studySessions: createWhereMock({ 'block-1': ['sess-1'] }),
      caseStudies: createWhereMock({ 'block-1': [] }),
      questions: createWhereMock({ 'block-1': ['q-1'], 'topic-1': ['q-1'] }),
      examAttempts: createWhereMock({}),
      flashcards: createWhereMock({ 'block-1': ['fc-1'], 'topic-1': ['fc-1'] }),
      syncOutbox: {
        bulkPut: vi.fn().mockImplementation(async (entries: SyncOutboxEntry[]) => {
          for (const e of entries) {
            outboxMap.set(e.key, e);
          }
        }),
      },
    };

    TestBed.configureTestingModule({
      providers: [
        SyncingStudyRepository,
        { provide: IndexedDbStudyRepository, useValue: localRepoMock },
        { provide: StudyDatabase, useValue: dbMock },
        {
          provide: SupabaseAuthService,
          useValue: { isAuthenticated: isAuthSig },
        },
      ],
    });

    const repo = TestBed.inject(SyncingStudyRepository);
    return { repo, localRepoMock, dbMock, outboxMap, isAuthSig };
  }

  it('does not enqueue outbox entries when user is not authenticated', async () => {
    const { repo, localRepoMock, outboxMap } = setup(false);
    const listener = vi.fn();
    repo.onLocalMutation(listener);

    await repo.saveBlock(sampleBlock);

    expect(localRepoMock.saveBlock).toHaveBeenCalledTimes(1);
    expect(outboxMap.size).toBe(0);
    expect(listener).not.toHaveBeenCalled();
  });

  it('stamps updatedAt, enqueues upsert and notifies listeners when authenticated', async () => {
    const { repo, localRepoMock, outboxMap } = setup(true);
    const listener = vi.fn();
    repo.onLocalMutation(listener);

    await repo.saveBlock(sampleBlock);

    const savedArg = localRepoMock.saveBlock.mock.calls[0][0] as StudyBlock;
    expect(savedArg.updatedAt).toBeTruthy();
    expect(outboxMap.get('blocks:block-1')?.operation).toBe('upsert');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('enqueues cascade deletes on deleteBlock and unlinked upserts on deleteTopic', async () => {
    const { repo, outboxMap } = setup(true);

    await repo.deleteBlock('block-1');
    expect(outboxMap.get('blocks:block-1')?.operation).toBe('delete');
    expect(outboxMap.get('topics:topic-1')?.operation).toBe('delete');
    expect(outboxMap.get('weeklyPlanItems:plan-1')?.operation).toBe('delete');
    expect(outboxMap.get('studySessions:sess-1')?.operation).toBe('delete');
    expect(outboxMap.get('questions:q-1')?.operation).toBe('delete');
    expect(outboxMap.get('flashcards:fc-1')?.operation).toBe('delete');

    outboxMap.clear();
    await repo.deleteTopic('topic-1');
    expect(outboxMap.get('topics:topic-1')?.operation).toBe('delete');
    expect(outboxMap.get('weeklyPlanItems:plan-1')?.operation).toBe('delete');
    expect(outboxMap.get('questions:q-1')?.operation).toBe('upsert');
    expect(outboxMap.get('flashcards:fc-1')?.operation).toBe('upsert');
  });

  it('diffs removed and inserted records on replaceAllData when authenticated', async () => {
    const { repo, outboxMap } = setup(true);
    const nextTopic: Topic = {
      id: 'topic-new',
      blockId: 'block-1',
      order: 0,
      title: 'Nuevo',
      status: 'pending',
      roundCount: 0,
      tags: [],
      contentJson: null,
      plainText: '',
      createdAt: '2026-11-26T10:00:00.000Z',
      updatedAt: '2026-11-26T10:00:00.000Z',
    };

    await repo.replaceAllData([sampleBlock], [nextTopic]);

    expect(outboxMap.get('blocks:block-old')?.operation).toBe('delete');
    expect(outboxMap.get('blocks:block-1')?.operation).toBe('upsert');
    expect(outboxMap.get('topics:topic-1')?.operation).toBe('delete');
    expect(outboxMap.get('topics:topic-new')?.operation).toBe('upsert');
  });
});
