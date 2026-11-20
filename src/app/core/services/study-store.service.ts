import { Injectable, computed, inject, signal } from '@angular/core';
import {
  CreateTopicInput,
  TaiBlock,
  TaiBlockId,
  Topic,
  UpdateTopicPatch,
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

  getTopicById(id: string): Topic | undefined {
    return this.topics().find((topic) => topic.id === id);
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

  async updateTopic(id: string, patch: UpdateTopicPatch): Promise<Topic | undefined> {
    const existing = this.getTopicById(id) ?? (await this.repository.getTopicById(id));
    if (!existing) {
      return undefined;
    }

    const nextTitle =
      patch.title !== undefined ? patch.title.trim() || existing.title : existing.title;
    const nextTags =
      patch.tags !== undefined
        ? Array.from(new Set(patch.tags.map((tag) => tag.trim()).filter(Boolean)))
        : existing.tags;

    const updated: Topic = {
      ...existing,
      ...patch,
      title: nextTitle,
      tags: nextTags,
      updatedAt: new Date().toISOString(),
    };

    await this.repository.saveTopic(updated);
    this.topics.update((items) =>
      items.map((item) => (item.id === id ? updated : item)),
    );
    return updated;
  }

  async reorderTopics(blockId: TaiBlockId, orderedTopicIds: string[]): Promise<void> {
    const blockTopics = this.getTopicsForBlock(blockId);
    const topicMap = new Map(blockTopics.map((topic) => [topic.id, topic]));
    const updatedTopics: Topic[] = [];

    orderedTopicIds.forEach((id, index) => {
      const topic = topicMap.get(id);
      if (topic) {
        const nextOrder = index + 1;
        if (topic.order !== nextOrder) {
          updatedTopics.push({ ...topic, order: nextOrder });
        }
        topicMap.delete(id);
      }
    });

    // Preserve any topic not present in orderedTopicIds at the end
    let nextOrder = orderedTopicIds.length + 1;
    for (const remaining of topicMap.values()) {
      if (remaining.order !== nextOrder) {
        updatedTopics.push({ ...remaining, order: nextOrder });
      }
      nextOrder++;
    }

    if (updatedTopics.length === 0) {
      return;
    }

    await this.repository.saveTopics(updatedTopics);
    const updatedMap = new Map(updatedTopics.map((topic) => [topic.id, topic]));
    this.topics.update((items) =>
      items
        .map((item) => updatedMap.get(item.id) ?? item)
        .sort((a, b) => a.blockId.localeCompare(b.blockId) || a.order - b.order),
    );
  }

  async deleteTopic(id: string): Promise<void> {
    const existing = this.getTopicById(id);
    await this.repository.deleteTopic(id);

    if (existing) {
      const remaining = this.getTopicsForBlock(existing.blockId).filter((t) => t.id !== id);
      const reindexed = remaining
        .map((topic, index) => (topic.order !== index + 1 ? { ...topic, order: index + 1 } : null))
        .filter((topic): topic is Topic => topic !== null);
      if (reindexed.length > 0) {
        await this.repository.saveTopics(reindexed);
      }
    }

    await this.refresh();
  }

  private generateId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `topic-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
}
