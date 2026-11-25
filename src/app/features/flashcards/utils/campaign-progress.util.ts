import {
  Flashcard,
  Question,
  StudyBlock,
  StudyBlockId,
  Topic,
} from '../../../core/models/study.models';
import { isFlashcardMastered } from '../../../shared/utils/srs-sm2.util';
import { tiptapJsonToOutlineMarkdown } from '../../../shared/utils/tiptap-outline.util';

export interface TopicCampaignProgress {
  topicId: string;
  blockId: StudyBlockId;
  title: string;
  score: number; // 0..100
  level: number; // 1..5
  pillars: {
    rounds: { score: number; completed: boolean; label: string };
    schema: { score: number; completed: boolean; label: string };
    flashcards: { score: number; completed: boolean; total: number; mastered: number; label: string };
    tests: { score: number; completed: boolean; accuracy: number | null; attempts: number; label: string };
  };
  nextAction: {
    label: string;
    route: string[];
    queryParams?: Record<string, string>;
  };
}

export interface BlockCampaignProgress {
  block: StudyBlock;
  score: number; // 0..100
  level: number; // 1..5
  rankLabel: string;
  topicCount: number;
  completedTopics: number;
  pillarAverages: {
    rounds: number;
    schema: number;
    flashcards: number;
    tests: number;
  };
  topics: TopicCampaignProgress[];
}

export interface CampaignOverview {
  overallScore: number;
  overallLevel: number;
  blocks: BlockCampaignProgress[];
}

const RANK_LABELS = ['Sin explorar', 'Iniciado', 'En progreso', 'Avanzado', 'Conquistado'];

export function computeTopicCampaignProgress(
  topic: Topic,
  topicFlashcards: Flashcard[],
  topicQuestions: Question[],
): TopicCampaignProgress {
  // Pillar 1 (0..25): Topic status & rounds
  let roundsScore = 0;
  if (topic.status === 'mastered' || topic.roundCount >= 2) {
    roundsScore = 25;
  } else if (topic.status === 'memorizing' || topic.roundCount === 1) {
    roundsScore = 18;
  } else if (topic.status === 'outlined') {
    roundsScore = 12;
  } else if (topic.status === 'first_round') {
    roundsScore = 8;
  }
  const roundsCompleted = roundsScore >= 25;
  const roundsLabel =
    topic.roundCount > 0 ? `${topic.roundCount} vuelta(s)` : 'Sin vuelta completa';

  // Pillar 2 (0..25): Schema available (custom outline or structured headings in TipTap)
  const hasCustomOutline = Boolean(topic.customOutlineMd?.trim());
  const outlineResult = hasCustomOutline
    ? { headingCount: 1, itemCount: 1 }
    : tiptapJsonToOutlineMarkdown(topic.contentJson, { rootTitle: topic.title });
  const hasAutoSchema = outlineResult.headingCount > 0 || outlineResult.itemCount >= 3;
  const schemaScore = hasCustomOutline || hasAutoSchema ? 25 : topic.plainText.trim().length > 40 ? 10 : 0;
  const schemaCompleted = schemaScore >= 25;
  const schemaLabel = hasCustomOutline
    ? 'Esquema propio'
    : hasAutoSchema
      ? 'Esquema automático'
      : 'Sin esquema';

  // Pillar 3 (0..25): Flashcards mastery
  const totalFc = topicFlashcards.length;
  const masteredFc = topicFlashcards.filter((card) => isFlashcardMastered(card)).length;
  let flashcardsScore = 0;
  if (totalFc > 0) {
    const masteryRatio = masteredFc / totalFc;
    // Having cards grants 5 base pts, mastery fills remaining 20 pts
    flashcardsScore = Math.min(25, Math.round(5 + masteryRatio * 20));
  }
  const flashcardsCompleted = totalFc > 0 && masteredFc / totalFc >= 0.75;
  const flashcardsLabel =
    totalFc === 0 ? 'Sin flashcards' : `${masteredFc}/${totalFc} dominadas`;

  // Pillar 4 (0..25): Tests accuracy >= 75%
  let attempts = 0;
  let correct = 0;
  for (const q of topicQuestions) {
    attempts += q.stats.attempts;
    correct += q.stats.correct;
  }
  const accuracy = attempts > 0 ? Math.round((correct / attempts) * 100) : null;
  let testsScore = 0;
  if (accuracy !== null) {
    testsScore = accuracy >= 75 ? 25 : Math.round((accuracy / 75) * 20);
  }
  const testsCompleted = accuracy !== null && accuracy >= 75;
  const testsLabel =
    accuracy === null ? 'Sin intentos' : `${accuracy}% acierto (${attempts} resp.)`;

  const totalScore = Math.min(100, roundsScore + schemaScore + flashcardsScore + testsScore);
  const level = scoreToLevel(totalScore);

  let nextAction: TopicCampaignProgress['nextAction'];
  if (!schemaCompleted) {
    nextAction = {
      label: 'Completar apunte / esquema',
      route: ['/blocks', topic.blockId, 'topics', topic.id],
    };
  } else if (!flashcardsCompleted) {
    nextAction = {
      label: totalFc === 0 ? 'Crear flashcards del tema' : 'Repasar flashcards del tema',
      route: ['/flashcards'],
      queryParams: { tab: totalFc === 0 ? 'deck' : 'review', blockId: topic.blockId, topicId: topic.id },
    };
  } else if (!testsCompleted) {
    nextAction = {
      label: 'Practicar test del tema (objetivo ≥75%)',
      route: ['/tests'],
      queryParams: { tab: 'launcher', mode: 'practice' },
    };
  } else if (!roundsCompleted) {
    nextAction = {
      label: 'Completar vuelta del tema',
      route: ['/blocks', topic.blockId, 'topics', topic.id],
    };
  } else {
    nextAction = {
      label: 'Tema conquistado · Mantener repaso',
      route: ['/blocks', topic.blockId, 'topics', topic.id],
    };
  }

  return {
    topicId: topic.id,
    blockId: topic.blockId,
    title: topic.title,
    score: totalScore,
    level,
    pillars: {
      rounds: { score: roundsScore, completed: roundsCompleted, label: roundsLabel },
      schema: { score: schemaScore, completed: schemaCompleted, label: schemaLabel },
      flashcards: {
        score: flashcardsScore,
        completed: flashcardsCompleted,
        total: totalFc,
        mastered: masteredFc,
        label: flashcardsLabel,
      },
      tests: {
        score: testsScore,
        completed: testsCompleted,
        accuracy,
        attempts,
        label: testsLabel,
      },
    },
    nextAction,
  };
}

export function computeCampaignOverview(
  blocks: StudyBlock[],
  topics: Topic[],
  flashcards: Flashcard[],
  questions: Question[],
): CampaignOverview {
  const flashcardsByTopic = new Map<string, Flashcard[]>();
  for (const card of flashcards) {
    if (!card.topicId) continue;
    const list = flashcardsByTopic.get(card.topicId) ?? [];
    list.push(card);
    flashcardsByTopic.set(card.topicId, list);
  }

  const questionsByTopic = new Map<string, Question[]>();
  for (const q of questions) {
    if (!q.topicId) continue;
    const list = questionsByTopic.get(q.topicId) ?? [];
    list.push(q);
    questionsByTopic.set(q.topicId, list);
  }

  const blockProgresses: BlockCampaignProgress[] = blocks.map((block) => {
    const blockTopics = topics
      .filter((t) => t.blockId === block.id)
      .sort((a, b) => a.order - b.order);

    const topicProgresses = blockTopics.map((topic) =>
      computeTopicCampaignProgress(
        topic,
        flashcardsByTopic.get(topic.id) ?? [],
        questionsByTopic.get(topic.id) ?? [],
      ),
    );

    if (topicProgresses.length === 0) {
      return {
        block,
        score: 0,
        level: 1,
        rankLabel: RANK_LABELS[0],
        topicCount: 0,
        completedTopics: 0,
        pillarAverages: { rounds: 0, schema: 0, flashcards: 0, tests: 0 },
        topics: [],
      };
    }

    const avgScore = Math.round(
      topicProgresses.reduce((sum, item) => sum + item.score, 0) / topicProgresses.length,
    );
    const level = scoreToLevel(avgScore);
    const completedTopics = topicProgresses.filter((t) => t.score >= 85).length;

    const avgPillar = (getter: (t: TopicCampaignProgress) => number) =>
      Math.round(
        (topicProgresses.reduce((sum, item) => sum + getter(item), 0) /
          (topicProgresses.length * 25)) *
          100,
      );

    return {
      block,
      score: avgScore,
      level,
      rankLabel: RANK_LABELS[level - 1],
      topicCount: topicProgresses.length,
      completedTopics,
      pillarAverages: {
        rounds: avgPillar((t) => t.pillars.rounds.score),
        schema: avgPillar((t) => t.pillars.schema.score),
        flashcards: avgPillar((t) => t.pillars.flashcards.score),
        tests: avgPillar((t) => t.pillars.tests.score),
      },
      topics: topicProgresses,
    };
  });

  const nonEmptyBlocks = blockProgresses.filter((b) => b.topicCount > 0);
  const overallScore =
    nonEmptyBlocks.length > 0
      ? Math.round(
          nonEmptyBlocks.reduce((sum, b) => sum + b.score, 0) / nonEmptyBlocks.length,
        )
      : 0;

  return {
    overallScore,
    overallLevel: scoreToLevel(overallScore),
    blocks: blockProgresses,
  };
}

function scoreToLevel(score: number): number {
  if (score >= 85) return 5;
  if (score >= 65) return 4;
  if (score >= 40) return 3;
  if (score >= 15) return 2;
  return 1;
}
