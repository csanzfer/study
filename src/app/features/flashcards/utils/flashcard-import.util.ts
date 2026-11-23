import { CreateFlashcardInput, Flashcard, TaiBlockId, Topic } from '../../../core/models/study.models';

export interface FlashcardImportResult {
  items: CreateFlashcardInput[];
  skippedDuplicates: number;
  warnings: string[];
}

interface TipTapNodeLike {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: TipTapNodeLike[];
}

export function normalizeFlashcardKey(front: string): string {
  return front.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Parses quick text (`Front :: Back` or `Front\tBack`), CSV, or JSON into CreateFlashcardInput[].
 */
export function parseFlashcardsBatch(
  raw: string,
  defaults: { blockId: TaiBlockId; topicId?: string; tags?: string[] },
  existing: Flashcard[] = [],
): FlashcardImportResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { items: [], skippedDuplicates: 0, warnings: [] };
  }

  const existingKeys = new Set(existing.map((c) => normalizeFlashcardKey(c.front)));
  const seenKeys = new Set<string>();
  const items: CreateFlashcardInput[] = [];
  const warnings: string[] = [];
  let skippedDuplicates = 0;

  const pushCandidate = (candidate: CreateFlashcardInput): void => {
    const front = candidate.front.trim();
    const back = candidate.back.trim();
    if (!front || !back) {
      return;
    }
    const key = normalizeFlashcardKey(front);
    if (existingKeys.has(key) || seenKeys.has(key)) {
      skippedDuplicates++;
      return;
    }
    seenKeys.add(key);
    const mergedTags = Array.from(
      new Set([...(defaults.tags ?? []), ...(candidate.tags ?? [])].map((t) => t.trim()).filter(Boolean)),
    );
    items.push({
      blockId: candidate.blockId ?? defaults.blockId,
      topicId: candidate.topicId ?? defaults.topicId,
      front,
      back,
      hint: candidate.hint?.trim() || undefined,
      tags: mergedTags,
    });
  };

  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      const list = Array.isArray(parsed) ? parsed : [parsed];
      for (const entry of list) {
        if (!entry || typeof entry !== 'object') continue;
        const obj = entry as Record<string, unknown>;
        const front = String(obj['front'] ?? obj['question'] ?? obj['acronym'] ?? '').trim();
        const back = String(obj['back'] ?? obj['answer'] ?? obj['meaning'] ?? '').trim();
        if (!front || !back) {
          warnings.push('Se omitió un objeto JSON sin anverso/reverso.');
          continue;
        }
        const blockCandidate = obj['blockId'];
        const blockId: TaiBlockId =
          blockCandidate === 'B1' ||
          blockCandidate === 'B2' ||
          blockCandidate === 'B3' ||
          blockCandidate === 'B4'
            ? blockCandidate
            : defaults.blockId;
        const tags = Array.isArray(obj['tags'])
          ? obj['tags'].map((t) => String(t).trim()).filter(Boolean)
          : [];
        pushCandidate({
          blockId,
          topicId: typeof obj['topicId'] === 'string' ? obj['topicId'] : defaults.topicId,
          front,
          back,
          hint: typeof obj['hint'] === 'string' ? obj['hint'] : undefined,
          tags,
        });
      }
      return { items, skippedDuplicates, warnings };
    } catch {
      warnings.push('No se pudo parsear como JSON; intentando formato por líneas.');
    }
  }

  const lines = trimmed.split(/\r?\n/);
  for (const [index, rawLine] of lines.entries()) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith('//')) {
      continue;
    }

    let parts: string[] = [];
    if (line.includes('::')) {
      parts = line.split('::');
    } else if (line.includes('\t')) {
      parts = line.split('\t');
    } else if (line.includes(';')) {
      parts = line.split(';');
    } else {
      warnings.push(`Línea ${index + 1} ignorada (usa "::", tabulador o ";"): "${line.slice(0, 40)}"`);
      continue;
    }

    const front = parts[0]?.trim() ?? '';
    const back = parts[1]?.trim() ?? '';
    const hint = parts[2]?.trim() || undefined;
    const lineTags = parts[3]
      ? parts[3]
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

    if (!front || !back) {
      warnings.push(`Línea ${index + 1} incompleta.`);
      continue;
    }

    pushCandidate({
      blockId: defaults.blockId,
      topicId: defaults.topicId,
      front,
      back,
      hint,
      tags: lineTags,
    });
  }

  return { items, skippedDuplicates, warnings };
}

/**
 * Splits a selected TipTap text snippet into a suggested front/back pair,
 * detecting acronyms like "DNS (Domain Name System)" or definitions like "Plazo: 3 meses".
 */
export function parseSelectedTextToFlashcardDraft(selectedText: string): {
  front: string;
  back: string;
  isAcronym: boolean;
} {
  const clean = selectedText.trim().replace(/\s+/g, ' ');
  if (!clean) {
    return { front: '', back: '', isAcronym: false };
  }

  // Pattern: ACRONYM (Full Meaning)
  const acronymParenMatch = /^([A-ZÁÉÍÓÚÑ0-9/-]{2,14})\s*\(([^()]{3,140})\)$/.exec(clean);
  if (acronymParenMatch) {
    return {
      front: acronymParenMatch[1].trim(),
      back: acronymParenMatch[2].trim(),
      isAcronym: true,
    };
  }

  // Pattern: Term : Definition  or  Term — Definition
  const sepMatch = /^([^:—–-]{2,80}?)\s*(?::|—|–| - )\s*(.{3,})$/.exec(clean);
  if (sepMatch) {
    const left = sepMatch[1].trim();
    const right = sepMatch[2].trim();
    const isAcronym = /^[A-ZÁÉÍÓÚÑ0-9/-]{2,12}$/.test(left);
    return { front: left, back: right, isAcronym };
  }

  // Single acronym selected
  if (/^[A-ZÁÉÍÓÚÑ0-9/-]{2,12}$/.test(clean)) {
    return { front: clean, back: '', isAcronym: true };
  }

  return { front: '', back: clean, isAcronym: false };
}

/**
 * Extracts flashcard candidates offline from a Topic's TipTap content:
 * 1. Acronyms matching `ACRONYM (Full meaning)` (tagged with 'siglas')
 * 2. Exam callouts ("Ojo examen")
 * 3. Two-column tables
 * 4. Definition bullets (`Term: Description`)
 */
export function extractFlashcardsFromTopic(
  topic: Topic,
  existing: Flashcard[] = [],
): CreateFlashcardInput[] {
  const existingKeys = new Set(existing.map((c) => normalizeFlashcardKey(c.front)));
  const seenKeys = new Set<string>();
  const results: CreateFlashcardInput[] = [];

  const addCandidate = (front: string, back: string, tags: string[], hint?: string): void => {
    const cleanFront = front.trim();
    const cleanBack = back.trim();
    if (cleanFront.length < 2 || cleanBack.length < 2) {
      return;
    }
    const key = normalizeFlashcardKey(cleanFront);
    if (existingKeys.has(key) || seenKeys.has(key)) {
      return;
    }
    seenKeys.add(key);
    results.push({
      blockId: topic.blockId,
      topicId: topic.id,
      front: cleanFront,
      back: cleanBack,
      hint,
      tags: Array.from(new Set([...topic.tags, ...tags])),
    });
  };

  // 1. Scan plainText for acronyms: e.g. "DNS (Domain Name System)"
  const acronymRegex = /\b([A-Z]{2,10}(?:\/[A-Z0-9]{1,6})?)\s*\(([A-Za-zÁÉÍÓÚáéíóúÑñ0-9 ,./-]{4,100})\)/g;
  let match: RegExpExecArray | null;
  while ((match = acronymRegex.exec(topic.plainText)) !== null) {
    addCandidate(match[1], match[2], ['siglas'], `Detectada en ${topic.title}`);
  }

  // 2. Walk TipTap JSON for examCallout, tables, and definition list items
  const doc = topic.contentJson as TipTapNodeLike | null;
  if (doc && typeof doc === 'object') {
    walkTipTapNodes(doc, (node) => {
      if (node.type === 'examCallout') {
        const text = extractNodeText(node).trim();
        if (text.length >= 10) {
          const parsed = parseSelectedTextToFlashcardDraft(text);
          if (parsed.front && parsed.back) {
            addCandidate(
              parsed.front,
              parsed.back,
              parsed.isAcronym ? ['siglas', 'ojo-examen'] : ['ojo-examen'],
              `Ojo examen · ${topic.title}`,
            );
          } else {
            addCandidate(`Ojo examen (${topic.title}): ¿qué debes recordar?`, text, ['ojo-examen']);
          }
        }
      } else if (node.type === 'table' && Array.isArray(node.content)) {
        for (const row of node.content) {
          if (row.type !== 'tableRow' || !Array.isArray(row.content) || row.content.length < 2) {
            continue;
          }
          const isHeaderRow = row.content.every((cell) => cell.type === 'tableHeader');
          if (isHeaderRow) continue;
          const left = extractNodeText(row.content[0]).trim();
          const right = extractNodeText(row.content[1]).trim();
          if (left && right) {
            const isAcr = /^[A-Z0-9/-]{2,12}$/.test(left);
            addCandidate(left, right, isAcr ? ['siglas'] : [], `Tabla · ${topic.title}`);
          }
        }
      } else if (node.type === 'listItem') {
        const text = extractNodeText(node).trim();
        const defMatch = /^([^:\n]{2,60}):\s+([^\n]{4,240})$/.exec(text);
        if (defMatch) {
          const left = defMatch[1].trim();
          const right = defMatch[2].trim();
          const isAcr = /^[A-Z0-9/-]{2,12}$/.test(left);
          addCandidate(left, right, isAcr ? ['siglas'] : []);
        }
      }
    });
  }

  return results;
}

function walkTipTapNodes(node: TipTapNodeLike, visitor: (n: TipTapNodeLike) => void): void {
  visitor(node);
  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      walkTipTapNodes(child, visitor);
    }
  }
}

function extractNodeText(node: TipTapNodeLike): string {
  if (typeof node.text === 'string') {
    return node.text;
  }
  if (!Array.isArray(node.content)) {
    return '';
  }
  return node.content
    .map((child) => extractNodeText(child))
    .join(node.type === 'paragraph' || node.type === 'tableCell' ? '' : ' ');
}
