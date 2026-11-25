import { QuestionOptionIndex, TaiBlockId } from '../../../core/models/study.models';

export type InapImportMode = 'questionnaire' | 'case_study';
export type InapAnswerKeyEntry = QuestionOptionIndex | 'ANULADA';

export interface ParsedInapQuestion {
  id: string;
  numberLabel: string;
  numericOrder: number;
  isReserve: boolean;
  prompt: string;
  options: [string, string, string, string];
  correctIndex: QuestionOptionIndex | null;
  isAnnulled: boolean;
  blockId: TaiBlockId;
  selected: boolean;
  warnings: string[];
}

export interface InapQuestionnaireParseOptions {
  defaultBlockId?: TaiBlockId;
  mode?: InapImportMode;
}

export interface InapQuestionnaireParseResult {
  questions: ParsedInapQuestion[];
  warnings: string[];
  caseStudyStatement?: string;
}

export interface InapAnswerKeyMergeResult {
  questions: ParsedInapQuestion[];
  matchedCount: number;
  annulledCount: number;
}

const NOISE_LINE_PATTERNS: RegExp[] = [
  /^p[áa]gina\s+\d+(\s+de\s+\d+)?$/i,
  /^p[áa]g\.?\s*\d+(\s*\/\s*\d+)?$/i,
  /^\d+\s*\/\s*\d+$/,
  /^proceso\s+selectivo\s+para\s+ingreso/i,
  /^cuerpo\s+de\s+t[ée]cnicos\s+auxiliares\s+de\s+inform[áa]tica/i,
  /^administraci[óo]n\s+del\s+estado/i,
  /^comisi[óo]n\s+permanente\s+de\s+selecci[óo]n/i,
  /^inap\s*$/i,
  /^modelo\s+[ab]\s*$/i,
  /^no\s+abra\s+este\s+cuestionario/i,
  /^[-_=]{3,}$/,
];

const QUESTION_START_REGEX =
  /^(?:(R(?:eserva)?\s*\.?\s*(\d{1,2}))|(\d{1,3}))\s*(?:[.)]|-\s*|\.-)\s+(.+)$/i;

const OPTION_START_REGEX = /^([a-dA-D])\s*[.)]\s+(.+)$/;

const LETTER_TO_INDEX: Record<string, QuestionOptionIndex> = {
  A: 0,
  B: 1,
  C: 2,
  D: 3,
};

export function cleanInapPdfText(rawText: string): string {
  const normalized = rawText
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/(\p{L})-\n(\p{L})/gu, '$1$2');

  const lines = normalized
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => {
      if (!line) {
        return true;
      }
      return !NOISE_LINE_PATTERNS.some((pattern) => pattern.test(line));
    });

  return lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function parseInapQuestionnaireText(
  rawText: string,
  options: InapQuestionnaireParseOptions = {},
): InapQuestionnaireParseResult {
  const defaultBlockId: TaiBlockId = options.defaultBlockId ?? 'B1';
  const mode: InapImportMode = options.mode ?? 'questionnaire';
  const cleaned = cleanInapPdfText(rawText);

  if (!cleaned) {
    return { questions: [], warnings: ['No se encontró texto legible en el documento.'] };
  }

  const lines = cleaned.split('\n');
  const preambleLines: string[] = [];
  const questions: ParsedInapQuestion[] = [];
  const globalWarnings: string[] = [];

  interface DraftQuestion {
    numberLabel: string;
    numericOrder: number;
    isReserve: boolean;
    promptParts: string[];
    options: [string[], string[], string[], string[]];
    activeOption: QuestionOptionIndex | null;
  }

  let current: DraftQuestion | null = null;
  let inReserveSection = false;

  const finalizeCurrent = () => {
    if (!current) {
      return;
    }

    const prompt = current.promptParts.join(' ').replace(/\s+/g, ' ').trim();
    const resolvedOptions: [string, string, string, string] = [
      current.options[0].join(' ').replace(/\s+/g, ' ').trim(),
      current.options[1].join(' ').replace(/\s+/g, ' ').trim(),
      current.options[2].join(' ').replace(/\s+/g, ' ').trim(),
      current.options[3].join(' ').replace(/\s+/g, ' ').trim(),
    ];

    const warnings: string[] = [];
    if (prompt.length < 10) {
      warnings.push('Enunciado muy corto: revisa si se cortó al extraer el PDF.');
    }
    const missingLetters = (['A', 'B', 'C', 'D'] as const).filter(
      (_, idx) => !resolvedOptions[idx],
    );
    if (missingLetters.length > 0) {
      warnings.push(`Faltan opciones: ${missingLetters.join(', ')}.`);
    }

    questions.push({
      id: `inap-q-${current.numberLabel}-${questions.length + 1}`,
      numberLabel: current.numberLabel,
      numericOrder: current.numericOrder,
      isReserve: current.isReserve,
      prompt,
      options: resolvedOptions,
      correctIndex: null,
      isAnnulled: false,
      blockId: defaultBlockId,
      selected: missingLetters.length === 0 && prompt.length > 0,
      warnings,
    });
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      if (mode === 'case_study' && !current && preambleLines.length > 0) {
        preambleLines.push('');
      }
      continue;
    }

    if (/^preguntas\s+de\s+reserva\b/i.test(line)) {
      inReserveSection = true;
      continue;
    }

    const qMatch = line.match(QUESTION_START_REGEX);
    if (qMatch) {
      const explicitReserveNum = qMatch[2];
      const regularNum = qMatch[3];
      const restText = qMatch[4].trim();

      const looksLikeOptionContinuation =
        current !== null &&
        current.activeOption === null &&
        regularNum !== undefined &&
        Number(regularNum) <= current.numericOrder &&
        !inReserveSection;

      if (!looksLikeOptionContinuation) {
        finalizeCurrent();

        const isReserve = Boolean(explicitReserveNum) || inReserveSection;
        let numericOrder: number;
        let numberLabel: string;

        if (explicitReserveNum) {
          numericOrder = Number(explicitReserveNum);
          numberLabel = `R${numericOrder}`;
        } else if (inReserveSection) {
          numericOrder = Number(regularNum);
          numberLabel = numericOrder <= 10 ? `R${numericOrder}` : String(numericOrder);
        } else {
          numericOrder = Number(regularNum);
          numberLabel = String(numericOrder);
        }

        current = {
          numberLabel,
          numericOrder,
          isReserve,
          promptParts: [restText],
          options: [[], [], [], []],
          activeOption: null,
        };
        continue;
      }
    }

    if (!current) {
      if (mode === 'case_study') {
        preambleLines.push(line);
      }
      continue;
    }

    const optMatch = line.match(OPTION_START_REGEX);
    if (optMatch) {
      const letter = optMatch[1].toUpperCase();
      const idx = LETTER_TO_INDEX[letter];
      if (idx !== undefined) {
        current.activeOption = idx;
        current.options[idx].push(optMatch[2].trim());
        continue;
      }
    }

    if (current.activeOption !== null) {
      current.options[current.activeOption].push(line);
    } else {
      current.promptParts.push(line);
    }
  }

  finalizeCurrent();

  if (questions.length === 0) {
    globalWarnings.push(
      'No se detectaron preguntas con numeración estándar (1., 2., ... y opciones a), b), c), d)).',
    );
  }

  const caseStudyStatement =
    mode === 'case_study'
      ? preambleLines
          .join('\n')
          .split(/\n{2,}/)
          .map((paragraph) => paragraph.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim())
          .filter(Boolean)
          .join('\n\n') || undefined
      : undefined;

  if (mode === 'case_study' && !caseStudyStatement) {
    globalWarnings.push('No se detectó enunciado común antes de la primera pregunta del supuesto.');
  }

  return {
    questions,
    warnings: globalWarnings,
    caseStudyStatement,
  };
}

export function parseInapAnswerKeyText(rawText: string): Map<string, InapAnswerKeyEntry> {
  const result = new Map<string, InapAnswerKeyEntry>();
  const cleaned = cleanInapPdfText(rawText);
  if (!cleaned) {
    return result;
  }

  const pairRegex =
    /\b([Rr](?:[Ee][Ss][Ee][Rr][Vv][Aa])?\s*\.?\s*\d{1,2}|\d{1,3})\s*(?:[.):\-]+\s*([A-Da-d]|[Aa][Nn][Uu][Ll](?:[Aa][Dd][Aa]|\.)?)|\s+([A-D]|[Aa][Nn][Uu][Ll](?:[Aa][Dd][Aa]|\.)?))\b/g;

  for (const match of cleaned.matchAll(pairRegex)) {
    const rawNum = match[1].replace(/\s+/g, '').toUpperCase();
    const rawVal = (match[2] ?? match[3] ?? '').toUpperCase();
    const digitsMatch = rawNum.match(/\d+/);
    if (!digitsMatch || !rawVal) {
      continue;
    }

    const numeric = Number(digitsMatch[0]);
    const normalizedKey = rawNum.startsWith('R') ? `R${numeric}` : String(numeric);

    if (rawVal.startsWith('ANUL')) {
      result.set(normalizedKey, 'ANULADA');
    } else {
      const idx = LETTER_TO_INDEX[rawVal];
      if (idx !== undefined) {
        result.set(normalizedKey, idx);
      }
    }
  }

  return result;
}

export function applyInapAnswerKey(
  questions: ParsedInapQuestion[],
  answerKey: Map<string, InapAnswerKeyEntry>,
): InapAnswerKeyMergeResult {
  let matchedCount = 0;
  let annulledCount = 0;

  const updated = questions.map((question) => {
    const entry = answerKey.get(question.numberLabel.toUpperCase());

    const cleanWarnings = question.warnings.filter(
      (w) => !w.includes('anulada') && !w.includes('Sin respuesta'),
    );

    if (entry === undefined) {
      return {
        ...question,
        isAnnulled: false,
        warnings: [...cleanWarnings, 'Sin respuesta en plantilla: selecciónala manualmente.'],
      };
    }

    matchedCount += 1;

    if (entry === 'ANULADA') {
      annulledCount += 1;
      return {
        ...question,
        correctIndex: null,
        isAnnulled: true,
        selected: false,
        warnings: [...cleanWarnings, 'Pregunta anulada en la plantilla de respuestas.'],
      };
    }

    const hasAllOptions = question.options.every((opt) => opt.trim().length > 0);
    return {
      ...question,
      correctIndex: entry,
      isAnnulled: false,
      selected: hasAllOptions && question.prompt.trim().length > 0,
      warnings: cleanWarnings,
    };
  });

  return {
    questions: updated,
    matchedCount,
    annulledCount,
  };
}

export function inferInapMetadataFromFilename(filename: string): {
  source: string;
  tags: string[];
} {
  const base = filename.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  const yearMatch = base.match(/\b(20\d{2})\b/);
  const tags = ['examen-pdf'];
  if (yearMatch) {
    tags.push(yearMatch[1]);
  }
  if (/libre/i.test(base)) {
    tags.push('libre');
  } else if (/interna|promoci[óo]n/i.test(base)) {
    tags.push('promocion-interna');
  }

  const source = base || 'Examen PDF';
  return {
    source: source.slice(0, 80),
    tags: Array.from(new Set(tags)),
  };
}

export function normalizePromptForDuplicateCheck(prompt: string): string {
  return prompt
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
