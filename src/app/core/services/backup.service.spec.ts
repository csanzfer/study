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
      customOutlineMd: '# Constitución\n## Título Preliminar\n- Art. 1',
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
    const idx = this.topics.findIndex((t) => t.id === topic.id);
    if (idx >= 0) {
      this.topics[idx] = topic;
    } else {
      this.topics.push(topic);
    }
  }
  async saveTopics(topics: Topic[]): Promise<void> {
    for (const topic of topics) {
      await this.saveTopic(topic);
    }
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

  it('should parse and validate a valid backup JSON string preserving customOutlineMd', async () => {
    const payload = await service.createBackupPayload();
    const parsed = service.parseBackupJson(JSON.stringify(payload));
    expect(parsed.topics[0].title).toBe('Constitución Española');
    expect(parsed.topics[0].customOutlineMd).toBe('# Constitución\n## Título Preliminar\n- Art. 1');
  });

  it('should reject an invalid backup JSON', () => {
    expect(() => service.parseBackupJson('{invalid')).toThrow();
    expect(() =>
      service.parseBackupJson(JSON.stringify({ appName: 'other', schemaVersion: 1 })),
    ).toThrow();
  });

  it('should preserve rich contentJson, plainText, and customOutlineMd across export/import round-trip', async () => {
    const richContentJson = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Ley 39/2015' }] },
        {
          type: 'examCallout',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Plazo general: 3 meses' }] }],
        },
      ],
    };

    repo.topics = [
      {
        ...repo.topics[0],
        contentJson: richContentJson,
        plainText: 'Ley 39/2015 Plazo general: 3 meses',
        customOutlineMd: '# Ley 39/2015\n- ⚠️ Plazo general: 3 meses',
      },
    ];

    const exported = await service.createBackupPayload();
    const jsonString = JSON.stringify(exported);

    // Wipe repository before restoring
    await repo.replaceAllData([], []);
    expect((await repo.getTopics()).length).toBe(0);

    const file = new File([jsonString], 'tai-study-backup.json', { type: 'application/json' });
    const result = await service.importBackupFile(file);

    expect(result.blocksCount).toBe(4);
    expect(result.topicsCount).toBe(1);

    const [restored] = await repo.getTopics();
    expect(restored.contentJson).toEqual(richContentJson);
    expect(restored.plainText).toBe('Ley 39/2015 Plazo general: 3 meses');
    expect(restored.customOutlineMd).toBe('# Ley 39/2015\n- ⚠️ Plazo general: 3 meses');
  });
});
