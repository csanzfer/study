import { TestBed } from '@angular/core/testing';
import { TAI_BLOCKS_SEED } from '../db/tai-seed';
import { TaiBlock, TaiBlockId, Topic } from '../models/study.models';
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
      createdAt: '2026-11-20T12:00:00.000Z',
      updatedAt: '2026-11-20T12:00:00.000Z',
    },
  ];

  async initialize(): Promise<void> {}
  async getBlocks(): Promise<TaiBlock[]> {
    return this.blocks;
  }
  async getTopics(blockId?: TaiBlockId): Promise<Topic[]> {
    return blockId ? this.topics.filter((t) => t.blockId === blockId) : this.topics;
  }
  async getTopicById(id: string): Promise<Topic | undefined> {
    return this.topics.find((t) => t.id === id);
  }
  async saveTopic(topic: Topic): Promise<void> {
    this.topics.push(topic);
  }
  async deleteTopic(id: string): Promise<void> {
    this.topics = this.topics.filter((t) => t.id !== id);
  }
  async replaceAllData(blocks: TaiBlock[], topics: Topic[]): Promise<void> {
    this.blocks = [...blocks];
    this.topics = [...topics];
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

  it('should create a valid v1 backup payload', async () => {
    const payload = await service.createBackupPayload();
    expect(payload.appName).toBe('tai-study');
    expect(payload.schemaVersion).toBe(1);
    expect(payload.blocks.length).toBe(4);
    expect(payload.topics.length).toBe(1);
  });

  it('should parse and validate a valid backup JSON string', async () => {
    const payload = await service.createBackupPayload();
    const parsed = service.parseBackupJson(JSON.stringify(payload));
    expect(parsed.topics[0].title).toBe('Constitución Española');
  });

  it('should reject an invalid backup JSON', () => {
    expect(() => service.parseBackupJson('{invalid')).toThrow();
    expect(() =>
      service.parseBackupJson(JSON.stringify({ appName: 'other', schemaVersion: 1 })),
    ).toThrow();
  });
});
