import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  CaseStudy,
  ExamAttempt,
  Flashcard,
  GamificationProfile,
  Question,
  StudyBlock,
  StudyBlockId,
  StudySession,
  Topic,
  WeeklyPlanItem,
} from '../models/study.models';
import { STUDY_REPOSITORY, StudyRepository } from '../repositories/study.repository';
import { SearchService, buildHighlightedSnippet } from './search.service';
import { StudyStoreService } from './study-store.service';

const SEARCH_TEST_BLOCKS: StudyBlock[] = [
  {
    id: 'B1',
    code: 'DER',
    title: 'Derecho',
    shortTitle: 'Derecho',
    description: '',
    color: '#2563eb',
    icon: 'gavel',
    order: 1,
  },
  {
    id: 'B4',
    code: 'RED',
    title: 'Redes',
    shortTitle: 'Redes',
    description: '',
    color: '#059669',
    icon: 'lan',
    order: 2,
  },
];

class InMemoryRepository implements StudyRepository {
  private blocks: StudyBlock[] = SEARCH_TEST_BLOCKS.map((b) => ({ ...b }));
  private topics: Topic[] = [];
  private sessions: StudySession[] = [];
  private weeklyPlan: WeeklyPlanItem[] = [];
  private caseStudies: CaseStudy[] = [];
  private questions: Question[] = [];
  private examAttempts: ExamAttempt[] = [];
  private flashcards: Flashcard[] = [];
  private profile?: GamificationProfile;

  async initialize(): Promise<void> {}
  async getBlocks(): Promise<StudyBlock[]> {
    return [...this.blocks];
  }
  async saveBlock(block: StudyBlock): Promise<void> {
    const idx = this.blocks.findIndex((b) => b.id === block.id);
    if (idx >= 0) {
      this.blocks[idx] = block;
    } else {
      this.blocks.push(block);
    }
  }
  async saveBlocks(blocks: StudyBlock[]): Promise<void> {
    for (const block of blocks) {
      await this.saveBlock(block);
    }
  }
  async deleteBlock(id: StudyBlockId): Promise<void> {
    this.blocks = this.blocks.filter((b) => b.id !== id);
    this.topics = this.topics.filter((t) => t.blockId !== id);
    this.weeklyPlan = this.weeklyPlan.filter((w) => w.blockId !== id);
    this.sessions = this.sessions.filter((s) => s.blockId !== id);
    this.caseStudies = this.caseStudies.filter((c) => c.blockId !== id);
    this.questions = this.questions.filter((q) => q.blockId !== id);
    this.flashcards = this.flashcards.filter((f) => f.blockId !== id);
  }
  async getTopics(blockId?: StudyBlockId): Promise<Topic[]> {
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
    this.weeklyPlan = this.weeklyPlan.filter((w) => w.topicId !== id);
  }
  async getStudySessions(): Promise<StudySession[]> {
    return [...this.sessions];
  }
  async saveStudySession(session: StudySession): Promise<void> {
    this.sessions.push(session);
  }
  async deleteStudySession(id: string): Promise<void> {
    this.sessions = this.sessions.filter((s) => s.id !== id);
  }
  async getWeeklyPlanItems(weekStartDate?: string): Promise<WeeklyPlanItem[]> {
    return weekStartDate
      ? this.weeklyPlan.filter((w) => w.weekStartDate === weekStartDate)
      : [...this.weeklyPlan];
  }
  async saveWeeklyPlanItem(item: WeeklyPlanItem): Promise<void> {
    this.weeklyPlan.push(item);
  }
  async saveWeeklyPlanItems(items: WeeklyPlanItem[]): Promise<void> {
    for (const item of items) {
      await this.saveWeeklyPlanItem(item);
    }
  }
  async deleteWeeklyPlanItem(id: string): Promise<void> {
    this.weeklyPlan = this.weeklyPlan.filter((w) => w.id !== id);
  }
  async getCaseStudies(): Promise<CaseStudy[]> {
    return [...this.caseStudies];
  }
  async saveCaseStudy(cs: CaseStudy): Promise<void> {
    this.caseStudies = [cs, ...this.caseStudies.filter((c) => c.id !== cs.id)];
  }
  async deleteCaseStudy(id: string): Promise<void> {
    this.caseStudies = this.caseStudies.filter((c) => c.id !== id);
  }
  async getQuestions(): Promise<Question[]> {
    return [...this.questions];
  }
  async saveQuestion(q: Question): Promise<void> {
    this.questions = [q, ...this.questions.filter((x) => x.id !== q.id)];
  }
  async saveQuestions(qs: Question[]): Promise<void> {
    for (const q of qs) await this.saveQuestion(q);
  }
  async deleteQuestion(id: string): Promise<void> {
    this.questions = this.questions.filter((q) => q.id !== id);
  }
  async getExamAttempts(): Promise<ExamAttempt[]> {
    return [...this.examAttempts];
  }
  async saveExamAttempt(attempt: ExamAttempt): Promise<void> {
    this.examAttempts = [attempt, ...this.examAttempts.filter((a) => a.id !== attempt.id)];
  }
  async deleteExamAttempt(id: string): Promise<void> {
    this.examAttempts = this.examAttempts.filter((a) => a.id !== id);
  }
  async getFlashcards(): Promise<Flashcard[]> { return [...this.flashcards]; }
  async saveFlashcard(fc: Flashcard): Promise<void> {
    this.flashcards = [fc, ...this.flashcards.filter((x) => x.id !== fc.id)];
  }
  async saveFlashcards(fcs: Flashcard[]): Promise<void> {
    for (const f of fcs) await this.saveFlashcard(f);
  }
  async deleteFlashcard(id: string): Promise<void> {
    this.flashcards = this.flashcards.filter((f) => f.id !== id);
  }
  async getGamificationProfile(): Promise<GamificationProfile | undefined> { return this.profile; }
  async saveGamificationProfile(profile: GamificationProfile): Promise<void> { this.profile = profile; }
  async replaceAllData(
    blocks: StudyBlock[],
    topics: Topic[],
    studySessions: StudySession[] = [],
    weeklyPlanItems: WeeklyPlanItem[] = [],
    caseStudies: CaseStudy[] = [],
    questions: Question[] = [],
    examAttempts: ExamAttempt[] = [],
    flashcards: Flashcard[] = [],
    gamificationProfile?: GamificationProfile,
  ): Promise<void> {
    this.blocks = [...blocks];
    this.topics = [...topics];
    this.sessions = [...studySessions];
    this.weeklyPlan = [...weeklyPlanItems];
    this.caseStudies = [...caseStudies];
    this.questions = [...questions];
    this.examAttempts = [...examAttempts];
    this.flashcards = [...flashcards];
    this.profile = gamificationProfile;
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
