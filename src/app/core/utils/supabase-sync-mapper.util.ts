import {
  CaseStudy,
  ExamAnswer,
  ExamAttempt,
  ExamMode,
  Flashcard,
  FlashcardSrsState,
  GamificationProfile,
  IsoDayOfWeek,
  Question,
  QuestionOptionIndex,
  QuestionStats,
  StudyBlock,
  StudySession,
  StudySessionType,
  SyncEntityType,
  Topic,
  TopicStatus,
  WeeklyPlanItem,
} from '../models/study.models';

export interface SupabaseSyncRow {
  user_id: string;
  id?: string;
  updated_at: string;
  server_updated_at?: string;
  deleted_at?: string | null;
  [key: string]: unknown;
}

export const SYNC_ENTITY_TABLE_MAP: Record<SyncEntityType, string> = {
  blocks: 'study_blocks',
  topics: 'topics',
  studySessions: 'study_sessions',
  weeklyPlanItems: 'weekly_plan_items',
  caseStudies: 'case_studies',
  questions: 'questions',
  examAttempts: 'exam_attempts',
  flashcards: 'flashcards',
  gamification: 'gamification_profiles',
};

export const ALL_SYNC_ENTITY_TYPES: SyncEntityType[] = [
  'blocks',
  'topics',
  'studySessions',
  'weeklyPlanItems',
  'caseStudies',
  'questions',
  'examAttempts',
  'flashcards',
  'gamification',
];

export function isRemoteNewer(localUpdatedAt?: string, remoteUpdatedAt?: string): boolean {
  if (!remoteUpdatedAt) {
    return false;
  }
  const remoteTime = Date.parse(remoteUpdatedAt);
  if (Number.isNaN(remoteTime)) {
    return false;
  }
  if (!localUpdatedAt) {
    return true;
  }
  const localTime = Date.parse(localUpdatedAt);
  if (Number.isNaN(localTime)) {
    return true;
  }
  return remoteTime >= localTime;
}

export function blockToRow(userId: string, block: StudyBlock, nowIso: string): SupabaseSyncRow {
  return {
    user_id: userId,
    id: block.id,
    code: block.code,
    title: block.title,
    short_title: block.shortTitle,
    description: block.description ?? '',
    color: block.color,
    icon: block.icon,
    order: block.order,
    updated_at: block.updatedAt ?? nowIso,
    deleted_at: null,
  };
}

export function rowToBlock(row: SupabaseSyncRow): StudyBlock {
  return {
    id: String(row['id']),
    code: String(row['code'] ?? ''),
    title: String(row['title'] ?? ''),
    shortTitle: String(row['short_title'] ?? row['title'] ?? ''),
    description: String(row['description'] ?? ''),
    color: String(row['color'] ?? '#0891b2'),
    icon: String(row['icon'] ?? 'menu_book'),
    order: Number(row['order'] ?? 0),
    updatedAt: String(row['updated_at']),
  };
}

export function topicToRow(userId: string, topic: Topic): SupabaseSyncRow {
  return {
    user_id: userId,
    id: topic.id,
    block_id: topic.blockId,
    order: topic.order,
    title: topic.title,
    status: topic.status,
    round_count: topic.roundCount,
    tags: topic.tags ?? [],
    content_json: topic.contentJson ?? null,
    plain_text: topic.plainText ?? '',
    custom_outline_md: topic.customOutlineMd ?? null,
    created_at: topic.createdAt,
    updated_at: topic.updatedAt,
    last_reviewed_at: topic.lastReviewedAt ?? null,
    deleted_at: null,
  };
}

export function rowToTopic(row: SupabaseSyncRow): Topic {
  return {
    id: String(row['id']),
    blockId: String(row['block_id']),
    order: Number(row['order'] ?? 0),
    title: String(row['title'] ?? ''),
    status: (row['status'] as TopicStatus) ?? 'pending',
    roundCount: Number(row['round_count'] ?? 0),
    tags: Array.isArray(row['tags']) ? (row['tags'] as string[]) : [],
    contentJson: row['content_json'] ?? null,
    plainText: String(row['plain_text'] ?? ''),
    customOutlineMd:
      typeof row['custom_outline_md'] === 'string' ? row['custom_outline_md'] : undefined,
    createdAt: String(row['created_at'] ?? row['updated_at']),
    updatedAt: String(row['updated_at']),
    lastReviewedAt:
      typeof row['last_reviewed_at'] === 'string' ? row['last_reviewed_at'] : undefined,
  };
}

export function studySessionToRow(
  userId: string,
  session: StudySession,
  nowIso: string,
): SupabaseSyncRow {
  return {
    user_id: userId,
    id: session.id,
    topic_id: session.topicId,
    block_id: session.blockId,
    started_at: session.startedAt,
    ended_at: session.endedAt,
    duration_minutes: session.durationMinutes,
    type: session.type,
    notes: session.notes ?? null,
    updated_at: session.updatedAt ?? session.endedAt ?? nowIso,
    deleted_at: null,
  };
}

export function rowToStudySession(row: SupabaseSyncRow): StudySession {
  return {
    id: String(row['id']),
    topicId: String(row['topic_id']),
    blockId: String(row['block_id']),
    startedAt: String(row['started_at']),
    endedAt: String(row['ended_at']),
    durationMinutes: Number(row['duration_minutes'] ?? 0),
    type: (row['type'] as StudySessionType) ?? 'reading',
    notes: typeof row['notes'] === 'string' ? row['notes'] : undefined,
    updatedAt: String(row['updated_at']),
  };
}

export function weeklyPlanItemToRow(
  userId: string,
  item: WeeklyPlanItem,
  nowIso: string,
): SupabaseSyncRow {
  return {
    user_id: userId,
    id: item.id,
    week_start_date: item.weekStartDate,
    day_of_week: item.dayOfWeek,
    topic_id: item.topicId,
    block_id: item.blockId,
    order: item.order,
    completed: item.completed,
    completed_at: item.completedAt ?? null,
    target_pomodoros: item.targetPomodoros ?? null,
    updated_at: item.updatedAt ?? nowIso,
    deleted_at: null,
  };
}

export function rowToWeeklyPlanItem(row: SupabaseSyncRow): WeeklyPlanItem {
  return {
    id: String(row['id']),
    weekStartDate: String(row['week_start_date']),
    dayOfWeek: Number(row['day_of_week'] ?? 1) as IsoDayOfWeek,
    topicId: String(row['topic_id']),
    blockId: String(row['block_id']),
    order: Number(row['order'] ?? 0),
    completed: Boolean(row['completed']),
    completedAt: typeof row['completed_at'] === 'string' ? row['completed_at'] : undefined,
    targetPomodoros:
      typeof row['target_pomodoros'] === 'number' ? row['target_pomodoros'] : undefined,
    updatedAt: String(row['updated_at']),
  };
}

export function caseStudyToRow(userId: string, cs: CaseStudy): SupabaseSyncRow {
  return {
    user_id: userId,
    id: cs.id,
    block_id: cs.blockId,
    title: cs.title,
    statement: cs.statement,
    source: cs.source ?? null,
    tags: cs.tags ?? [],
    created_at: cs.createdAt,
    updated_at: cs.updatedAt,
    deleted_at: null,
  };
}

export function rowToCaseStudy(row: SupabaseSyncRow): CaseStudy {
  return {
    id: String(row['id']),
    blockId: String(row['block_id']),
    title: String(row['title'] ?? ''),
    statement: String(row['statement'] ?? ''),
    source: typeof row['source'] === 'string' ? row['source'] : undefined,
    tags: Array.isArray(row['tags']) ? (row['tags'] as string[]) : [],
    createdAt: String(row['created_at'] ?? row['updated_at']),
    updatedAt: String(row['updated_at']),
  };
}

export function questionToRow(userId: string, q: Question): SupabaseSyncRow {
  return {
    user_id: userId,
    id: q.id,
    block_id: q.blockId,
    topic_id: q.topicId ?? null,
    case_study_id: q.caseStudyId ?? null,
    prompt: q.prompt,
    options: q.options,
    correct_index: q.correctIndex,
    explanation: q.explanation ?? null,
    reference: q.reference ?? null,
    source: q.source ?? null,
    tags: q.tags ?? [],
    flagged: q.flagged,
    stats: q.stats,
    created_at: q.createdAt,
    updated_at: q.updatedAt,
    deleted_at: null,
  };
}

export function rowToQuestion(row: SupabaseSyncRow): Question {
  const rawOptions = Array.isArray(row['options']) ? (row['options'] as string[]) : ['', '', '', ''];
  const options: [string, string, string, string] = [
    String(rawOptions[0] ?? ''),
    String(rawOptions[1] ?? ''),
    String(rawOptions[2] ?? ''),
    String(rawOptions[3] ?? ''),
  ];
  const rawStats = (row['stats'] ?? {}) as Partial<QuestionStats>;

  return {
    id: String(row['id']),
    blockId: String(row['block_id']),
    topicId: typeof row['topic_id'] === 'string' ? row['topic_id'] : undefined,
    caseStudyId: typeof row['case_study_id'] === 'string' ? row['case_study_id'] : undefined,
    prompt: String(row['prompt'] ?? ''),
    options,
    correctIndex: Number(row['correct_index'] ?? 0) as QuestionOptionIndex,
    explanation: typeof row['explanation'] === 'string' ? row['explanation'] : undefined,
    reference: typeof row['reference'] === 'string' ? row['reference'] : undefined,
    source: typeof row['source'] === 'string' ? row['source'] : undefined,
    tags: Array.isArray(row['tags']) ? (row['tags'] as string[]) : [],
    flagged: Boolean(row['flagged']),
    stats: {
      attempts: Number(rawStats.attempts ?? 0),
      correct: Number(rawStats.correct ?? 0),
      lastAnsweredAt:
        typeof rawStats.lastAnsweredAt === 'string' ? rawStats.lastAnsweredAt : undefined,
      lastResult: rawStats.lastResult,
    },
    createdAt: String(row['created_at'] ?? row['updated_at']),
    updatedAt: String(row['updated_at']),
  };
}

export function examAttemptToRow(
  userId: string,
  attempt: ExamAttempt,
  nowIso: string,
): SupabaseSyncRow {
  return {
    user_id: userId,
    id: attempt.id,
    title: attempt.title,
    date: attempt.date,
    mode: attempt.mode,
    penalty_ratio: attempt.penaltyRatio,
    case_study_id: attempt.caseStudyId ?? null,
    answers: attempt.answers,
    correct_count: attempt.correctCount,
    wrong_count: attempt.wrongCount,
    blank_count: attempt.blankCount,
    net_score: attempt.netScore,
    max_score: attempt.maxScore,
    score_on_10: attempt.scoreOn10,
    duration_sec: attempt.durationSec,
    updated_at: attempt.updatedAt ?? attempt.date ?? nowIso,
    deleted_at: null,
  };
}

export function rowToExamAttempt(row: SupabaseSyncRow): ExamAttempt {
  return {
    id: String(row['id']),
    title: String(row['title'] ?? 'Test de práctica'),
    date: String(row['date']),
    mode: (row['mode'] as ExamMode) ?? 'practice',
    penaltyRatio: Number(row['penalty_ratio'] ?? 0),
    caseStudyId: typeof row['case_study_id'] === 'string' ? row['case_study_id'] : undefined,
    answers: Array.isArray(row['answers']) ? (row['answers'] as ExamAnswer[]) : [],
    correctCount: Number(row['correct_count'] ?? 0),
    wrongCount: Number(row['wrong_count'] ?? 0),
    blankCount: Number(row['blank_count'] ?? 0),
    netScore: Number(row['net_score'] ?? 0),
    maxScore: Number(row['max_score'] ?? 0),
    scoreOn10: Number(row['score_on_10'] ?? 0),
    durationSec: Number(row['duration_sec'] ?? 0),
    updatedAt: String(row['updated_at']),
  };
}

export function flashcardToRow(userId: string, fc: Flashcard): SupabaseSyncRow {
  return {
    user_id: userId,
    id: fc.id,
    block_id: fc.blockId,
    topic_id: fc.topicId ?? null,
    front: fc.front,
    back: fc.back,
    hint: fc.hint ?? null,
    tags: fc.tags ?? [],
    srs: fc.srs,
    created_at: fc.createdAt,
    updated_at: fc.updatedAt,
    deleted_at: null,
  };
}

export function rowToFlashcard(row: SupabaseSyncRow): Flashcard {
  const rawSrs = (row['srs'] ?? {}) as Partial<FlashcardSrsState>;
  return {
    id: String(row['id']),
    blockId: String(row['block_id']),
    topicId: typeof row['topic_id'] === 'string' ? row['topic_id'] : undefined,
    front: String(row['front'] ?? ''),
    back: String(row['back'] ?? ''),
    hint: typeof row['hint'] === 'string' ? row['hint'] : undefined,
    tags: Array.isArray(row['tags']) ? (row['tags'] as string[]) : [],
    srs: {
      intervalDays: Number(rawSrs.intervalDays ?? 0),
      easeFactor: Number(rawSrs.easeFactor ?? 2.5),
      repetitions: Number(rawSrs.repetitions ?? 0),
      lapses: Number(rawSrs.lapses ?? 0),
      dueDate: String(rawSrs.dueDate ?? new Date().toISOString().slice(0, 10)),
      lastReviewedAt:
        typeof rawSrs.lastReviewedAt === 'string' ? rawSrs.lastReviewedAt : undefined,
    },
    createdAt: String(row['created_at'] ?? row['updated_at']),
    updatedAt: String(row['updated_at']),
  };
}

export function gamificationToRow(
  userId: string,
  profile: GamificationProfile,
): SupabaseSyncRow {
  return {
    user_id: userId,
    xp: profile.xp,
    streak_days: profile.streakDays,
    longest_streak_days: profile.longestStreakDays,
    streak_freezes: profile.streakFreezes,
    max_streak_freezes: profile.maxStreakFreezes,
    last_active_date: profile.lastActiveDate ?? null,
    active_dates: profile.activeDates ?? [],
    freeze_used_dates: profile.freezeUsedDates ?? [],
    weekly_rest_days: profile.weeklyRestDays ?? [0],
    claimed_mission_ids: profile.claimedMissionIds ?? [],
    updated_at: profile.updatedAt,
  };
}

export function rowToGamification(row: SupabaseSyncRow): GamificationProfile {
  return {
    id: 'local-user',
    xp: Number(row['xp'] ?? 0),
    streakDays: Number(row['streak_days'] ?? 0),
    longestStreakDays: Number(row['longest_streak_days'] ?? 0),
    streakFreezes: Number(row['streak_freezes'] ?? 2),
    maxStreakFreezes: Number(row['max_streak_freezes'] ?? 3),
    lastActiveDate:
      typeof row['last_active_date'] === 'string' ? row['last_active_date'] : undefined,
    activeDates: Array.isArray(row['active_dates']) ? (row['active_dates'] as string[]) : [],
    freezeUsedDates: Array.isArray(row['freeze_used_dates'])
      ? (row['freeze_used_dates'] as string[])
      : [],
    weeklyRestDays: Array.isArray(row['weekly_rest_days'])
      ? (row['weekly_rest_days'] as number[])
      : [0],
    claimedMissionIds: Array.isArray(row['claimed_mission_ids'])
      ? (row['claimed_mission_ids'] as string[])
      : [],
    updatedAt: String(row['updated_at']),
  };
}
