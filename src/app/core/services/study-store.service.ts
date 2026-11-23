import { Injectable, computed, inject, signal } from '@angular/core';
import { computeCampaignOverview } from '../../features/flashcards/utils/campaign-progress.util';
import { generateDailyMissions } from '../../features/flashcards/utils/daily-missions.util';
import {
  buildStreakSummary,
  getLevelFromXp,
  recordGamificationActivity,
} from '../../features/flashcards/utils/gamification-streak.util';
import {
  applySm2Review,
  createInitialSrsState,
  isFlashcardDue,
  isFlashcardMastered,
} from '../../shared/utils/srs-sm2.util';
import {
  compareTopicsByUrgency,
  getTopicHealth,
} from '../../shared/utils/topic-health.util';
import {
  getWeekStartDate,
  isIsoTimestampInWeek,
} from '../../shared/utils/week-date.util';
import {
  CaseStudy,
  CreateCaseStudyInput,
  CreateExamAttemptInput,
  CreateFlashcardInput,
  CreateQuestionInput,
  CreateStudySessionInput,
  CreateTopicInput,
  CreateWeeklyPlanItemInput,
  ExamAttempt,
  Flashcard,
  FlashcardRating,
  GamificationProfile,
  IsoDayOfWeek,
  Question,
  StudySession,
  TaiBlock,
  TaiBlockId,
  Topic,
  TopicStatus,
  UpdateCaseStudyPatch,
  UpdateFlashcardPatch,
  UpdateQuestionPatch,
  UpdateTopicPatch,
  WeeklyPlanItem,
  createDefaultGamificationProfile,
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
  readonly caseStudies = signal<CaseStudy[]>([]);
  readonly questions = signal<Question[]>([]);
  readonly examAttempts = signal<ExamAttempt[]>([]);
  readonly flashcards = signal<Flashcard[]>([]);
  readonly gamificationProfile = signal<GamificationProfile>(createDefaultGamificationProfile());
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

  // --- Phase 3: Tests & Simulacros Computed Signals ---

  readonly totalQuestions = computed(() => this.questions().length);

  readonly flaggedQuestions = computed(() =>
    this.questions().filter((question) => question.flagged),
  );

  readonly failedQuestions = computed(() =>
    this.questions().filter(
      (question) =>
        question.stats.attempts > 0 &&
        (question.stats.lastResult === 'wrong' ||
          question.stats.correct < question.stats.attempts),
    ),
  );

  readonly questionCountByBlock = computed(() => {
    const counts: Record<TaiBlockId, number> = { B1: 0, B2: 0, B3: 0, B4: 0 };
    for (const question of this.questions()) {
      counts[question.blockId] = (counts[question.blockId] ?? 0) + 1;
    }
    return counts;
  });

  readonly questionCountByTopic = computed(() => {
    const counts: Record<string, number> = {};
    for (const question of this.questions()) {
      if (question.topicId) {
        counts[question.topicId] = (counts[question.topicId] ?? 0) + 1;
      }
    }
    return counts;
  });

  readonly overallTestAccuracy = computed(() => {
    let attempts = 0;
    let correct = 0;
    for (const question of this.questions()) {
      attempts += question.stats.attempts;
      correct += question.stats.correct;
    }
    if (attempts === 0) {
      return null;
    }
    return Math.round((correct / attempts) * 100);
  });

  readonly latestExamAttempt = computed(() => this.examAttempts()[0] ?? null);

  // --- Phase 4: Flashcards SRS & Gamification Computed Signals ---

  readonly totalFlashcards = computed(() => this.flashcards().length);

  readonly dueFlashcards = computed(() => {
    const today = new Date();
    return this.flashcards().filter((card) => isFlashcardDue(card, today));
  });

  readonly dueFlashcardsCount = computed(() => this.dueFlashcards().length);

  readonly masteredFlashcards = computed(() =>
    this.flashcards().filter((card) => isFlashcardMastered(card)),
  );

  readonly acronymFlashcards = computed(() =>
    this.flashcards().filter((card) =>
      card.tags.some((tag) => tag.toLowerCase() === 'siglas'),
    ),
  );

  readonly dueAcronymFlashcardsCount = computed(() => {
    const today = new Date();
    return this.acronymFlashcards().filter((card) => isFlashcardDue(card, today)).length;
  });

  readonly flashcardCountByBlock = computed(() => {
    const counts: Record<TaiBlockId, number> = { B1: 0, B2: 0, B3: 0, B4: 0 };
    for (const card of this.flashcards()) {
      counts[card.blockId] = (counts[card.blockId] ?? 0) + 1;
    }
    return counts;
  });

  readonly flashcardCountByTopic = computed(() => {
    const counts: Record<string, number> = {};
    for (const card of this.flashcards()) {
      if (card.topicId) {
        counts[card.topicId] = (counts[card.topicId] ?? 0) + 1;
      }
    }
    return counts;
  });

  readonly flashcardTags = computed(() => {
    const counts = new Map<string, number>();
    for (const card of this.flashcards()) {
      for (const tag of card.tags) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([tag]) => tag);
  });

  readonly campaignOverview = computed(() =>
    computeCampaignOverview(
      this.blocks(),
      this.topics(),
      this.flashcards(),
      this.questions(),
    ),
  );

  readonly dailyMissions = computed(() =>
    generateDailyMissions({
      blocks: this.blocks(),
      topics: this.topics(),
      flashcards: this.flashcards(),
      questions: this.questions(),
      studySessions: this.studySessions(),
      weeklyPlanItems: this.weeklyPlanItems(),
      examAttempts: this.examAttempts(),
      profile: this.gamificationProfile(),
    }),
  );

  readonly streakSummary = computed(() => buildStreakSummary(this.gamificationProfile()));

  readonly xpLevelInfo = computed(() => getLevelFromXp(this.gamificationProfile().xp));

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
    const [
      blocks,
      topics,
      studySessions,
      weeklyPlanItems,
      caseStudies,
      questions,
      examAttempts,
      flashcards,
      profile,
    ] = await Promise.all([
      this.repository.getBlocks(),
      this.repository.getTopics(),
      this.repository.getStudySessions(),
      this.repository.getWeeklyPlanItems(),
      this.repository.getCaseStudies(),
      this.repository.getQuestions(),
      this.repository.getExamAttempts(),
      this.repository.getFlashcards(),
      this.repository.getGamificationProfile(),
    ]);
    this.blocks.set(blocks);
    this.topics.set(topics);
    this.studySessions.set(studySessions);
    this.weeklyPlanItems.set(weeklyPlanItems);
    this.caseStudies.set(caseStudies);
    this.questions.set(questions);
    this.examAttempts.set(examAttempts);
    this.flashcards.set(flashcards);
    this.gamificationProfile.set(profile ?? createDefaultGamificationProfile());
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

    if (updated) {
      await this.recordActivityXp(roundIncremented ? 25 : 10);
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

    await this.recordActivityXp(Math.min(60, durationMinutes * 2));

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
    if (nextCompleted) {
      await this.recordActivityXp(15);
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

  // --- Case Studies (Supuestos prácticos) ---

  getCaseStudyById(id: string): CaseStudy | undefined {
    return this.caseStudies().find((item) => item.id === id);
  }

  getQuestionsForCaseStudy(caseStudyId: string): Question[] {
    return this.questions().filter((q) => q.caseStudyId === caseStudyId);
  }

  async createCaseStudy(input: CreateCaseStudyInput): Promise<CaseStudy> {
    const now = new Date().toISOString();
    const caseStudy: CaseStudy = {
      id: this.generateId('case'),
      blockId: input.blockId,
      title: input.title.trim(),
      statement: input.statement.trim(),
      source: input.source?.trim() || undefined,
      tags: Array.from(new Set((input.tags ?? []).map((t) => t.trim()).filter(Boolean))),
      createdAt: now,
      updatedAt: now,
    };

    await this.repository.saveCaseStudy(caseStudy);
    this.caseStudies.update((items) => [caseStudy, ...items]);
    return caseStudy;
  }

  async updateCaseStudy(id: string, patch: UpdateCaseStudyPatch): Promise<CaseStudy | undefined> {
    const existing = this.getCaseStudyById(id);
    if (!existing) {
      return undefined;
    }

    const updated: CaseStudy = {
      ...existing,
      ...patch,
      title: patch.title !== undefined ? patch.title.trim() || existing.title : existing.title,
      statement:
        patch.statement !== undefined
          ? patch.statement.trim() || existing.statement
          : existing.statement,
      source:
        patch.source !== undefined ? patch.source.trim() || undefined : existing.source,
      tags:
        patch.tags !== undefined
          ? Array.from(new Set(patch.tags.map((t) => t.trim()).filter(Boolean)))
          : existing.tags,
      updatedAt: new Date().toISOString(),
    };

    await this.repository.saveCaseStudy(updated);
    this.caseStudies.update((items) =>
      items.map((item) => (item.id === id ? updated : item)),
    );
    return updated;
  }

  async deleteCaseStudy(id: string): Promise<void> {
    await this.repository.deleteCaseStudy(id);
    this.caseStudies.update((items) => items.filter((item) => item.id !== id));
    this.questions.update((items) =>
      items.map((q) => (q.caseStudyId === id ? { ...q, caseStudyId: undefined } : q)),
    );
  }

  // --- Question Bank ---

  getQuestionById(id: string): Question | undefined {
    return this.questions().find((q) => q.id === id);
  }

  async createQuestion(input: CreateQuestionInput): Promise<Question> {
    const now = new Date().toISOString();
    const question = this.buildQuestion(input, now);
    await this.repository.saveQuestion(question);
    this.questions.update((items) => [question, ...items]);
    return question;
  }

  async bulkCreateQuestions(inputs: CreateQuestionInput[]): Promise<Question[]> {
    if (inputs.length === 0) {
      return [];
    }
    const now = new Date().toISOString();
    const created = inputs.map((input) => this.buildQuestion(input, now));
    await this.repository.saveQuestions(created);
    this.questions.update((items) => [...created, ...items]);
    return created;
  }

  async updateQuestion(id: string, patch: UpdateQuestionPatch): Promise<Question | undefined> {
    const existing = this.getQuestionById(id);
    if (!existing) {
      return undefined;
    }

    const updated: Question = {
      ...existing,
      ...patch,
      prompt: patch.prompt !== undefined ? patch.prompt.trim() || existing.prompt : existing.prompt,
      options:
        patch.options !== undefined
          ? (patch.options.map((opt) => opt.trim()) as [string, string, string, string])
          : existing.options,
      explanation:
        patch.explanation !== undefined
          ? patch.explanation.trim() || undefined
          : existing.explanation,
      reference:
        patch.reference !== undefined ? patch.reference.trim() || undefined : existing.reference,
      source: patch.source !== undefined ? patch.source.trim() || undefined : existing.source,
      topicId: patch.topicId !== undefined ? patch.topicId || undefined : existing.topicId,
      caseStudyId:
        patch.caseStudyId !== undefined ? patch.caseStudyId || undefined : existing.caseStudyId,
      tags:
        patch.tags !== undefined
          ? Array.from(new Set(patch.tags.map((t) => t.trim()).filter(Boolean)))
          : existing.tags,
      updatedAt: new Date().toISOString(),
    };

    await this.repository.saveQuestion(updated);
    this.questions.update((items) => items.map((q) => (q.id === id ? updated : q)));
    return updated;
  }

  async toggleQuestionFlag(id: string): Promise<Question | undefined> {
    const existing = this.getQuestionById(id);
    if (!existing) {
      return undefined;
    }
    return this.updateQuestion(id, { flagged: !existing.flagged });
  }

  async deleteQuestion(id: string): Promise<void> {
    await this.repository.deleteQuestion(id);
    this.questions.update((items) => items.filter((q) => q.id !== id));
  }

  // --- Exam Attempts ---

  async recordExamAttempt(input: CreateExamAttemptInput): Promise<ExamAttempt> {
    const now = input.date ?? new Date().toISOString();
    const attempt: ExamAttempt = {
      id: this.generateId('attempt'),
      title: input.title.trim() || 'Test TAI',
      date: now,
      mode: input.mode,
      penaltyRatio: input.penaltyRatio,
      caseStudyId: input.caseStudyId,
      answers: input.answers,
      correctCount: input.correctCount,
      wrongCount: input.wrongCount,
      blankCount: input.blankCount,
      netScore: input.netScore,
      maxScore: input.maxScore,
      scoreOn10: input.scoreOn10,
      durationSec: Math.max(0, Math.round(input.durationSec)),
    };

    await this.repository.saveExamAttempt(attempt);
    this.examAttempts.update((items) =>
      [attempt, ...items].sort((a, b) => b.date.localeCompare(a.date)),
    );

    // Update stats for every answered question in batch
    const questionMap = new Map(this.questions().map((q) => [q.id, q]));
    const updatedQuestions: Question[] = [];
    const touchedTopicIds = new Set<string>();

    for (const answer of attempt.answers) {
      if (answer.topicId) {
        touchedTopicIds.add(answer.topicId);
      }

      const existing = questionMap.get(answer.questionId);
      if (!existing) {
        continue;
      }

      const answered = answer.selectedIndex !== null;
      const nextStats = {
        attempts: existing.stats.attempts + (answered ? 1 : 0),
        correct: existing.stats.correct + (answer.isCorrect ? 1 : 0),
        lastAnsweredAt: now,
        lastResult: answered
          ? ((answer.isCorrect ? 'correct' : 'wrong') as 'correct' | 'wrong')
          : ('blank' as const),
      };

      const updatedQ: Question = {
        ...existing,
        stats: nextStats,
        updatedAt: now,
      };
      questionMap.set(existing.id, updatedQ);
      updatedQuestions.push(updatedQ);
    }

    if (updatedQuestions.length > 0) {
      await this.repository.saveQuestions(updatedQuestions);
      const updatedMap = new Map(updatedQuestions.map((q) => [q.id, q]));
      this.questions.update((items) => items.map((q) => updatedMap.get(q.id) ?? q));
    }

    const willLogSession = input.logStudySession !== false && attempt.durationSec >= 60;
    const primaryTopicId =
      touchedTopicIds.size === 1 ? Array.from(touchedTopicIds)[0] : '';

    // Update lastReviewedAt for topics practiced (skip primaryTopicId if addStudySession will update it)
    for (const topicId of touchedTopicIds) {
      if (willLogSession && topicId === primaryTopicId) {
        continue;
      }
      if (this.getTopicById(topicId)) {
        await this.logTopicReview(topicId, false);
      }
    }

    // Log a StudySession (type 'test') when test duration >= 60s
    if (willLogSession) {
      const durationMinutes = Math.max(1, Math.round(attempt.durationSec / 60));
      const dominantBlock = this.getDominantBlock(attempt.answers);
      await this.addStudySession({
        topicId: primaryTopicId,
        blockId: dominantBlock,
        endedAt: now,
        durationMinutes,
        type: 'test',
        notes: `${attempt.title} (${attempt.correctCount}/${attempt.maxScore} aciertos)`,
      });
    }

    const testXp = 20 + Math.min(30, attempt.correctCount * 2);
    await this.recordActivityXp(testXp);

    return attempt;
  }

  async deleteExamAttempt(id: string): Promise<void> {
    await this.repository.deleteExamAttempt(id);
    this.examAttempts.update((items) => items.filter((item) => item.id !== id));
  }

  // --- Phase 4: Flashcards SRS ---

  getFlashcardById(id: string): Flashcard | undefined {
    return this.flashcards().find((card) => card.id === id);
  }

  async createFlashcard(input: CreateFlashcardInput): Promise<Flashcard> {
    const now = new Date();
    const card = this.buildFlashcard(input, now);
    await this.repository.saveFlashcard(card);
    this.flashcards.update((items) =>
      [card, ...items].sort(
        (a, b) =>
          a.srs.dueDate.localeCompare(b.srs.dueDate) || b.updatedAt.localeCompare(a.updatedAt),
      ),
    );
    return card;
  }

  async bulkCreateFlashcards(inputs: CreateFlashcardInput[]): Promise<Flashcard[]> {
    if (inputs.length === 0) {
      return [];
    }
    const now = new Date();
    const created = inputs.map((input) => this.buildFlashcard(input, now));
    await this.repository.saveFlashcards(created);
    this.flashcards.update((items) =>
      [...created, ...items].sort(
        (a, b) =>
          a.srs.dueDate.localeCompare(b.srs.dueDate) || b.updatedAt.localeCompare(a.updatedAt),
      ),
    );
    return created;
  }

  async updateFlashcard(
    id: string,
    patch: UpdateFlashcardPatch,
  ): Promise<Flashcard | undefined> {
    const existing = this.getFlashcardById(id);
    if (!existing) {
      return undefined;
    }

    const updated: Flashcard = {
      ...existing,
      ...patch,
      front: patch.front !== undefined ? patch.front.trim() || existing.front : existing.front,
      back: patch.back !== undefined ? patch.back.trim() || existing.back : existing.back,
      hint: patch.hint !== undefined ? patch.hint.trim() || undefined : existing.hint,
      topicId: patch.topicId !== undefined ? patch.topicId || undefined : existing.topicId,
      tags:
        patch.tags !== undefined
          ? Array.from(new Set(patch.tags.map((t) => t.trim()).filter(Boolean)))
          : existing.tags,
      updatedAt: new Date().toISOString(),
    };

    await this.repository.saveFlashcard(updated);
    this.flashcards.update((items) =>
      items
        .map((c) => (c.id === id ? updated : c))
        .sort(
          (a, b) =>
            a.srs.dueDate.localeCompare(b.srs.dueDate) || b.updatedAt.localeCompare(a.updatedAt),
        ),
    );
    return updated;
  }

  async reviewFlashcard(
    id: string,
    rating: FlashcardRating,
    now: Date = new Date(),
  ): Promise<Flashcard | undefined> {
    const existing = this.getFlashcardById(id);
    if (!existing) {
      return undefined;
    }

    const nextSrs = applySm2Review(existing.srs, rating, now);
    const updated = await this.updateFlashcard(id, { srs: nextSrs });
    if (!updated) {
      return undefined;
    }

    if (updated.topicId && this.getTopicById(updated.topicId)) {
      await this.logTopicReview(updated.topicId, false);
    }

    const xpGain = rating === 'again' ? 2 : rating === 'hard' ? 4 : rating === 'good' ? 6 : 8;
    await this.recordActivityXp(xpGain, now);
    return updated;
  }

  async deleteFlashcard(id: string): Promise<void> {
    await this.repository.deleteFlashcard(id);
    this.flashcards.update((items) => items.filter((c) => c.id !== id));
  }

  // --- Phase 4: Gamification ---

  async recordActivityXp(xpDelta: number, now: Date = new Date()): Promise<GamificationProfile> {
    const updated = recordGamificationActivity(this.gamificationProfile(), xpDelta, now);
    await this.repository.saveGamificationProfile(updated);
    this.gamificationProfile.set(updated);
    return updated;
  }

  async updateWeeklyRestDays(restDays: number[]): Promise<GamificationProfile> {
    const cleanDays = Array.from(
      new Set(restDays.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)),
    ).sort((a, b) => a - b);

    const updated: GamificationProfile = {
      ...this.gamificationProfile(),
      weeklyRestDays: cleanDays,
      updatedAt: new Date().toISOString(),
    };
    await this.repository.saveGamificationProfile(updated);
    this.gamificationProfile.set(updated);
    return updated;
  }

  async claimMissionReward(missionId: string): Promise<boolean> {
    const mission = this.dailyMissions().find((m) => m.id === missionId);
    if (!mission || !mission.completed || mission.claimed) {
      return false;
    }

    const current = this.gamificationProfile();
    const claimedMissionIds = Array.from(new Set([...current.claimedMissionIds, missionId])).slice(
      -60,
    );
    const updated = recordGamificationActivity(
      { ...current, claimedMissionIds },
      mission.xpReward,
    );
    await this.repository.saveGamificationProfile(updated);
    this.gamificationProfile.set(updated);
    return true;
  }

  private buildFlashcard(input: CreateFlashcardInput, now: Date): Flashcard {
    const iso = now.toISOString();
    return {
      id: this.generateId('fc'),
      blockId: input.blockId,
      topicId: input.topicId || undefined,
      front: input.front.trim(),
      back: input.back.trim(),
      hint: input.hint?.trim() || undefined,
      tags: Array.from(new Set((input.tags ?? []).map((t) => t.trim()).filter(Boolean))),
      srs: createInitialSrsState(now),
      createdAt: iso,
      updatedAt: iso,
    };
  }

  private buildQuestion(input: CreateQuestionInput, timestamp: string): Question {
    return {
      id: this.generateId('q'),
      blockId: input.blockId,
      topicId: input.topicId || undefined,
      caseStudyId: input.caseStudyId || undefined,
      prompt: input.prompt.trim(),
      options: input.options.map((opt) => opt.trim()) as [string, string, string, string],
      correctIndex: input.correctIndex,
      explanation: input.explanation?.trim() || undefined,
      reference: input.reference?.trim() || undefined,
      source: input.source?.trim() || undefined,
      tags: Array.from(new Set((input.tags ?? []).map((t) => t.trim()).filter(Boolean))),
      flagged: input.flagged ?? false,
      stats: {
        attempts: 0,
        correct: 0,
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  }

  private getDominantBlock(answers: ExamAttempt['answers']): TaiBlockId {
    const counts: Record<TaiBlockId, number> = { B1: 0, B2: 0, B3: 0, B4: 0 };
    for (const answer of answers) {
      counts[answer.blockId] = (counts[answer.blockId] ?? 0) + 1;
    }
    let best: TaiBlockId = 'B1';
    for (const id of ['B1', 'B2', 'B3', 'B4'] as TaiBlockId[]) {
      if (counts[id] > counts[best]) {
        best = id;
      }
    }
    return best;
  }

  private generateId(prefix: string): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
}
