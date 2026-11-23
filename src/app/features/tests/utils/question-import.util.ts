import {
  CreateQuestionInput,
  QuestionOptionIndex,
  TaiBlockId,
  Topic,
} from '../../../core/models/study.models';

export type QuestionImportFormat = 'text' | 'csv' | 'json';

export interface QuestionImportError {
  entryIndex: number;
  message: string;
}

export interface QuestionImportResult {
  valid: CreateQuestionInput[];
  errors: QuestionImportError[];
}

export interface QuestionImportDefaults {
  defaultBlockId: TaiBlockId;
  defaultTopicId?: string;
  defaultCaseStudyId?: string;
  defaultSource?: string;
  topics?: Topic[];
}

const VALID_BLOCKS = new Set<TaiBlockId>(['B1', 'B2', 'B3', 'B4']);

function parseBlockId(raw: unknown, fallback: TaiBlockId): TaiBlockId {
  if (typeof raw !== 'string') {
    return fallback;
  }
  const normalized = raw.trim().toUpperCase();
  if (VALID_BLOCKS.has(normalized as TaiBlockId)) {
    return normalized as TaiBlockId;
  }
  if (/^(BLOQUE\s*)?(1|I)$/.test(normalized)) return 'B1';
  if (/^(BLOQUE\s*)?(2|II)$/.test(normalized)) return 'B2';
  if (/^(BLOQUE\s*)?(3|III)$/.test(normalized)) return 'B3';
  if (/^(BLOQUE\s*)?(4|IV)$/.test(normalized)) return 'B4';
  return fallback;
}

function parseCorrectIndex(raw: unknown): QuestionOptionIndex | null {
  if (typeof raw === 'number' && Number.isInteger(raw)) {
    if (raw >= 0 && raw <= 3) return raw as QuestionOptionIndex;
    if (raw >= 1 && raw <= 4) return (raw - 1) as QuestionOptionIndex;
    return null;
  }
  if (typeof raw === 'string') {
    const clean = raw.trim().toUpperCase().replace(/[).:\s]/g, '');
    if (clean === 'A' || clean === '0') return 0;
    if (clean === 'B' || clean === '1') return 1;
    if (clean === 'C' || clean === '2') return 2;
    if (clean === 'D' || clean === '3') return 3;
    if (clean === '4') return 3;
  }
  return null;
}

function resolveTopicId(
  rawTopic: string | undefined,
  blockId: TaiBlockId,
  defaults: QuestionImportDefaults,
): string | undefined {
  const trimmed = rawTopic?.trim();
  if (!trimmed) {
    return defaults.defaultTopicId || undefined;
  }
  const topics = defaults.topics ?? [];
  const exactId = topics.find((t) => t.id === trimmed);
  if (exactId) return exactId.id;

  const lower = trimmed.toLowerCase();
  const byTitleInBlock = topics.find(
    (t) => t.blockId === blockId && t.title.toLowerCase() === lower,
  );
  if (byTitleInBlock) return byTitleInBlock.id;

  const byTitleAny = topics.find((t) => t.title.toLowerCase().includes(lower));
  if (byTitleAny) return byTitleAny.id;

  return defaults.defaultTopicId || undefined;
}

function parseTags(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return Array.from(
      new Set(raw.map((item) => String(item).trim()).filter(Boolean)),
    );
  }
  if (typeof raw === 'string') {
    return Array.from(
      new Set(
        raw
          .split(/[|,;]/)
          .map((t) => t.trim())
          .filter(Boolean),
      ),
    );
  }
  return [];
}

// --- 1. JSON Parser ---

export function parseQuestionsFromJson(
  rawText: string,
  defaults: QuestionImportDefaults,
): QuestionImportResult {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return { valid: [], errors: [{ entryIndex: 1, message: 'El contenido JSON está vacío.' }] };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return {
      valid: [],
      errors: [{ entryIndex: 1, message: 'JSON no válido. Revisa comillas, llaves y comas.' }],
    };
  }

  const list = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && Array.isArray((parsed as { questions?: unknown }).questions)
      ? (parsed as { questions: unknown[] }).questions
      : null;

  if (!list) {
    return {
      valid: [],
      errors: [
        {
          entryIndex: 1,
          message: 'El JSON debe ser un array de preguntas o un objeto con la propiedad "questions".',
        },
      ],
    };
  }

  const valid: CreateQuestionInput[] = [];
  const errors: QuestionImportError[] = [];

  list.forEach((entry, index) => {
    const entryNum = index + 1;
    if (!entry || typeof entry !== 'object') {
      errors.push({ entryIndex: entryNum, message: 'Elemento no es un objeto válido.' });
      return;
    }

    const obj = entry as Record<string, unknown>;
    const prompt = String(obj['prompt'] ?? obj['enunciado'] ?? obj['question'] ?? '').trim();
    if (!prompt) {
      errors.push({ entryIndex: entryNum, message: 'Falta el enunciado ("prompt").' });
      return;
    }

    let options: string[] = [];
    if (Array.isArray(obj['options'])) {
      options = obj['options'].map((o) => String(o ?? '').trim());
    } else if (Array.isArray(obj['opciones'])) {
      options = obj['opciones'].map((o) => String(o ?? '').trim());
    } else {
      options = [
        String(obj['a'] ?? obj['optionA'] ?? obj['opcion_a'] ?? '').trim(),
        String(obj['b'] ?? obj['optionB'] ?? obj['opcion_b'] ?? '').trim(),
        String(obj['c'] ?? obj['optionC'] ?? obj['opcion_c'] ?? '').trim(),
        String(obj['d'] ?? obj['optionD'] ?? obj['opcion_d'] ?? '').trim(),
      ];
    }

    if (options.length !== 4 || options.some((o) => !o)) {
      errors.push({
        entryIndex: entryNum,
        message: 'Se requieren exactamente 4 opciones no vacías (A, B, C, D).',
      });
      return;
    }

    const correctIndex = parseCorrectIndex(
      obj['correctIndex'] ?? obj['correct'] ?? obj['correcta'] ?? obj['answer'] ?? obj['respuesta'],
    );
    if (correctIndex === null) {
      errors.push({
        entryIndex: entryNum,
        message: 'Índice de respuesta correcta inválido (usa 0..3 o A..D).',
      });
      return;
    }

    const blockId = parseBlockId(obj['blockId'] ?? obj['bloque'] ?? obj['block'], defaults.defaultBlockId);
    const topicId = resolveTopicId(
      typeof obj['topicId'] === 'string'
        ? obj['topicId']
        : typeof obj['topic'] === 'string'
          ? obj['topic']
          : typeof obj['tema'] === 'string'
            ? obj['tema']
            : undefined,
      blockId,
      defaults,
    );

    valid.push({
      blockId,
      topicId,
      caseStudyId:
        typeof obj['caseStudyId'] === 'string'
          ? obj['caseStudyId']
          : defaults.defaultCaseStudyId || undefined,
      prompt,
      options: options as [string, string, string, string],
      correctIndex,
      explanation:
        String(obj['explanation'] ?? obj['explicacion'] ?? '').trim() || undefined,
      reference:
        String(obj['reference'] ?? obj['referencia'] ?? '').trim() || undefined,
      source:
        String(obj['source'] ?? obj['fuente'] ?? defaults.defaultSource ?? '').trim() || undefined,
      tags: parseTags(obj['tags'] ?? obj['etiquetas']),
      flagged: Boolean(obj['flagged']),
    });
  });

  return { valid, errors };
}

// --- 2. CSV Parser ---

function splitCsvRow(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

function detectDelimiter(headerLine: string): string {
  const semicolons = (headerLine.match(/;/g) ?? []).length;
  const commas = (headerLine.match(/,/g) ?? []).length;
  return semicolons > commas ? ';' : ',';
}

export function parseQuestionsFromCsv(
  rawText: string,
  defaults: QuestionImportDefaults,
): QuestionImportResult {
  const lines = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return { valid: [], errors: [{ entryIndex: 1, message: 'El CSV está vacío.' }] };
  }

  const delimiter = detectDelimiter(lines[0]);
  const firstRow = splitCsvRow(lines[0], delimiter).map((h) => h.toLowerCase());

  const hasHeader =
    firstRow.some((h) =>
      ['prompt', 'enunciado', 'pregunta', 'opcion_a', 'option_a', 'a', 'correcta', 'correct'].includes(
        h,
      ),
    );

  const dataLines = hasHeader ? lines.slice(1) : lines;
  if (dataLines.length === 0) {
    return {
      valid: [],
      errors: [{ entryIndex: 1, message: 'El CSV solo contiene cabecera, sin filas de preguntas.' }],
    };
  }

  const colIndex = (names: string[], fallback: number): number => {
    if (!hasHeader) return fallback;
    for (const name of names) {
      const idx = firstRow.indexOf(name);
      if (idx >= 0) return idx;
    }
    return -1;
  };

  // Positional fallback without header: bloque,enunciado,a,b,c,d,correcta,explicacion,referencia,tags
  const idxBlock = colIndex(['bloque', 'block', 'blockid'], 0);
  const idxTopic = colIndex(['tema', 'topic', 'topicid'], -1);
  const idxPrompt = colIndex(['enunciado', 'pregunta', 'prompt'], 1);
  const idxA = colIndex(['opcion_a', 'option_a', 'a'], 2);
  const idxB = colIndex(['opcion_b', 'option_b', 'b'], 3);
  const idxC = colIndex(['opcion_c', 'option_c', 'c'], 4);
  const idxD = colIndex(['opcion_d', 'option_d', 'd'], 5);
  const idxCorrect = colIndex(['correcta', 'respuesta', 'correct', 'correctindex', 'answer'], 6);
  const idxExplanation = colIndex(['explicacion', 'explanation'], 7);
  const idxReference = colIndex(['referencia', 'reference', 'articulo'], 8);
  const idxTags = colIndex(['tags', 'etiquetas'], 9);
  const idxSource = colIndex(['fuente', 'source', 'convocatoria'], -1);

  const valid: CreateQuestionInput[] = [];
  const errors: QuestionImportError[] = [];

  dataLines.forEach((line, i) => {
    const rowNum = i + (hasHeader ? 2 : 1);
    const cells = splitCsvRow(line, delimiter);
    const cell = (idx: number): string => (idx >= 0 && idx < cells.length ? cells[idx] : '');

    const prompt = cell(idxPrompt).trim();
    const options = [cell(idxA), cell(idxB), cell(idxC), cell(idxD)].map((o) => o.trim());
    const correctIndex = parseCorrectIndex(cell(idxCorrect));

    if (!prompt) {
      errors.push({ entryIndex: rowNum, message: `Fila ${rowNum}: falta el enunciado.` });
      return;
    }
    if (options.some((o) => !o)) {
      errors.push({
        entryIndex: rowNum,
        message: `Fila ${rowNum}: las 4 opciones (A-D) son obligatorias.`,
      });
      return;
    }
    if (correctIndex === null) {
      errors.push({
        entryIndex: rowNum,
        message: `Fila ${rowNum}: respuesta correcta inválida ("${cell(idxCorrect)}"). Usa A-D o 0-3.`,
      });
      return;
    }

    const blockId = parseBlockId(cell(idxBlock), defaults.defaultBlockId);
    const topicId = resolveTopicId(cell(idxTopic), blockId, defaults);

    valid.push({
      blockId,
      topicId,
      caseStudyId: defaults.defaultCaseStudyId || undefined,
      prompt,
      options: options as [string, string, string, string],
      correctIndex,
      explanation: cell(idxExplanation) || undefined,
      reference: cell(idxReference) || undefined,
      source: cell(idxSource) || defaults.defaultSource || undefined,
      tags: parseTags(cell(idxTags)),
    });
  });

  return { valid, errors };
}

// --- 3. Formatted Text Parser (INAP / Books copy-paste) ---

export function parseQuestionsFromText(
  rawText: string,
  defaults: QuestionImportDefaults,
): QuestionImportResult {
  const normalized = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!normalized) {
    return { valid: [], errors: [{ entryIndex: 1, message: 'El texto está vacío.' }] };
  }

  // Split into blocks separated by one or more blank lines
  const chunks = normalized
    .split(/\n\s*\n+/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  const valid: CreateQuestionInput[] = [];
  const errors: QuestionImportError[] = [];

  chunks.forEach((chunk, index) => {
    const entryNum = index + 1;
    const lines = chunk
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    const promptLines: string[] = [];
    const options: [string, string, string, string] = ['', '', '', ''];
    let correctIndex: QuestionOptionIndex | null = null;
    let explanation: string | undefined;
    let reference: string | undefined;
    let blockId: TaiBlockId = defaults.defaultBlockId;
    let tags: string[] = [];
    let currentOptionIdx = -1;

    for (const line of lines) {
      // Metadata lines
      const answerMatch = line.match(/^(?:respuesta|correcta|soluci[oó]n|answer)\s*[:=-]\s*(.+)$/i);
      if (answerMatch) {
        correctIndex = parseCorrectIndex(answerMatch[1]);
        currentOptionIdx = -1;
        continue;
      }

      const explMatch = line.match(/^(?:explicaci[oó]n|comentario|explanation)\s*[:=-]\s*(.+)$/i);
      if (explMatch) {
        explanation = explMatch[1].trim();
        currentOptionIdx = -1;
        continue;
      }

      const refMatch = line.match(/^(?:referencia|art[ií]culo|ley|norma|reference)\s*[:=-]\s*(.+)$/i);
      if (refMatch) {
        reference = refMatch[1].trim();
        currentOptionIdx = -1;
        continue;
      }

      const blockMatch = line.match(/^(?:bloque|block)\s*[:=-]\s*(.+)$/i);
      if (blockMatch) {
        blockId = parseBlockId(blockMatch[1], defaults.defaultBlockId);
        currentOptionIdx = -1;
        continue;
      }

      const tagsMatch = line.match(/^(?:tags|etiquetas)\s*[:=-]\s*(.+)$/i);
      if (tagsMatch) {
        tags = parseTags(tagsMatch[1]);
        currentOptionIdx = -1;
        continue;
      }

      // Option line: a) ..., B. ..., *c) ... (leading * marks correct option!)
      const optMatch = line.match(/^(\*)?\s*([a-dA-D])\s*[).:-]\s*(.+)$/);
      if (optMatch) {
        const isStarred = Boolean(optMatch[1]);
        const letter = optMatch[2].toUpperCase();
        const optIdx = (letter.charCodeAt(0) - 65) as QuestionOptionIndex;
        options[optIdx] = optMatch[3].trim();
        currentOptionIdx = optIdx;
        if (isStarred) {
          correctIndex = optIdx;
        }
        continue;
      }

      // Continuation line
      if (currentOptionIdx >= 0) {
        options[currentOptionIdx] = `${options[currentOptionIdx]} ${line}`.trim();
      } else {
        // Strip leading question number like "12. " or "12) "
        const cleaned =
          promptLines.length === 0 ? line.replace(/^\d+\s*[).:-]\s*/, '') : line;
        promptLines.push(cleaned);
      }
    }

    const prompt = promptLines.join(' ').trim();
    if (!prompt) {
      errors.push({ entryIndex: entryNum, message: `Bloque #${entryNum}: falta el enunciado.` });
      return;
    }
    if (options.some((o) => !o)) {
      errors.push({
        entryIndex: entryNum,
        message: `Bloque #${entryNum}: faltan opciones (se necesitan a), b), c) y d)).`,
      });
      return;
    }
    if (correctIndex === null) {
      errors.push({
        entryIndex: entryNum,
        message: `Bloque #${entryNum}: indica la correcta con "Respuesta: B" o anteponiendo "*" a la opción.`,
      });
      return;
    }

    valid.push({
      blockId,
      topicId: defaults.defaultTopicId || undefined,
      caseStudyId: defaults.defaultCaseStudyId || undefined,
      prompt,
      options,
      correctIndex,
      explanation,
      reference,
      source: defaults.defaultSource || undefined,
      tags,
    });
  });

  return { valid, errors };
}

export function parseQuestions(
  format: QuestionImportFormat,
  rawText: string,
  defaults: QuestionImportDefaults,
): QuestionImportResult {
  switch (format) {
    case 'json':
      return parseQuestionsFromJson(rawText, defaults);
    case 'csv':
      return parseQuestionsFromCsv(rawText, defaults);
    case 'text':
      return parseQuestionsFromText(rawText, defaults);
  }
}

export const IMPORT_SAMPLE_TEMPLATES: Record<QuestionImportFormat, string> = {
  text: `1. Según la Ley 39/2015, ¿cuál es el plazo máximo general para resolver cuando las normas no fijen plazo?
a) 1 mes
*b) 3 meses
c) 6 meses
d) 15 días hábiles
Referencia: Art. 21.3 Ley 39/2015
Explicación: Cuando las normas reguladoras de los procedimientos no fijen el plazo máximo, éste será de tres meses.
Bloque: B1

2. ¿Qué puerto TCP utiliza por defecto el protocolo HTTPS?
a) 22
b) 80
c) 443
d) 8080
Respuesta: C
Referencia: RFC 2818 / IANA
Bloque: B4`,

  csv: `bloque,enunciado,opcion_a,opcion_b,opcion_c,opcion_d,correcta,explicacion,referencia,tags
B1,"¿En qué año se aprobó la Constitución Española?",1975,1978,1981,1979,B,"Aprobada en referéndum el 6 de diciembre de 1978","CE 1978","leyes|ce"
B3,"¿Qué cláusula SQL filtra grupos creados con GROUP BY?",WHERE,HAVING,ORDER BY,DISTINCT,B,"HAVING aplica condiciones sobre grupos agregados","ISO SQL","sql|bbdd"`,

  json: `[
  {
    "blockId": "B2",
    "prompt": "¿Cuál de las siguientes memorias es volátil?",
    "options": ["ROM", "EEPROM", "SRAM", "Flash NAND"],
    "correctIndex": 2,
    "explanation": "La SRAM (Static RAM) pierde su contenido al cortar la alimentación eléctrica.",
    "reference": "Arquitectura de computadores",
    "tags": ["hardware", "memoria"]
  }
]`,
};
