import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { TAI_BLOCKS_SEED } from '../db/tai-seed';
import { TaiBlock, TaiBlockId, Topic } from '../models/study.models';
import { STUDY_REPOSITORY, StudyRepository } from '../repositories/study.repository';
import { SearchService, buildHighlightedSnippet } from './search.service';
import { StudyStoreService } from './study-store.service';

class InMemoryRepository implements StudyRepository {
  private blocks: TaiBlock[] = [...TAI_BLOCKS_SEED];
  private topics: Topic[] = [];

  async initialize(): Promise<void> {}
  async getBlocks(): Promise<TaiBlock[]> {
    return [...this.blocks];
  }
  async getTopics(blockId?: TaiBlockId): Promise<Topic[]> {
    return blockId ? this.topics.filter((t) => t.blockId === blockId) : [...this.topics];
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

describe('SearchService', () => {
  let store: StudyStoreService;
  let searchService: SearchService;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: STUDY_REPOSITORY, useClass: InMemoryRepository },
        StudyStoreService,
        SearchService,
      ],
    });

    store = TestBed.inject(StudyStoreService);
    searchService = TestBed.inject(SearchService);
    await store.initialize();

    await store.createTopic({
      blockId: 'B1',
      title: 'Constitución Española de 1978',
      tags: ['derecho', 'leyes'],
      plainText: 'La Ley 39/2015 regula el procedimiento administrativo común.',
    });

    await store.createTopic({
      blockId: 'B4',
      title: 'Protocolos TCP/IP y Puertos',
      tags: ['redes', 'seguridad', 'https'],
      plainText: 'HTTPS utiliza por defecto el puerto 443 sobre TLS.',
    });

    TestBed.flushEffects();
  });

  it('finds topics by title (accent-insensitive), tags, and body plainText', () => {
    const byTitle = searchService.search('constitucion');
    expect(byTitle.length).toBe(1);
    expect(byTitle[0].topic.title).toContain('Constitución');

    const byTag = searchService.search('seguridad');
    expect(byTag.length).toBe(1);
    expect(byTag[0].topic.blockId).toBe('B4');
    expect(byTag[0].matchedTags).toContain('seguridad');

    const byBody = searchService.search('puerto 443');
    expect(byBody.length).toBe(1);
    expect(byBody[0].topic.title).toContain('TCP/IP');
    expect(byBody[0].snippet.some((seg) => seg.highlight)).toBe(true);
  });

  it('supports prefix and fuzzy matching for typos', () => {
    const prefixHits = searchService.search('protoc');
    expect(prefixHits.length).toBe(1);
    expect(prefixHits[0].topic.blockId).toBe('B4');

    const fuzzyHits = searchService.search('procedimineto');
    expect(fuzzyHits.length).toBe(1);
    expect(fuzzyHits[0].topic.blockId).toBe('B1');
  });

  it('updates index automatically when topics are edited or deleted', async () => {
    const [b1Topic] = store.getTopicsForBlock('B1');
    await store.updateTopic(b1Topic.id, {
      plainText: 'Actualizado con mención al Esquema Nacional de Seguridad ENS.',
    });
    TestBed.flushEffects();

    expect(searchService.search('ENS').length).toBe(1);

    await store.deleteTopic(b1Topic.id);
    TestBed.flushEffects();

    expect(searchService.search('ENS').length).toBe(0);
  });

  it('builds highlighted snippets around matching terms', () => {
    const segments = buildHighlightedSnippet(
      'Texto previo sobre administración electrónica y Ley 39/2015 en la AGE.',
      ['39/2015'],
    );
    expect(segments.some((s) => s.highlight && s.text.includes('39/2015'))).toBe(true);
  });
});
