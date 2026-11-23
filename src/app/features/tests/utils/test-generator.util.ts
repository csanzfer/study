import {
  ExamMode,
  Question,
  TaiBlockId,
} from '../../../core/models/study.models';

export type MistakesFilter = 'both' | 'failed' | 'flagged';

export interface TestGenerationConfig {
  mode: ExamMode;
  title?: string;
  blockIds?: TaiBlockId[];
  topicId?: string;
  caseStudyId?: string;
  questionCount?: number;
  blockQuotas?: Partial<Record<TaiBlockId, number>>;
  mistakesFilter?: MistakesFilter;
  onlyUnanswered?: boolean;
  shuffle?: boolean;
}

export interface TestGenerationResult {
  questions: Question[];
  warnings: string[];
}

export function shuffleArray<T>(items: readonly T[], rng: () => number = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function isQuestionFailed(question: Question): boolean {
  if (question.stats.attempts === 0) {
    return false;
  }
  return (
    question.stats.lastResult === 'wrong' ||
    question.stats.correct < question.stats.attempts
  );
}

function failurePriorityScore(question: Question): number {
  let score = 0;
  if (question.stats.lastResult === 'wrong') {
    score += 100;
  }
  if (question.flagged) {
    score += 40;
  }
  if (question.stats.attempts > 0) {
    const wrongRate = 1 - question.stats.correct / question.stats.attempts;
    score += wrongRate * 50;
  }
  return score;
}

export function generateTestQuestions(
  allQuestions: readonly Question[],
  config: TestGenerationConfig,
  rng: () => number = Math.random,
): TestGenerationResult {
  const warnings: string[] = [];
  const shouldShuffle = config.shuffle !== false;

  if (config.mode === 'case_study') {
    if (!config.caseStudyId) {
      return { questions: [], warnings: [] };
    }
    const matching = allQuestions.filter((q) => q.caseStudyId === config.caseStudyId);
    const ordered = shouldShuffle ? shuffleArray(matching, rng) : [...matching];
    if (ordered.length === 0) {
      warnings.push('Este supuesto práctico aún no tiene preguntas asociadas.');
    }
    return { questions: ordered, warnings };
  }

  if (config.mode === 'mistakes') {
    const filter = config.mistakesFilter ?? 'both';
    let pool = allQuestions.filter((q) => {
      if (config.blockIds && config.blockIds.length > 0 && !config.blockIds.includes(q.blockId)) {
        return false;
      }
      if (config.topicId && q.topicId !== config.topicId) {
        return false;
      }
      const failed = isQuestionFailed(q);
      if (filter === 'failed') return failed;
      if (filter === 'flagged') return q.flagged;
      return failed || q.flagged;
    });

    // Sort by failure urgency first, with slight tie-breaking shuffle if requested
    const shuffled = shouldShuffle ? shuffleArray(pool, rng) : [...pool];
    pool = shuffled.sort((a, b) => failurePriorityScore(b) - failurePriorityScore(a));

    const limit = config.questionCount ?? 25;
    return { questions: pool.slice(0, limit), warnings };
  }

  if (config.mode === 'simulation') {
    const quotas = config.blockQuotas;
    if (quotas) {
      const selected: Question[] = [];
      for (const blockId of ['B1', 'B2', 'B3', 'B4'] as TaiBlockId[]) {
        const quota = Math.max(0, Math.floor(quotas[blockId] ?? 0));
        if (quota === 0) continue;

        const blockPool = allQuestions.filter((q) => q.blockId === blockId);
        const picked = (shouldShuffle ? shuffleArray(blockPool, rng) : blockPool).slice(0, quota);
        if (picked.length < quota) {
          warnings.push(
            `${blockId}: solicitadas ${quota}, disponibles ${picked.length}.`,
          );
        }
        selected.push(...picked);
      }
      return {
        questions: shouldShuffle ? shuffleArray(selected, rng) : selected,
        warnings,
      };
    }

    // Fallback if no explicit quotas: pick across selected blocks up to questionCount
    let pool = allQuestions.filter((q) =>
      config.blockIds && config.blockIds.length > 0 ? config.blockIds.includes(q.blockId) : true,
    );
    pool = shouldShuffle ? shuffleArray(pool, rng) : [...pool];
    const limit = config.questionCount ?? 80;
    if (pool.length < limit) {
      warnings.push(`Solicitadas ${limit} preguntas, disponibles ${pool.length}.`);
    }
    return { questions: pool.slice(0, limit), warnings };
  }

  // Default: 'practice'
  let pool = allQuestions.filter((q) => {
    if (config.blockIds && config.blockIds.length > 0 && !config.blockIds.includes(q.blockId)) {
      return false;
    }
    if (config.topicId && q.topicId !== config.topicId) {
      return false;
    }
    if (config.onlyUnanswered && q.stats.attempts > 0) {
      return false;
    }
    return true;
  });

  pool = shouldShuffle ? shuffleArray(pool, rng) : [...pool];
  const limit = config.questionCount ?? 20;
  return { questions: pool.slice(0, limit), warnings };
}
