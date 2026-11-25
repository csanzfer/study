export type StudyBlockId = string;

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

export interface StudyBlock {
  id: StudyBlockId;
  code: string;
  title: string;
  shortTitle: string;
  description: string;
  color: string;
  icon: string;
  order: number;
}

export interface CreateBlockInput {
  code: string;
  title: string;
  shortTitle?: string;
  description?: string;
  color: string;
  icon: string;
}

export interface UpdateBlockPatch {
  code?: string;
  title?: string;
  shortTitle?: string;
  description?: string;
  color?: string;
  icon?: string;
  order?: number;
}

export interface BlockColorPreset {
  name: string;
  hex: string;
}

export const BLOCK_COLOR_PRESETS: BlockColorPreset[] = [
  { name: 'Aguamarina', hex: '#0891b2' },
  { name: 'Azul', hex: '#2563eb' },
  { name: 'Turquesa', hex: '#0d9488' },
  { name: 'Violeta', hex: '#7c3aed' },
  { name: 'Esmeralda', hex: '#059669' },
  { name: 'Índigo', hex: '#4f46e5' },
  { name: 'Rosa', hex: '#db2777' },
  { name: 'Rojo', hex: '#dc2626' },
  { name: 'Naranja', hex: '#ea580c' },
  { name: 'Ámbar', hex: '#d97706' },
  { name: 'Verde', hex: '#16a34a' },
  { name: 'Pizarra', hex: '#475569' },
];

export interface BlockIconPreset {
  name: string;
  label: string;
}

export const BLOCK_ICON_PRESETS: BlockIconPreset[] = [
  { name: 'menu_book', label: 'Libro' },
  { name: 'school', label: 'Académico' },
  { name: 'science', label: 'Ciencia' },
  { name: 'code', label: 'Código' },
  { name: 'lan', label: 'Redes' },
  { name: 'memory', label: 'Hardware' },
  { name: 'account_balance', label: 'Derecho / Estado' },
  { name: 'gavel', label: 'Legislación' },
  { name: 'calculate', label: 'Matemáticas' },
  { name: 'translate', label: 'Idiomas' },
  { name: 'history_edu', label: 'Historia' },
  { name: 'psychology', label: 'Psicología' },
  { name: 'biotech', label: 'Biología' },
  { name: 'architecture', label: 'Arquitectura' },
  { name: 'public', label: 'Geografía / Mundo' },
  { name: 'terminal', label: 'Terminal' },
  { name: 'storage', label: 'Bases de datos' },
  { name: 'security', label: 'Seguridad' },
  { name: 'palette', label: 'Arte y Diseño' },
  { name: 'folder', label: 'General' },
];

export interface Topic {
  id: string;
  blockId: StudyBlockId;
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
  blockId: StudyBlockId;
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
  blockId: StudyBlockId;
  startedAt: string;
  endedAt: string;
  durationMinutes: number;
  type: StudySessionType;
  notes?: string;
}

export interface CreateStudySessionInput {
  topicId: string;
  blockId: StudyBlockId;
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
  blockId: StudyBlockId;
  order: number;
  completed: boolean;
  completedAt?: string;
  targetPomodoros?: number;
}

export interface CreateWeeklyPlanItemInput {
  weekStartDate: string;
  dayOfWeek: IsoDayOfWeek;
  topicId: string;
  blockId: StudyBlockId;
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

// --- Fase 3: Motor de Tests y Simulacros ---

export type ExamMode = 'practice' | 'simulation' | 'mistakes' | 'case_study';
export type QuestionOptionIndex = 0 | 1 | 2 | 3;

export const EXAM_MODE_LABELS: Record<ExamMode, string> = {
  practice: 'Práctica por tema / bloque',
  simulation: 'Simulacro de examen',
  mistakes: 'Repaso de fallos y marcadas',
  case_study: 'Supuesto práctico',
};

export interface PenaltyPreset {
  label: string;
  shortLabel: string;
  ratio: number;
}

export const PENALTY_PRESETS: PenaltyPreset[] = [
  { label: 'Penalización -1/3', shortLabel: '-1/3', ratio: 1 / 3 },
  { label: 'Penalización -1/4', shortLabel: '-1/4', ratio: 0.25 },
  { label: 'Penalización -1/2', shortLabel: '-1/2', ratio: 0.5 },
  { label: 'Sin penalización (0)', shortLabel: '0', ratio: 0 },
];

export interface CaseStudy {
  id: string;
  blockId: StudyBlockId;
  title: string;
  statement: string;
  source?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateCaseStudyInput {
  blockId: StudyBlockId;
  title: string;
  statement: string;
  source?: string;
  tags?: string[];
}

export interface UpdateCaseStudyPatch {
  blockId?: StudyBlockId;
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
  blockId: StudyBlockId;
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
  blockId: StudyBlockId;
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
  blockId?: StudyBlockId;
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
  blockId: StudyBlockId;
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

// --- Fase 4: Flashcards (SRS SM-2) y Gamificación ---

export type FlashcardRating = 'again' | 'hard' | 'good' | 'easy';

export const FLASHCARD_RATING_LABELS: Record<FlashcardRating, string> = {
  again: 'Otra vez',
  hard: 'Difícil',
  good: 'Bien',
  easy: 'Fácil',
};

export const FLASHCARD_SUGGESTED_TAGS: string[] = [
  'definiciones',
  'fechas',
  'fórmulas',
  'siglas',
  'conceptos',
  'vocabulario',
  'ejemplos',
  'resumen',
];

export interface FlashcardSrsState {
  intervalDays: number;
  easeFactor: number;
  repetitions: number;
  lapses: number;
  dueDate: string; // YYYY-MM-DD local
  lastReviewedAt?: string;
}

export interface Flashcard {
  id: string;
  blockId: StudyBlockId;
  topicId?: string;
  front: string;
  back: string;
  hint?: string;
  tags: string[];
  srs: FlashcardSrsState;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFlashcardInput {
  blockId: StudyBlockId;
  topicId?: string;
  front: string;
  back: string;
  hint?: string;
  tags?: string[];
}

export interface UpdateFlashcardPatch {
  blockId?: StudyBlockId;
  topicId?: string;
  front?: string;
  back?: string;
  hint?: string;
  tags?: string[];
  srs?: FlashcardSrsState;
}

export interface GamificationProfile {
  id: 'local-user';
  xp: number;
  streakDays: number;
  longestStreakDays: number;
  streakFreezes: number;
  maxStreakFreezes: number;
  lastActiveDate?: string; // YYYY-MM-DD local
  activeDates: string[];
  freezeUsedDates: string[];
  weeklyRestDays: number[]; // 0 = Domingo, 1 = Lunes ... 6 = Sábado
  claimedMissionIds: string[];
  updatedAt: string;
}

export function createDefaultGamificationProfile(
  nowIso: string = new Date().toISOString(),
): GamificationProfile {
  return {
    id: 'local-user',
    xp: 0,
    streakDays: 0,
    longestStreakDays: 0,
    streakFreezes: 2,
    maxStreakFreezes: 3,
    activeDates: [],
    freezeUsedDates: [],
    weeklyRestDays: [0],
    claimedMissionIds: [],
    updatedAt: nowIso,
  };
}

export interface BackupPayload {
  schemaVersion: 1 | 2 | 3 | 4 | 5;
  appName: 'tai-study' | 'crisisstudent';
  exportedAt: string;
  blocks: StudyBlock[];
  topics: Topic[];
  studySessions?: StudySession[];
  weeklyPlanItems?: WeeklyPlanItem[];
  caseStudies?: CaseStudy[];
  questions?: Question[];
  examAttempts?: ExamAttempt[];
  flashcards?: Flashcard[];
  gamificationProfile?: GamificationProfile;
}
