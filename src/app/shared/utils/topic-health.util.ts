import { Topic } from '../../core/models/study.models';

export type TopicHealthLevel = 'unstarted' | 'fresh' | 'attention' | 'rusty' | 'critical';

export interface TopicHealthInfo {
  level: TopicHealthLevel;
  label: string;
  daysSinceReview: number | null;
  shortAgeLabel: string;
  needsReview: boolean;
}

export const TOPIC_HEALTH_LABELS: Record<TopicHealthLevel, string> = {
  unstarted: 'Sin empezar',
  fresh: 'Fresco (0–7d)',
  attention: 'Atención (8–15d)',
  rusty: 'Oxidado (16–30d)',
  critical: 'Crítico (>30d)',
};

export const TOPIC_HEALTH_LEVELS: TopicHealthLevel[] = [
  'fresh',
  'attention',
  'rusty',
  'critical',
  'unstarted',
];

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function getDaysSinceIsoDate(isoDate: string | undefined, now: Date = new Date()): number | null {
  if (!isoDate) {
    return null;
  }
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const startOfNow = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTarget = Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  const diffDays = Math.floor((startOfNow - startOfTarget) / MS_PER_DAY);
  return Math.max(0, diffDays);
}

export function getTopicHealth(topic: Topic, now: Date = new Date()): TopicHealthInfo {
  const days = getDaysSinceIsoDate(topic.lastReviewedAt, now);

  if (days === null) {
    if (topic.status === 'pending') {
      return {
        level: 'unstarted',
        label: 'Sin empezar',
        daysSinceReview: null,
        shortAgeLabel: 'Sin empezar',
        needsReview: false,
      };
    }

    return {
      level: 'critical',
      label: 'Sin repaso registrado',
      daysSinceReview: null,
      shortAgeLabel: 'Sin repaso',
      needsReview: true,
    };
  }

  const shortAgeLabel = days === 0 ? 'Hoy' : days === 1 ? 'Ayer' : `Hace ${days}d`;

  if (days <= 7) {
    return {
      level: 'fresh',
      label: 'Fresco',
      daysSinceReview: days,
      shortAgeLabel,
      needsReview: false,
    };
  }

  if (days <= 15) {
    return {
      level: 'attention',
      label: 'Conviene repasar',
      daysSinceReview: days,
      shortAgeLabel,
      needsReview: false,
    };
  }

  if (days <= 30) {
    return {
      level: 'rusty',
      label: 'Oxidado',
      daysSinceReview: days,
      shortAgeLabel,
      needsReview: true,
    };
  }

  return {
    level: 'critical',
    label: 'Crítico',
    daysSinceReview: days,
    shortAgeLabel,
    needsReview: true,
  };
}

export function compareTopicsByUrgency(a: Topic, b: Topic, now: Date = new Date()): number {
  const healthA = getTopicHealth(a, now);
  const healthB = getTopicHealth(b, now);

  const priority: Record<TopicHealthLevel, number> = {
    critical: 0,
    rusty: 1,
    attention: 2,
    fresh: 3,
    unstarted: 4,
  };

  if (priority[healthA.level] !== priority[healthB.level]) {
    return priority[healthA.level] - priority[healthB.level];
  }

  const daysA = healthA.daysSinceReview ?? Number.MAX_SAFE_INTEGER;
  const daysB = healthB.daysSinceReview ?? Number.MAX_SAFE_INTEGER;
  if (daysA !== daysB) {
    return daysB - daysA;
  }

  return a.blockId.localeCompare(b.blockId) || a.order - b.order;
}
