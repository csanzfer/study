import { Injectable, computed, inject, signal } from '@angular/core';
import {
  CreateTopicInput,
  TaiBlock,
  TaiBlockId,
  Topic,
} from '../models/study.models';
import { STUDY_REPOSITORY } from '../repositories/study.repository';

@Injectable({ providedIn: 'root' })
export class StudyStoreService {
  private readonly repository = inject(STUDY_REPOSITORY);

  readonly blocks = signal<TaiBlock[]>([]);
  readonly topics = signal<Topic[]>([]);
  readonly searchQuery = signal('');
  readonly loading = signal(false);
  readonly initialized = signal(false);
  readonly error = signal<string | null>(null);

  readonly totalTopics = computed(() => this.topics().length);

  readonly masteredTopics = computed(
    () => this.topics().filter((topic) => topic.status === 'mastered').length,
  );

  readonly topicCountByBlock = computed(() => {
    const counts: Record<TaiBlockId, number> = { B1: 0, B2: 0, B3: 0, B4: 0 };
    for (const topic of this.topics()) {
      counts[topic.blockId] = (counts[topic.blockId] ?? 0) + 1;
    }
    return counts;
  });

  readonly filteredTopics = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    if (!query) {
      return this.topics();
    }

    return this.topics().filter(
      (topic) =>
        topic.title.toLowerCase().includes(query) ||
        topic.plainText.toLowerCase().includes(query) ||
        topic.tags.some((tag) => tag.toLowerCase().includes(query)),
    );
  });

  async initialize(): Promise<void> {
    if (this.initialized()) {
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      await this.repository.initialize();
      await this.refresh();
      this.initialized.set(true);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'No se pudo inicializar la base de datos local (IndexedDB).';
      this.error.set(message);
    } finally {
      this.loading.set(false);
    }
  }

  async refresh(): Promise<void> {
    const [blocks, topics] = await Promise.all([
      this.repository.getBlocks(),
      this.repository.getTopics(),
    ]);
    this.blocks.set(blocks);
    this.topics.set(topics);
  }

  getBlockById(blockId: TaiBlockId): TaiBlock | undefined {
    return this.blocks().find((block) => block.id === blockId);
  }

  getTopicsForBlock(blockId: TaiBlockId): Topic[] {
    return this.topics()
      .filter((topic) => topic.blockId === blockId)
      .sort((a, b) => a.order - b.order);
  }

  async createTopic(input: CreateTopicInput): Promise<Topic> {
    const blockTopics = this.getTopicsForBlock(input.blockId);
    const nextOrder =
      blockTopics.length > 0
        ? Math.max(...blockTopics.map((item) => item.order)) + 1
        : 1;

    const now = new Date().toISOString();
    const topic: Topic = {
      id: this.generateId(),
      blockId: input.blockId,
      order: nextOrder,
      title: input.title.trim(),
      status: input.status ?? 'pending',
      roundCount: 0,
      tags: input.tags ?? [],
      contentJson: input.contentJson ?? { type: 'doc', content: [] },
      plainText: input.plainText ?? '',
      createdAt: now,
      updatedAt: now,
    };

    await this.repository.saveTopic(topic);
    await this.refresh();
    return topic;
  }

  async deleteTopic(id: string): Promise<void> {
    await this.repository.deleteTopic(id);
    await this.refresh();
  }

  private generateId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `topic-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
}
