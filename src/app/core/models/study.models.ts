export type TaiBlockId = 'B1' | 'B2' | 'B3' | 'B4';

export type TopicStatus =
  | 'pending'
  | 'first_round'
  | 'outlined'
  | 'memorizing'
  | 'mastered';

export const TOPIC_STATUS_LIST: TopicStatus[] = [
  'pending',
  'first_round',
  'outlined',
  'memorizing',
  'mastered',
];

export const TOPIC_STATUS_LABELS: Record<TopicStatus, string> = {
  pending: 'Sin empezar',
  first_round: '1ª vuelta',
  outlined: 'Esquematizado',
  memorizing: 'Memorizando',
  mastered: 'Dominado',
};

export interface TaiBlock {
  id: TaiBlockId;
  code: string;
  title: string;
  shortTitle: string;
  description: string;
  color: string;
  icon: string;
  order: number;
}

export interface Topic {
  id: string;
  blockId: TaiBlockId;
  order: number;
  title: string;
  status: TopicStatus;
  roundCount: number;
  tags: string[];
  contentJson: unknown;
  plainText: string;
  customOutlineMd?: string;
  createdAt: string;
  updatedAt: string;
  lastReviewedAt?: string;
}

export interface CreateTopicInput {
  blockId: TaiBlockId;
  title: string;
  tags?: string[];
  status?: TopicStatus;
  contentJson?: unknown;
  plainText?: string;
}

export interface UpdateTopicPatch {
  title?: string;
  status?: TopicStatus;
  roundCount?: number;
  tags?: string[];
  contentJson?: unknown;
  plainText?: string;
  customOutlineMd?: string;
  lastReviewedAt?: string;
}

// --- Fase 2: Planificación, Vueltas y Pomodoro ---

export type StudySessionType = 'reading' | 'schema' | 'test' | 'flashcards';

export const STUDY_SESSION_TYPE_LABELS: Record<StudySessionType, string> = {
  reading: 'Lectura / Apuntes',
  schema: 'Esquema',
  test: 'Test',
  flashcards: 'Flashcards',
};

export interface StudySession {
  id: string;
  topicId: string;
  blockId: TaiBlockId;
  startedAt: string;
  endedAt: string;
  durationMinutes: number;
  type: StudySessionType;
  notes?: string;
}

export interface CreateStudySessionInput {
  topicId: string;
  blockId: TaiBlockId;
  startedAt?: string;
  endedAt?: string;
  durationMinutes: number;
  type: StudySessionType;
  notes?: string;
}

export type IsoDayOfWeek = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface WeeklyPlanItem {
  id: string;
  weekStartDate: string; // Lunes de la semana: YYYY-MM-DD
  dayOfWeek: IsoDayOfWeek;
  topicId: string;
  blockId: TaiBlockId;
  order: number;
  completed: boolean;
  completedAt?: string;
  targetPomodoros?: number;
}

export interface CreateWeeklyPlanItemInput {
  weekStartDate: string;
  dayOfWeek: IsoDayOfWeek;
  topicId: string;
  blockId: TaiBlockId;
  targetPomodoros?: number;
}

export interface PomodoroSettings {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  cyclesBeforeLongBreak: number;
  soundEnabled: boolean;
}

export const DEFAULT_POMODORO_SETTINGS: PomodoroSettings = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  cyclesBeforeLongBreak: 4,
  soundEnabled: true,
};

export interface BackupPayload {
  schemaVersion: 1 | 2;
  appName: 'tai-study';
  exportedAt: string;
  blocks: TaiBlock[];
  topics: Topic[];
  studySessions?: StudySession[];
  weeklyPlanItems?: WeeklyPlanItem[];
}
