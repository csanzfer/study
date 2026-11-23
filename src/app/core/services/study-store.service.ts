import { Injectable, computed, inject, signal } from '@angular/core';
import {
  compareTopicsByUrgency,
  getTopicHealth,
} from '../../shared/utils/topic-health.util';
import {
  getWeekStartDate,
  isIsoTimestampInWeek,
} from '../../shared/utils/week-date.util';
import {
  CreateStudySessionInput,
  CreateTopicInput,
  CreateWeeklyPlanItemInput,
  IsoDayOfWeek,
  StudySession,
  TaiBlock,
  TaiBlockId,
  Topic,
  TopicStatus,
  UpdateTopicPatch,
  WeeklyPlanItem,
} from '../models/study.models';
import { STUDY_REPOSITORY } from '../repositories/study.repository';

export interface MoveTopicStatusResult {
  topic: Topic;
  roundIncremented: boolean;
}

@Injectable({ providedIn: 'root' })
export class StudyStoreService {
  private readonly repository = inject(STUDY_REPOSITORY);

  readonly blocks = signal<TaiBlock[]>([]);
  readonly topics = signal<Topic[]>([]);
  readonly studySessions = signal<StudySession[]>([]);
  readonly weeklyPlanItems = signal<WeeklyPlanItem[]>([]);
  readonly searchQuery = signal('');
  readonly loading = signal(false);
  readonly initialized = signal(false);
  readonly error = signal<string | null>(null);

  readonly totalTopics = computed(() => this.topics().length);

  readonly masteredTopics = computed(
    () => this.topics().filter((topic) => topic.status === 'mastered').length,
  );

  readonly totalRoundsCompleted = computed(() =>
    this.topics().reduce((sum, topic) => sum + (topic.roundCount || 0), 0),
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

  readonly rustyTopics = computed(() => {
    const now = new Date();
    return this.topics()
      .filter((topic) => getTopicHealth(topic, now).needsReview)
      .sort((a, b) => compareTopicsByUrgency(a, b, now));
  });

  readonly studyMinutesThisWeek = computed(() => {
    const currentWeekStart = getWeekStartDate();
    return this.studySessions()
      .filter((session) => isIsoTimestampInWeek(session.startedAt, currentWeekStart))
      .reduce((sum, session) => sum + session.durationMinutes, 0);
  });

  readonly studyMinutesByBlockThisWeek = computed(() => {
    const currentWeekStart = getWeekStartDate();
    const totals: Record<TaiBlockId, number> = { B1: 0, B2: 0, B3: 0, B4: 0 };
    for (const session of this.studySessions()) {
      if (isIsoTimestampInWeek(session.startedAt, currentWeekStart)) {
        totals[session.blockId] = (totals[session.blockId] ?? 0) + session.durationMinutes;
      }
    }
    return totals;
  });

  readonly studyMinutesByBlockTotal = computed(() => {
    const totals: Record<TaiBlockId, number> = { B1: 0, B2: 0, B3: 0, B4: 0 };
    for (const session of this.studySessions()) {
      totals[session.blockId] = (totals[session.blockId] ?? 0) + session.durationMinutes;
    }
    return totals;
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
    const [blocks, topics, studySessions, weeklyPlanItems] = await Promise.all([
      this.repository.getBlocks(),
      this.repository.getTopics(),
      this.repository.getStudySessions(),
      this.repository.getWeeklyPlanItems(),
    ]);
    this.blocks.set(blocks);
    this.topics.set(topics);
    this.studySessions.set(studySessions);
    this.weeklyPlanItems.set(weeklyPlanItems);
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
    const initialStatus = input.status ?? 'pending';
    const topic: Topic = {
      id: this.generateId('topic'),
      blockId: input.blockId,
      order: nextOrder,
      title: input.title.trim(),
      status: initialStatus,
      roundCount: initialStatus === 'mastered' ? 1 : 0,
      tags: input.tags ?? [],
      contentJson: input.contentJson ?? { type: 'doc', content: [] },
      plainText: input.plainText ?? '',
      createdAt: now,
      updatedAt: now,
      lastReviewedAt: initialStatus !== 'pending' ? now : undefined,
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

  async moveTopicStatus(
    id: string,
    nextStatus: TopicStatus,
  ): Promise<MoveTopicStatusResult | undefined> {
    const existing = this.getTopicById(id) ?? (await this.repository.getTopicById(id));
    if (!existing) {
      return undefined;
    }

    if (existing.status === nextStatus) {
      return { topic: existing, roundIncremented: false };
    }

    const now = new Date().toISOString();
    const roundIncremented = nextStatus === 'mastered' && existing.status !== 'mastered';
    const patch: UpdateTopicPatch = {
      status: nextStatus,
      roundCount: roundIncremented ? existing.roundCount + 1 : existing.roundCount,
      lastReviewedAt: nextStatus !== 'pending' ? now : existing.lastReviewedAt,
    };

    const updated = await this.updateTopic(id, patch);
    if (!updated) {
      return undefined;
    }

    return { topic: updated, roundIncremented };
  }

  async logTopicReview(id: string, incrementRound = true): Promise<Topic | undefined> {
    const existing = this.getTopicById(id) ?? (await this.repository.getTopicById(id));
    if (!existing) {
      return undefined;
    }

    const now = new Date().toISOString();
    const nextStatus: TopicStatus =
      existing.status === 'pending' ? 'first_round' : existing.status;

    return this.updateTopic(id, {
      status: nextStatus,
      roundCount: incrementRound ? existing.roundCount + 1 : existing.roundCount,
      lastReviewedAt: now,
    });
  }

  async reorderTopics(blockId: TaiBlockId, orderedTopicIds: string[]): Promise<void> {
    const blockTopics = this.getTopicsForBlock(blockId);
    const topicMap = new Map(blockTopics.map((topic) => [topic.id, topic]));
    const updatedTopics: Topic[] = [];

    let nextOrder = 1;
    for (const id of orderedTopicIds) {
      const topic = topicMap.get(id);
      if (topic) {
        if (topic.order !== nextOrder) {
          updatedTopics.push({ ...topic, order: nextOrder });
        }
        topicMap.delete(id);
        nextOrder++;
      }
    }

    // Preserve any topic not present in orderedTopicIds at the end
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

  // --- Study Sessions (Pomodoro / Estudio manual) ---

  async addStudySession(input: CreateStudySessionInput): Promise<StudySession> {
    const durationMinutes = Math.max(1, Math.round(input.durationMinutes));
    const endedAt = input.endedAt ?? new Date().toISOString();
    const startedAt =
      input.startedAt ??
      new Date(new Date(endedAt).getTime() - durationMinutes * 60_000).toISOString();

    const session: StudySession = {
      id: this.generateId('session'),
      topicId: input.topicId,
      blockId: input.blockId,
      startedAt,
      endedAt,
      durationMinutes,
      type: input.type,
      notes: input.notes?.trim() || undefined,
    };

    await this.repository.saveStudySession(session);
    this.studySessions.update((items) =>
      [session, ...items].sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
    );

    // Update topic's lastReviewedAt automatically if topic exists
    if (input.topicId && this.getTopicById(input.topicId)) {
      await this.logTopicReview(input.topicId, false);
    }

    return session;
  }

  async deleteStudySession(id: string): Promise<void> {
    await this.repository.deleteStudySession(id);
    this.studySessions.update((items) => items.filter((item) => item.id !== id));
  }

  // --- Weekly Planner ---

  getWeeklyPlanForWeek(weekStartDate: string): WeeklyPlanItem[] {
    return this.weeklyPlanItems()
      .filter((item) => item.weekStartDate === weekStartDate)
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.order - b.order);
  }

  async addWeeklyPlanItem(input: CreateWeeklyPlanItemInput): Promise<WeeklyPlanItem> {
    const sameDay = this.weeklyPlanItems().filter(
      (item) =>
        item.weekStartDate === input.weekStartDate && item.dayOfWeek === input.dayOfWeek,
    );
    const nextOrder =
      sameDay.length > 0 ? Math.max(...sameDay.map((item) => item.order)) + 1 : 1;

    const item: WeeklyPlanItem = {
      id: this.generateId('plan'),
      weekStartDate: input.weekStartDate,
      dayOfWeek: input.dayOfWeek,
      topicId: input.topicId,
      blockId: input.blockId,
      order: nextOrder,
      completed: false,
      targetPomodoros: input.targetPomodoros,
    };

    await this.repository.saveWeeklyPlanItem(item);
    this.weeklyPlanItems.update((items) =>
      [...items, item].sort(
        (a, b) =>
          a.weekStartDate.localeCompare(b.weekStartDate) ||
          a.dayOfWeek - b.dayOfWeek ||
          a.order - b.order,
      ),
    );
    return item;
  }

  async toggleWeeklyPlanItem(id: string): Promise<WeeklyPlanItem | undefined> {
    const existing = this.weeklyPlanItems().find((item) => item.id === id);
    if (!existing) {
      return undefined;
    }

    const nextCompleted = !existing.completed;
    const updated: WeeklyPlanItem = {
      ...existing,
      completed: nextCompleted,
      completedAt: nextCompleted ? new Date().toISOString() : undefined,
    };

    await this.repository.saveWeeklyPlanItem(updated);
    this.weeklyPlanItems.update((items) =>
      items.map((item) => (item.id === id ? updated : item)),
    );

    if (nextCompleted && this.getTopicById(existing.topicId)) {
      await this.logTopicReview(existing.topicId, false);
    }

    return updated;
  }

  async moveWeeklyPlanItem(
    id: string,
    targetDayOfWeek: IsoDayOfWeek,
    orderedTargetIds: string[],
  ): Promise<void> {
    const existing = this.weeklyPlanItems().find((item) => item.id === id);
    if (!existing) {
      return;
    }

    const weekItems = this.getWeeklyPlanForWeek(existing.weekStartDate);
    const itemMap = new Map(weekItems.map((item) => [item.id, item]));
    const changed: WeeklyPlanItem[] = [];

    let order = 1;
    for (const targetId of orderedTargetIds) {
      const item = itemMap.get(targetId);
      if (!item) {
        continue;
      }
      const nextDay = item.id === id ? targetDayOfWeek : item.dayOfWeek;
      if (item.dayOfWeek !== nextDay || item.order !== order) {
        changed.push({ ...item, dayOfWeek: nextDay, order });
      }
      order++;
    }

    if (existing.dayOfWeek !== targetDayOfWeek) {
      const remainingSource = weekItems
        .filter((item) => item.dayOfWeek === existing.dayOfWeek && item.id !== id)
        .sort((a, b) => a.order - b.order);
      remainingSource.forEach((item, index) => {
        const nextOrder = index + 1;
        if (item.order !== nextOrder) {
          changed.push({ ...item, order: nextOrder });
        }
      });
    }

    if (changed.length === 0) {
      return;
    }

    await this.repository.saveWeeklyPlanItems(changed);
    const changedMap = new Map(changed.map((item) => [item.id, item]));
    this.weeklyPlanItems.update((items) =>
      items
        .map((item) => changedMap.get(item.id) ?? item)
        .sort(
          (a, b) =>
            a.weekStartDate.localeCompare(b.weekStartDate) ||
            a.dayOfWeek - b.dayOfWeek ||
            a.order - b.order,
        ),
    );
  }

  async deleteWeeklyPlanItem(id: string): Promise<void> {
    await this.repository.deleteWeeklyPlanItem(id);
    this.weeklyPlanItems.update((items) => items.filter((item) => item.id !== id));
  }

  private generateId(prefix: string): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
}
