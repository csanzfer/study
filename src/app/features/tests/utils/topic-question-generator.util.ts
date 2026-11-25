import {
  CreateQuestionInput,
  QuestionOptionIndex,
  Topic,
} from '../../../core/models/study.models';
import { shuffleArray } from './test-generator.util';

export type GenerationStrategy = 'table' | 'definition' | 'callout' | 'section_list';

export const GENERATION_STRATEGY_LABELS: Record<GenerationStrategy, string> = {
  table: 'Tabla comparativa',
  definition: 'Definición / Concepto',
  callout: 'Ojo examen / Dato clave',
  section_list: 'Lista por apartado',
};

export interface GeneratedQuestionDraft extends CreateQuestionInput {
  strategy: GenerationStrategy;
  strategyLabel: string;
}

export interface TopicGenerationOptions {
  maxQuestions?: number;
  rng?: () => number;
}

export interface AiPromptOptions {
  blockCode?: string;
  questionCount: number;
  difficulty: 'standard' | 'hard';
  focusCallouts: boolean;
}

export interface AiPromptResult {
  prompt: string;
  charCount: number;
  truncated: boolean;
}

interface TipTapNode {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: Array<{ type?: string }>;
  content?: TipTapNode[];
}

interface ExtractedTable {
  section: string;
  headers: string[];
  rows: string[][];
}

interface ExtractedDefinition {
  section: string;
  term: string;
  definition: string;
}

interface ExtractedSectionList {
  section: string;
  items: string[];
}

interface ExtractedCalloutOrFact {
  section: string;
  text: string;
  isCallout: boolean;
}

const MAX_PROMPT_SOURCE_CHARS = 18_000;

function normalizeSpaces(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function extractPlain(node: TipTapNode | undefined): string {
  if (!node || typeof node !== 'object') return '';
  if (node.type === 'text') return node.text ?? '';
  if (node.type === 'hardBreak') return ' ';
  if (!Array.isArray(node.content)) return '';
  const parts: string[] = [];
  for (const child of node.content) {
    const text = extractPlain(child);
    if (!text) continue;
    const isInline = child.type === 'text' || child.type === 'hardBreak';
    if (parts.length > 0 && !isInline) {
      parts.push(' ');
    }
    parts.push(text);
  }
  return normalizeSpaces(parts.join(''));
}

function truncateText(text: string, max = 140): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

function parseDefinitionFromText(text: string): { term: string; definition: string } | null {
  const clean = normalizeSpaces(text);
  // Match "Term: definition" or "Term — definition" or "Term - definition"
  const match = clean.match(/^([^:–—-]{2,65}?)\s*(?::|—|–|\s-\s)\s*(.{10,260})$/);
  if (!match) return null;
  const term = match[1].trim();
  const definition = match[2].trim();
  // Avoid matching sentences starting with URLs or "Nota:" / "Ejemplo:"
  if (/^(nota|ejemplo|ej|ver|http|https|ojo)$/i.test(term)) return null;
  if (term.split(' ').length > 8) return null;
  return { term, definition };
}

function extractStructures(topic: Topic): {
  tables: ExtractedTable[];
  definitions: ExtractedDefinition[];
  sectionLists: ExtractedSectionList[];
  facts: ExtractedCalloutOrFact[];
} {
  const tables: ExtractedTable[] = [];
  const definitions: ExtractedDefinition[] = [];
  const sectionLists: ExtractedSectionList[] = [];
  const facts: ExtractedCalloutOrFact[] = [];

  const root = topic.contentJson as TipTapNode | null | undefined;
  const topNodes = root && Array.isArray(root.content) ? root.content : [];

  let currentSection = topic.title;

  for (const node of topNodes) {
    if (!node || typeof node !== 'object') continue;

    if (node.type === 'heading') {
      const heading = extractPlain(node);
      if (heading) {
        currentSection = heading;
      }
      continue;
    }

    if (node.type === 'table') {
      const rows = (node.content ?? [])
        .filter((r) => r.type === 'tableRow')
        .map((r) =>
          (r.content ?? [])
            .filter((c) => c.type === 'tableHeader' || c.type === 'tableCell')
            .map((c) => extractPlain(c)),
        )
        .filter((r) => r.some((cell) => cell.length > 0));

      if (rows.length >= 2 && rows[0].length >= 2) {
        tables.push({
          section: currentSection,
          headers: rows[0],
          rows: rows.slice(1),
        });
      }
      continue;
    }

    if (node.type === 'examCallout') {
      const text = extractPlain(node);
      if (text.length >= 15) {
        facts.push({ section: currentSection, text, isCallout: true });
      }
      continue;
    }

    if (node.type === 'bulletList' || node.type === 'orderedList' || node.type === 'taskList') {
      const items: string[] = [];
      for (const li of node.content ?? []) {
        const text = extractPlain(li);
        if (!text) continue;
        const def = parseDefinitionFromText(text);
        if (def) {
          definitions.push({ section: currentSection, ...def });
        }
        if (text.length >= 4 && text.length <= 130) {
          items.push(text);
        }
      }
      if (items.length > 0) {
        const existing = sectionLists.find((s) => s.section === currentSection);
        if (existing) {
          existing.items.push(...items);
        } else {
          sectionLists.push({ section: currentSection, items });
        }
      }
      continue;
    }

    if (node.type === 'paragraph') {
      const text = extractPlain(node);
      if (!text) continue;
      const def = parseDefinitionFromText(text);
      if (def) {
        definitions.push({ section: currentSection, ...def });
      }
      if (text.length >= 25 && text.length <= 280) {
        facts.push({ section: currentSection, text, isCallout: false });
      }
    }
  }

  // Fallback to plainText lines if contentJson had no structured nodes
  if (
    tables.length === 0 &&
    definitions.length === 0 &&
    facts.length === 0 &&
    topic.plainText.trim()
  ) {
    const lines = topic.plainText
      .split(/\n+/)
      .map((l) => normalizeSpaces(l))
      .filter((l) => l.length >= 15);
    for (const line of lines) {
      const def = parseDefinitionFromText(line);
      if (def) {
        definitions.push({ section: topic.title, ...def });
      } else if (line.length <= 280) {
        facts.push({ section: topic.title, text: line, isCallout: false });
      }
    }
  }

  return { tables, definitions, sectionLists, facts };
}

function buildOptionsWithCorrect(
  correct: string,
  distractors: string[],
  rng: () => number,
): { options: [string, string, string, string]; correctIndex: QuestionOptionIndex } | null {
  const uniqueDistractors = Array.from(
    new Set(
      distractors
        .map((d) => normalizeSpaces(d))
        .filter((d) => d.length > 0 && d.toLowerCase() !== correct.toLowerCase()),
    ),
  );
  if (uniqueDistractors.length < 3) return null;

  const picked = shuffleArray(uniqueDistractors, rng).slice(0, 3);
  const all = shuffleArray([correct, ...picked], rng);
  const correctIndex = all.findIndex(
    (opt) => opt.toLowerCase() === correct.toLowerCase(),
  ) as QuestionOptionIndex;

  return {
    options: all as [string, string, string, string],
    correctIndex,
  };
}

function generateClozeFromFact(
  fact: ExtractedCalloutOrFact,
  topic: Topic,
  rng: () => number,
): GeneratedQuestionDraft | null {
  // 1. Time / deadline pattern: "3 meses", "10 días", "1 año", "15 días hábiles"
  const durationMatch = fact.text.match(
    /\b(\d{1,3})\s+(días?\s+hábiles|días?\s+naturales|días?|mes(?:es)?|años?|horas?|minutos?)\b/i,
  );
  if (durationMatch) {
    const fullMatch = durationMatch[0];
    const num = Number(durationMatch[1]);
    const unit = durationMatch[2];
    const candidates = new Set<string>();

    const offsets = num <= 3 ? [1, 2, 3, 6, 12] : [Math.max(1, Math.round(num / 2)), num * 2, num + 5, num + 10];
    for (const alt of offsets) {
      if (alt !== num && alt > 0) {
        candidates.add(`${alt} ${unit}`);
      }
    }
    const built = buildOptionsWithCorrect(fullMatch, Array.from(candidates), rng);
    if (built) {
      const blanked = fact.text.replace(fullMatch, '________');
      return {
        blockId: topic.blockId,
        topicId: topic.id,
        prompt: `Completa el dato clave (${fact.section}): «${truncateText(blanked, 220)}»`,
        options: built.options,
        correctIndex: built.correctIndex,
        explanation: fact.text,
        reference: `${topic.title} — ${fact.section}`,
        tags: [...topic.tags, 'auto-generada'],
        strategy: 'callout',
        strategyLabel: GENERATION_STRATEGY_LABELS.callout,
      };
    }
  }

  // 2. TCP/UDP Port pattern: "puerto 443"
  const portMatch = fact.text.match(/\bpuerto\s+(\d{2,5})\b/i);
  if (portMatch) {
    const fullMatch = portMatch[0];
    const port = Number(portMatch[1]);
    const commonPorts = [21, 22, 23, 25, 53, 80, 110, 143, 389, 443, 445, 3306, 5432, 8080];
    const distractors = commonPorts
      .filter((p) => p !== port)
      .map((p) => `puerto ${p}`);
    const built = buildOptionsWithCorrect(fullMatch, distractors, rng);
    if (built) {
      const blanked = fact.text.replace(fullMatch, '________');
      return {
        blockId: topic.blockId,
        topicId: topic.id,
        prompt: `Completa el puerto correcto (${fact.section}): «${truncateText(blanked, 220)}»`,
        options: built.options,
        correctIndex: built.correctIndex,
        explanation: fact.text,
        reference: `${topic.title} — ${fact.section}`,
        tags: [...topic.tags, 'auto-generada', 'puertos'],
        strategy: 'callout',
        strategyLabel: GENERATION_STRATEGY_LABELS.callout,
      };
    }
  }

  // 3. Article or Law number pattern: "Art. 21" / "Artículo 103"
  const artMatch = fact.text.match(/\b(art(?:ículo|\.)\s*)(\d{1,3})\b/i);
  if (artMatch) {
    const fullMatch = artMatch[0];
    const prefix = artMatch[1];
    const num = Number(artMatch[2]);
    const distractors = [num - 2, num - 1, num + 1, num + 2, num + 5]
      .filter((n) => n > 0 && n !== num)
      .map((n) => `${prefix}${n}`);
    const built = buildOptionsWithCorrect(fullMatch, distractors, rng);
    if (built) {
      const blanked = fact.text.replace(fullMatch, '________');
      return {
        blockId: topic.blockId,
        topicId: topic.id,
        prompt: `Indica la referencia normativa correcta (${fact.section}): «${truncateText(blanked, 220)}»`,
        options: built.options,
        correctIndex: built.correctIndex,
        explanation: fact.text,
        reference: `${topic.title} — ${fact.section}`,
        tags: [...topic.tags, 'auto-generada', 'leyes'],
        strategy: 'callout',
        strategyLabel: GENERATION_STRATEGY_LABELS.callout,
      };
    }
  }

  return null;
}

function rebalanceCorrectPositions(
  drafts: GeneratedQuestionDraft[],
  rng: () => number,
): GeneratedQuestionDraft[] {
  let slotBag: QuestionOptionIndex[] = [];
  const nextSlot = (): QuestionOptionIndex => {
    if (slotBag.length === 0) {
      slotBag = shuffleArray<QuestionOptionIndex>([0, 1, 2, 3], rng);
    }
    return slotBag.pop()!;
  };

  return drafts.map((draft) => {
    const targetIndex = nextSlot();
    if (draft.correctIndex === targetIndex) {
      return draft;
    }
    const nextOptions: [string, string, string, string] = [...draft.options];
    const tmp = nextOptions[targetIndex];
    nextOptions[targetIndex] = nextOptions[draft.correctIndex];
    nextOptions[draft.correctIndex] = tmp;
    return {
      ...draft,
      options: nextOptions,
      correctIndex: targetIndex,
    };
  });
}

export function generateQuestionsFromTopic(
  topic: Topic,
  options: TopicGenerationOptions = {},
): GeneratedQuestionDraft[] {
  const maxQuestions = options.maxQuestions ?? 15;
  const rng = options.rng ?? Math.random;
  const { tables, definitions, sectionLists, facts } = extractStructures(topic);

  const drafts: GeneratedQuestionDraft[] = [];
  const seenPrompts = new Set<string>();

  const pushUnique = (draft: GeneratedQuestionDraft | null): void => {
    if (!draft) return;
    const key = draft.prompt.toLowerCase();
    if (seenPrompts.has(key)) return;
    seenPrompts.add(key);
    drafts.push(draft);
  };

  // Strategy 1: Exam callouts & numeric/normative facts (highest exam value)
  const prioritizedFacts = [
    ...facts.filter((f) => f.isCallout),
    ...facts.filter((f) => !f.isCallout),
  ];
  for (const fact of prioritizedFacts) {
    if (drafts.length >= maxQuestions) break;
    pushUnique(generateClozeFromFact(fact, topic, rng));
  }

  // Strategy 2: Comparative Tables
  for (const table of tables) {
    if (table.rows.length < 4) continue;
    for (let colIdx = 1; colIdx < table.headers.length; colIdx++) {
      const colHeader = table.headers[colIdx] || `Columna ${colIdx + 1}`;
      const colValues = table.rows.map((r) => r[colIdx] ?? '').filter(Boolean);
      for (const row of table.rows) {
        if (drafts.length >= maxQuestions) break;
        const subject = row[0];
        const answer = row[colIdx];
        if (!subject || !answer) continue;

        const built = buildOptionsWithCorrect(answer, colValues, rng);
        if (!built) continue;

        pushUnique({
          blockId: topic.blockId,
          topicId: topic.id,
          prompt: `En «${table.section}», respecto a «${subject}», ¿cuál es su ${colHeader}?`,
          options: built.options,
          correctIndex: built.correctIndex,
          explanation: `Según la tabla de ${table.section}: ${subject} → ${colHeader}: ${answer}.`,
          reference: `${topic.title} — ${table.section}`,
          tags: [...topic.tags, 'auto-generada'],
          strategy: 'table',
          strategyLabel: GENERATION_STRATEGY_LABELS.table,
        });
      }
    }
  }

  // Strategy 3: Key-Value Definitions
  if (definitions.length >= 4) {
    const allTerms = definitions.map((d) => d.term);
    for (const def of definitions) {
      if (drafts.length >= maxQuestions) break;
      const built = buildOptionsWithCorrect(def.term, allTerms, rng);
      if (!built) continue;

      pushUnique({
        blockId: topic.blockId,
        topicId: topic.id,
        prompt: `Según tus apuntes de «${def.section}», ¿a qué concepto corresponde la siguiente descripción: «${truncateText(def.definition, 180)}»?`,
        options: built.options,
        correctIndex: built.correctIndex,
        explanation: `${def.term}: ${def.definition}`,
        reference: `${topic.title} — ${def.section}`,
        tags: [...topic.tags, 'auto-generada'],
        strategy: 'definition',
        strategyLabel: GENERATION_STRATEGY_LABELS.definition,
      });
    }
  }

  // Strategy 4: Section Lists ("¿Cuál NO pertenece al apartado X?")
  const validSections = sectionLists.filter((s) => s.items.length >= 3);
  if (validSections.length >= 2) {
    for (let i = 0; i < validSections.length; i++) {
      if (drafts.length >= maxQuestions) break;
      const target = validSections[i];
      const otherSections = validSections.filter((_, idx) => idx !== i);
      const intruderPool = otherSections.flatMap((s) =>
        s.items.map((item) => ({ item, fromSection: s.section })),
      );
      if (intruderPool.length === 0) continue;

      const intruder = shuffleArray(intruderPool, rng)[0];
      const targetItems = shuffleArray(target.items, rng).slice(0, 3);
      const built = buildOptionsWithCorrect(
        truncateText(intruder.item, 120),
        targetItems.map((it) => truncateText(it, 120)),
        rng,
      );
      if (!built) continue;

      pushUnique({
        blockId: topic.blockId,
        topicId: topic.id,
        prompt: `En «${topic.title}», ¿cuál de los siguientes elementos NO pertenece al apartado «${target.section}»?`,
        options: built.options,
        correctIndex: built.correctIndex,
        explanation: `«${intruder.item}» pertenece al apartado «${intruder.fromSection}», no a «${target.section}».`,
        reference: `${topic.title} — ${target.section}`,
        tags: [...topic.tags, 'auto-generada'],
        strategy: 'section_list',
        strategyLabel: GENERATION_STRATEGY_LABELS.section_list,
      });
    }
  }

  return rebalanceCorrectPositions(drafts.slice(0, maxQuestions), rng);
}

// --- Option 2: Structured Markdown + Calibrated INAP AI Prompt Builder ---

function tiptapToPromptText(topic: Topic): string {
  const root = topic.contentJson as TipTapNode | null | undefined;
  const topNodes = root && Array.isArray(root.content) ? root.content : [];
  if (topNodes.length === 0) {
    return topic.plainText.trim();
  }

  const lines: string[] = [];
  for (const node of topNodes) {
    if (!node || typeof node !== 'object') continue;
    if (node.type === 'heading') {
      const level = Math.min(Math.max(Number(node.attrs?.['level'] ?? 2), 1), 4);
      const txt = extractPlain(node);
      if (txt) lines.push(`${'#'.repeat(level)} ${txt}`);
    } else if (node.type === 'examCallout') {
      const txt = extractPlain(node);
      if (txt) lines.push(`> ⚠️ OJO EXAMEN: ${txt}`);
    } else if (node.type === 'bulletList' || node.type === 'orderedList' || node.type === 'taskList') {
      for (const li of node.content ?? []) {
        const txt = extractPlain(li);
        if (txt) lines.push(`- ${txt}`);
      }
    } else if (node.type === 'table') {
      for (const row of node.content ?? []) {
        const cells = (row.content ?? []).map((c) => extractPlain(c));
        if (cells.some(Boolean)) {
          lines.push(`| ${cells.join(' | ')} |`);
        }
      }
    } else {
      const txt = extractPlain(node);
      if (txt) lines.push(txt);
    }
  }

  return lines.join('\n').trim() || topic.plainText.trim();
}

export function buildAiPromptForTopic(
  topic: Topic,
  options: AiPromptOptions,
): AiPromptResult {
  const rawContent = tiptapToPromptText(topic);
  const truncated = rawContent.length > MAX_PROMPT_SOURCE_CHARS;
  const content = truncated
    ? `${rawContent.slice(0, MAX_PROMPT_SOURCE_CHARS)}\n[... contenido recortado por longitud ...]`
    : rawContent;

  const difficultyInstruction =
    options.difficulty === 'hard'
      ? 'Nivel DIFÍCIL (preguntas exigentes: usa distractores muy parecidos en plazos, excepciones, detalles o matices clave).'
      : 'Nivel ESTÁNDAR de examen (preguntas claras y representativas con distractores creíbles).';

  const calloutInstruction = options.focusCallouts
    ? '- Prioriza especialmente los bloques marcados como "⚠️ OJO EXAMEN", plazos, excepciones y cifras clave.\n'
    : '';

  const prompt = `Actúa como profesor y evaluador experto en la creación de preguntas tipo test de alta calidad.

Genera exactamente ${options.questionCount} preguntas tipo test basadas EXCLUSIVAMENTE en los siguientes apuntes del tema "${topic.title}" (${options.blockCode ?? topic.blockId}).

Reglas obligatorias:
- ${difficultyInstruction}
${calloutInstruction}- Cada pregunta debe tener exactamente 4 opciones (A, B, C, D) con una única respuesta correcta.
- Distribuye de forma equilibrada la posición de la respuesta correcta ("correctIndex") entre 0, 1, 2 y 3 (evita concentrar las respuestas en las mismas letras).
- Incluye una explicación breve y clara y la referencia al apartado o fuente cuando aparezca en el texto.
- Responde ÚNICAMENTE con un array JSON válido (sin texto adicional antes ni después) con exactamente esta estructura:

[
  {
    "blockId": "${topic.blockId}",
    "prompt": "Enunciado de la pregunta",
    "options": ["Opción A", "Opción B", "Opción C", "Opción D"],
    "correctIndex": 0,
    "explanation": "Explicación concisa de por qué es correcta",
    "reference": "Apartado / fuente del tema",
    "tags": ["${topic.tags[0] ?? 'repaso'}"]
  }
]

--- APUNTES DEL TEMA: ${topic.title} ---
${content || '(El tema aún no tiene apuntes escritos; genera preguntas representativas sobre el título del tema).'}
--- FIN DE APUNTES ---`;

  return {
    prompt,
    charCount: prompt.length,
    truncated,
  };
}

/**
 * Strips markdown code fences (```json ... ```) if the user pastes raw LLM output.
 */
export function stripMarkdownCodeFence(raw: string): string {
  const trimmed = raw.trim();
  const fenceMatch = trimmed.match(/```(?:json|csv|txt|text)?\s*\n([\s\S]*?)\n```/i);
  return fenceMatch ? fenceMatch[1].trim() : trimmed;
}
