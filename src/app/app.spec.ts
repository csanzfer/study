import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';
import { TAI_BLOCKS_SEED } from './core/db/tai-seed';
import { TaiBlock, TaiBlockId, Topic } from './core/models/study.models';
import { STUDY_REPOSITORY, StudyRepository } from './core/repositories/study.repository';
import { StudyStoreService } from './core/services/study-store.service';

class InMemoryStudyRepository implements StudyRepository {
  private blocks: TaiBlock[] = [...TAI_BLOCKS_SEED];
  private topics: Topic[] = [];

  async initialize(): Promise<void> {
    // Already seeded in memory
  }

  async getBlocks(): Promise<TaiBlock[]> {
    return [...this.blocks];
  }

  async getTopics(blockId?: TaiBlockId): Promise<Topic[]> {
    return blockId
      ? this.topics.filter((t) => t.blockId === blockId)
      : [...this.topics];
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

  async deleteTopic(id: string): Promise<void> {
    this.topics = this.topics.filter((t) => t.id !== id);
  }

  async replaceAllData(blocks: TaiBlock[], topics: Topic[]): Promise<void> {
    this.blocks = [...blocks];
    this.topics = [...topics];
  }
}

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    providers: [
      provideRouter(routes),
      {
        provide: STUDY_REPOSITORY,
        useClass: InMemoryStudyRepository,
      },
    ],
    }).compileComponents();
});

it('should create the app and initialize the 4 TAI blocks', async () => {
  const store = TestBed.inject(StudyStoreService);
  await store.initialize();

    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    expect(fixture.componentInstance).toBeTruthy();
    expect(store.blocks().length).toBe(4);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('TAI Study');
  });
});
