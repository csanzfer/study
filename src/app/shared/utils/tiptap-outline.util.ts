export type OutlineDepth = 'headings-h2' | 'headings-h3' | 'headings-all' | 'full';

export interface OutlineOptions {
  depth?: OutlineDepth;
  rootTitle?: string;
  includeExamCallouts?: boolean;
}

export interface OutlineResult {
  markdown: string;
  hasStructure: boolean;
  headingCount: number;
  itemCount: number;
}

interface TipTapMark {
  type?: string;
}

interface TipTapNode {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: TipTapMark[];
  content?: TipTapNode[];
}

interface OutlineEntry {
  kind: 'heading' | 'list';
  level: number;
  text: string;
  lines?: string[];
}

const MAX_CALLOUT_CHARS = 180;

export function tiptapJsonToOutlineMarkdown(
  contentJson: unknown,
  options: OutlineOptions = {},
): OutlineResult {
  const depth: OutlineDepth = options.depth ?? 'full';
  const includeExamCallouts = options.includeExamCallouts ?? true;
  const maxHeadingLevel = getMaxHeadingLevel(depth);
  const includeLists = depth === 'full';

  if (!contentJson || typeof contentJson !== 'object') {
    return emptyResult();
  }

  const root = contentJson as TipTapNode;
  const topNodes = Array.isArray(root.content) ? root.content : [];
  if (topNodes.length === 0) {
    return emptyResult();
  }

  const entries: OutlineEntry[] = [];
  let headingCount = 0;
  let itemCount = 0;

  for (const node of topNodes) {
    if (!node || typeof node !== 'object') {
      continue;
    }

    if (node.type === 'heading') {
      const rawLevel = Number(node.attrs?.['level'] ?? 1);
      const level = Number.isFinite(rawLevel) ? Math.min(Math.max(rawLevel, 1), 6) : 1;
      if (level <= maxHeadingLevel) {
        const text = extractInlineText(node);
        if (text) {
          entries.push({ kind: 'heading', level, text });
          headingCount += 1;
        }
      }
      continue;
    }

    if (!includeLists) {
      continue;
    }

    if (node.type === 'bulletList' || node.type === 'orderedList' || node.type === 'taskList') {
      const listLines: string[] = [];
      collectListLines(node, 0, listLines);
      if (listLines.length > 0) {
        entries.push({ kind: 'list', level: 0, text: '', lines: listLines });
        itemCount += listLines.length;
      }
      continue;
    }

    if (node.type === 'examCallout' && includeExamCallouts) {
      const calloutLines = collectExamCalloutLines(node);
      if (calloutLines.length > 0) {
        entries.push({ kind: 'list', level: 0, text: '', lines: calloutLines });
        itemCount += calloutLines.length;
      }
    }
  }

  if (headingCount === 0 && itemCount === 0) {
    return emptyResult();
  }

  const h1Count = entries.filter((entry) => entry.kind === 'heading' && entry.level === 1).length;
  const firstEntryIsH1 = entries[0]?.kind === 'heading' && entries[0].level === 1;
  const cleanRootTitle = normalizeInlineWhitespace(options.rootTitle ?? '');

  const needsSyntheticRoot =
    Boolean(cleanRootTitle) && (h1Count === 0 || h1Count > 1 || !firstEntryIsH1);
  const headingShift = needsSyntheticRoot && h1Count > 0 ? 1 : 0;

  const lines: string[] = [];

  if (needsSyntheticRoot && cleanRootTitle) {
    lines.push(`# ${cleanRootTitle}`);
  }

  for (const entry of entries) {
    if (entry.kind === 'heading') {
      const effectiveLevel = Math.min(entry.level + headingShift, 6);
      lines.push(`${'#'.repeat(effectiveLevel)} ${entry.text}`);
    } else if (entry.lines) {
      lines.push(...entry.lines);
    }
  }

  return {
    markdown: lines.join('\n'),
    hasStructure: true,
    headingCount,
    itemCount,
  };
}

function emptyResult(): OutlineResult {
  return {
    markdown: '',
    hasStructure: false,
    headingCount: 0,
    itemCount: 0,
  };
}

function getMaxHeadingLevel(depth: OutlineDepth): number {
  switch (depth) {
    case 'headings-h2':
      return 2;
    case 'headings-h3':
      return 3;
    case 'headings-all':
    case 'full':
      return 4;
  }
}

function collectListLines(listNode: TipTapNode, indentLevel: number, out: string[]): void {
  const items = Array.isArray(listNode.content) ? listNode.content : [];
  const isOrdered = listNode.type === 'orderedList';
  const isTaskList = listNode.type === 'taskList';
  const indent = '  '.repeat(indentLevel);

  items.forEach((item, index) => {
    if (!item || typeof item !== 'object') {
      return;
    }

    const children = Array.isArray(item.content) ? item.content : [];
    const textParts: string[] = [];
    const nestedLists: TipTapNode[] = [];

    for (const child of children) {
      if (
        child.type === 'bulletList' ||
        child.type === 'orderedList' ||
        child.type === 'taskList'
      ) {
        nestedLists.push(child);
      } else {
        const text = extractInlineText(child);
        if (text) {
          textParts.push(text);
        }
      }
    }

    const combinedText = normalizeInlineWhitespace(textParts.join(' '));
    if (combinedText) {
      let prefix = '-';
      if (isOrdered) {
        prefix = `${index + 1}.`;
      } else if (isTaskList) {
        const checked = Boolean(item.attrs?.['checked']);
        prefix = checked ? '- ☑' : '- ☐';
      }
      out.push(`${indent}${prefix} ${combinedText}`);
    }

    for (const nested of nestedLists) {
      collectListLines(nested, combinedText ? indentLevel + 1 : indentLevel, out);
    }
  });
}

function collectExamCalloutLines(calloutNode: TipTapNode): string[] {
  const children = Array.isArray(calloutNode.content) ? calloutNode.content : [];
  const parts: string[] = [];

  for (const child of children) {
    const text = extractInlineText(child);
    if (text) {
      parts.push(text);
    }
  }

  const combined = normalizeInlineWhitespace(parts.join(' · '));
  if (!combined) {
    return [];
  }

  const truncated =
    combined.length > MAX_CALLOUT_CHARS
      ? `${combined.slice(0, MAX_CALLOUT_CHARS - 1).trimEnd()}…`
      : combined;

  return [`- ⚠️ ${truncated}`];
}

function extractInlineText(node: TipTapNode): string {
  if (!node || typeof node !== 'object') {
    return '';
  }

  if (node.type === 'text') {
    const raw = node.text ?? '';
    if (!raw) {
      return '';
    }
    return applyInlineMarks(raw, node.marks);
  }

  if (node.type === 'hardBreak') {
    return ' ';
  }

  if (!Array.isArray(node.content)) {
    return '';
  }

  const joined = node.content.map((child) => extractInlineText(child)).join('');
  return normalizeInlineWhitespace(joined);
}

function applyInlineMarks(text: string, marks?: TipTapMark[]): string {
  if (!marks || marks.length === 0) {
    return text;
  }

  const trimmed = text.trim();
  if (!trimmed) {
    return text;
  }

  const leadingSpace = text.match(/^\s*/)?.[0] ?? '';
  const trailingSpace = text.match(/\s*$/)?.[0] ?? '';
  const markTypes = new Set(marks.map((mark) => mark.type).filter(Boolean));

  let formatted = trimmed;
  if (markTypes.has('code')) {
    formatted = `\`${formatted.replace(/`/g, "'")}\``;
  } else {
    if (markTypes.has('bold')) {
      formatted = `**${formatted}**`;
    }
    if (markTypes.has('italic')) {
      formatted = `*${formatted}*`;
    }
  }

  return `${leadingSpace}${formatted}${trailingSpace}`;
}

function normalizeInlineWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}
