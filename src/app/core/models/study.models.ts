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

// --- Fase 3: Motor de Tests y Simulacros TAI ---

export type ExamMode = 'practice' | 'simulation' | 'mistakes' | 'case_study';
export type QuestionOptionIndex = 0 | 1 | 2 | 3;

export const EXAM_MODE_LABELS: Record<ExamMode, string> = {
  practice: 'Práctica por tema / bloque',
  simulation: 'Simulacro oficial TAI',
  mistakes: 'Repaso de fallos y marcadas',
  case_study: 'Supuesto práctico',
};

export interface PenaltyPreset {
  label: string;
  shortLabel: string;
  ratio: number;
}

export const PENALTY_PRESETS: PenaltyPreset[] = [
  { label: 'Oficial INAP (-1/3)', shortLabel: '-1/3', ratio: 1 / 3 },
  { label: 'Penalización -1/4', shortLabel: '-1/4', ratio: 0.25 },
  { label: 'Penalización -1/2', shortLabel: '-1/2', ratio: 0.5 },
  { label: 'Sin penalización (0)', shortLabel: '0', ratio: 0 },
];

export interface CaseStudy {
  id: string;
  blockId: TaiBlockId;
  title: string;
  statement: string;
  source?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateCaseStudyInput {
  blockId: TaiBlockId;
  title: string;
  statement: string;
  source?: string;
  tags?: string[];
}

export interface UpdateCaseStudyPatch {
  blockId?: TaiBlockId;
  title?: string;
  statement?: string;
  source?: string;
  tags?: string[];
}

export interface QuestionStats {
  attempts: number;
  correct: number;
  lastAnsweredAt?: string;
  lastResult?: 'correct' | 'wrong' | 'blank';
}

export interface Question {
  id: string;
  blockId: TaiBlockId;
  topicId?: string;
  caseStudyId?: string;
  prompt: string;
  options: [string, string, string, string];
  correctIndex: QuestionOptionIndex;
  explanation?: string;
  reference?: string;
  source?: string;
  tags: string[];
  flagged: boolean;
  stats: QuestionStats;
  createdAt: string;
  updatedAt: string;
}

export interface CreateQuestionInput {
  blockId: TaiBlockId;
  topicId?: string;
  caseStudyId?: string;
  prompt: string;
  options: [string, string, string, string];
  correctIndex: QuestionOptionIndex;
  explanation?: string;
  reference?: string;
  source?: string;
  tags?: string[];
  flagged?: boolean;
}

export interface UpdateQuestionPatch {
  blockId?: TaiBlockId;
  topicId?: string;
  caseStudyId?: string;
  prompt?: string;
  options?: [string, string, string, string];
  correctIndex?: QuestionOptionIndex;
  explanation?: string;
  reference?: string;
  source?: string;
  tags?: string[];
  flagged?: boolean;
  stats?: QuestionStats;
}

export interface ExamAnswer {
  questionId: string;
  blockId: TaiBlockId;
  topicId?: string;
  selectedIndex: QuestionOptionIndex | null;
  correctIndex: QuestionOptionIndex;
  isCorrect: boolean;
}

export interface ExamAttempt {
  id: string;
  title: string;
  date: string;
  mode: ExamMode;
  penaltyRatio: number;
  caseStudyId?: string;
  answers: ExamAnswer[];
  correctCount: number;
  wrongCount: number;
  blankCount: number;
  netScore: number;
  maxScore: number;
  scoreOn10: number;
  durationSec: number;
}

export interface CreateExamAttemptInput {
  title: string;
  date?: string;
  mode: ExamMode;
  penaltyRatio: number;
  caseStudyId?: string;
  answers: ExamAnswer[];
  correctCount: number;
  wrongCount: number;
  blankCount: number;
  netScore: number;
  maxScore: number;
  scoreOn10: number;
  durationSec: number;
  logStudySession?: boolean;
}

export interface BackupPayload {
  schemaVersion: 1 | 2 | 3;
  appName: 'tai-study';
  exportedAt: string;
  blocks: TaiBlock[];
  topics: Topic[];
  studySessions?: StudySession[];
  weeklyPlanItems?: WeeklyPlanItem[];
  caseStudies?: CaseStudy[];
  questions?: Question[];
  examAttempts?: ExamAttempt[];
}
