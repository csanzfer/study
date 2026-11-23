import {
  ExamAttempt,
  Flashcard,
  GamificationProfile,
  Question,
  StudySession,
  TaiBlock,
  Topic,
  WeeklyPlanItem,
} from '../../../core/models/study.models';
import {
  isFlashcardDue,
  wasFlashcardReviewedOnDate,
} from '../../../shared/utils/srs-sm2.util';
import { compareTopicsByUrgency, getTopicHealth } from '../../../shared/utils/topic-health.util';
import {
  formatLocalDateKey,
  getIsoDayOfWeek,
  getWeekStartDate,
} from '../../../shared/utils/week-date.util';

export interface DailyMission {
  id: string;
  kind: 'flashcards' | 'acronyms' | 'pomodoro' | 'tests' | 'planner';
  title: string;
  description: string;
  icon: string;
  xpReward: number;
  current: number;
  target: number;
  completed: boolean;
  claimed: boolean;
  actionLabel: string;
  route: string[];
  queryParams?: Record<string, string>;
}

export interface DailyMissionsContext {
  blocks: TaiBlock[];
  topics: Topic[];
  flashcards: Flashcard[];
  questions: Question[];
  studySessions: StudySession[];
  weeklyPlanItems: WeeklyPlanItem[];
  examAttempts: ExamAttempt[];
  profile: GamificationProfile;
  today?: Date;
}

export function generateDailyMissions(ctx: DailyMissionsContext): DailyMission[] {
  const today = ctx.today ?? new Date();
  const todayKey = formatLocalDateKey(today);
  const weekStart = getWeekStartDate(today);
  const isoDay = getIsoDayOfWeek(today);
  const claimedSet = new Set(ctx.profile.claimedMissionIds ?? []);
  const missions: DailyMission[] = [];

  // 1. Flashcards / Acronym mission
  const dueCards = ctx.flashcards.filter((card) => isFlashcardDue(card, today));
  const reviewedTodayCount = ctx.flashcards.filter((card) =>
    wasFlashcardReviewedOnDate(card, todayKey),
  ).length;
  const acronymCards = ctx.flashcards.filter((card) =>
    card.tags.some((t) => t.toLowerCase() === 'siglas'),
  );
  const reviewedAcronymsToday = acronymCards.filter((card) =>
    wasFlashcardReviewedOnDate(card, todayKey),
  ).length;

  const createdTodayCount = ctx.flashcards.filter((card) => {
    const created = new Date(card.createdAt);
    return !Number.isNaN(created.getTime()) && formatLocalDateKey(created) === todayKey;
  }).length;
  const cardsBeforeToday = ctx.flashcards.length - createdTodayCount;
  const startMissionId = `${todayKey}:flashcards-start`;
  const showStarterMission =
    ctx.flashcards.length === 0 || (cardsBeforeToday < 5 && !claimedSet.has(startMissionId));

  if (showStarterMission) {
    missions.push({
      id: startMissionId,
      kind: 'flashcards',
      title: 'Crea tus primeras 5 flashcards o siglas',
      description: 'Empieza tu mazo de repetición espaciada desde un apunte o con el pack TAI.',
      icon: 'style',
      xpReward: 40,
      current: Math.min(5, ctx.flashcards.length),
      target: 5,
      completed: ctx.flashcards.length >= 5,
      claimed: claimedSet.has(startMissionId),
      actionLabel: 'Ir al mazo',
      route: ['/flashcards'],
      queryParams: { tab: 'deck' },
    });
  } else {
    const dueNotYetReviewedToday = dueCards.filter(
      (card) => !wasFlashcardReviewedOnDate(card, todayKey),
    ).length;
    const desiredTarget = Math.max(5, dueNotYetReviewedToday + reviewedTodayCount);
    const targetReviews = Math.min(ctx.flashcards.length, 15, desiredTarget);
    const missionId = `${todayKey}:flashcards-review`;
    missions.push({
      id: missionId,
      kind: 'flashcards',
      title: `Repasa ${targetReviews} flashcard${targetReviews === 1 ? '' : 's'} hoy`,
      description:
        dueCards.length > 0
          ? `Tienes ${dueCards.length} tarjeta(s) vencidas esperando en tu cola diaria.`
          : 'Mantén fresca la memoria a largo plazo con una tanda rápida.',
      icon: 'style',
      xpReward: 45,
      current: Math.min(targetReviews, reviewedTodayCount),
      target: targetReviews,
      completed: reviewedTodayCount >= targetReviews,
      claimed: claimedSet.has(missionId),
      actionLabel: 'Repasar ahora',
      route: ['/flashcards'],
      queryParams: { tab: 'review' },
    });
  }

  if (acronymCards.length >= 3) {
    const targetAcronyms = Math.min(8, acronymCards.length);
    const acronymMissionId = `${todayKey}:acronyms-review`;
    missions.push({
      id: acronymMissionId,
      kind: 'acronyms',
      title: `Domina ${targetAcronyms} siglas TAI`,
      description: 'Refuerza acrónimos clave de los bloques de informática y administración.',
      icon: 'spellcheck',
      xpReward: 35,
      current: Math.min(targetAcronyms, reviewedAcronymsToday),
      target: targetAcronyms,
      completed: reviewedAcronymsToday >= targetAcronyms,
      claimed: claimedSet.has(acronymMissionId),
      actionLabel: 'Repasar siglas',
      route: ['/flashcards'],
      queryParams: { tab: 'review', tag: 'siglas' },
    });
  }

  // 2. Focus / Pomodoro mission (prioritize today's weekly plan or rustiest topic)
  const todayPlanItems = ctx.weeklyPlanItems.filter(
    (item) => item.weekStartDate === weekStart && item.dayOfWeek === isoDay,
  );
  const pendingPlanToday = todayPlanItems.find((item) => !item.completed);
  const rustyTopics = ctx.topics
    .filter((topic) => getTopicHealth(topic, today).needsReview)
    .sort((a, b) => compareTopicsByUrgency(a, b, today));

  const focusMinutesToday = ctx.studySessions
    .filter((session) => {
      const date = new Date(session.startedAt);
      return !Number.isNaN(date.getTime()) && formatLocalDateKey(date) === todayKey;
    })
    .reduce((sum, session) => sum + session.durationMinutes, 0);

  if (todayPlanItems.length > 0) {
    const completedTodayPlan = todayPlanItems.filter((i) => i.completed).length;
    const allPlanCompleted = completedTodayPlan >= todayPlanItems.length;
    const topic = pendingPlanToday
      ? ctx.topics.find((t) => t.id === pendingPlanToday.topicId)
      : undefined;
    const planMissionId = `${todayKey}:weekly-plan`;
    missions.push({
      id: planMissionId,
      kind: 'planner',
      title: allPlanCompleted
        ? 'Objetivos planificados de hoy completados'
        : topic
          ? `Completa tu objetivo: ${topic.title}`
          : 'Completa tus objetivos planificados de hoy',
      description: `${completedTodayPlan}/${todayPlanItems.length} tema(s) del plan de hoy completados.`,
      icon: 'event_available',
      xpReward: 50,
      current: completedTodayPlan,
      target: todayPlanItems.length,
      completed: allPlanCompleted,
      claimed: claimedSet.has(planMissionId),
      actionLabel: 'Ver planificador',
      route: ['/planner'],
      queryParams: { tab: 'weekly' },
    });
  } else {
    const targetMinutes = 25;
    const suggestedTopic = rustyTopics[0] ?? ctx.topics[0];
    const pomodoroMissionId = `${todayKey}:pomodoro-focus`;
    missions.push({
      id: pomodoroMissionId,
      kind: 'pomodoro',
      title: suggestedTopic
        ? `Completa 1 Pomodoro (${targetMinutes} min) · ${suggestedTopic.title}`
        : `Completa 1 bloque de enfoque (${targetMinutes} min)`,
      description: rustyTopics.length > 0
        ? 'Tema prioritario detectado en tu mapa de salud del temario.'
        : 'Suma al menos 25 minutos de estudio enfocado hoy.',
      icon: 'timer',
      xpReward: 40,
      current: Math.min(targetMinutes, focusMinutesToday),
      target: targetMinutes,
      completed: focusMinutesToday >= targetMinutes,
      claimed: claimedSet.has(pomodoroMissionId),
      actionLabel: 'Abrir Pomodoro',
      route: ['/planner'],
      queryParams: { tab: 'pomodoro' },
    });
  }

  // 3. Tests / Mistakes mission
  const failedCount = ctx.questions.filter(
    (q) => q.stats.attempts > 0 && (q.stats.lastResult === 'wrong' || q.stats.correct < q.stats.attempts),
  ).length;
  const attemptsToday = ctx.examAttempts.filter((attempt) => {
    const date = new Date(attempt.date);
    return !Number.isNaN(date.getTime()) && formatLocalDateKey(date) === todayKey;
  }).length;

  if (ctx.questions.length > 0) {
    const testMissionId = `${todayKey}:daily-test`;
    missions.push({
      id: testMissionId,
      kind: 'tests',
      title:
        failedCount > 0
          ? `Repasa tus fallos en test (${failedCount} disponibles)`
          : 'Completa 1 test de práctica hoy',
      description:
        failedCount > 0
          ? 'Atacar tus preguntas falladas sube rápidamente tu nota neta.'
          : 'Mantén el ritmo tipo examen oficial INAP.',
      icon: 'quiz',
      xpReward: 45,
      current: Math.min(1, attemptsToday),
      target: 1,
      completed: attemptsToday >= 1,
      claimed: claimedSet.has(testMissionId),
      actionLabel: failedCount > 0 ? 'Repasar fallos' : 'Lanzar test',
      route: ['/tests'],
      queryParams: { tab: 'launcher', mode: failedCount > 0 ? 'mistakes' : 'practice' },
    });
  }

  return missions.slice(0, 4);
}
