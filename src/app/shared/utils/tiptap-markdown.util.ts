import {
  TOPIC_STATUS_LABELS,
  TaiBlock,
  Topic,
} from '../../core/models/study.models';

export interface TopicMarkdownExportOptions {
  includeMetadataHeader?: boolean;
  includeCustomOutline?: boolean;
}

interface TipTapMark {
  type?: string;
  attrs?: Record<string, unknown>;
}

interface TipTapNode {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: TipTapMark[];
  content?: TipTapNode[];
}

export function tiptapJsonToMarkdown(contentJson: unknown): string {
  if (!contentJson || typeof contentJson !== 'object') {
    return '';
  }

  const root = contentJson as TipTapNode;
  const nodes = Array.isArray(root.content) ? root.content : [];
  if (nodes.length === 0) {
    return '';
  }

  const blocks = nodes
    .map((node) => renderBlockNode(node))
    .map((chunk) => chunk.trimEnd())
    .filter((chunk) => chunk.trim().length > 0);

  return blocks.join('\n\n').trim();
}

export function buildTopicMarkdownDocument(
  topic: Topic,
  block?: TaiBlock,
  options: TopicMarkdownExportOptions = {},
): string {
  const includeMetadataHeader = options.includeMetadataHeader ?? true;
  const includeCustomOutline = options.includeCustomOutline ?? true;

  const parts: string[] = [];
  const bodyMd = tiptapJsonToMarkdown(topic.contentJson);

  if (includeMetadataHeader) {
    const headerLines: string[] = [`# ${topic.title}`];
    const metaItems: string[] = [];

    if (block) {
      metaItems.push(`**Bloque:** ${block.code} — ${block.title}`);
    } else {
      metaItems.push(`**Bloque:** ${topic.blockId}`);
    }

    metaItems.push(`**Estado:** ${TOPIC_STATUS_LABELS[topic.status] ?? topic.status}`);
    metaItems.push(`**Vueltas:** ${topic.roundCount}`);

    if (topic.tags.length > 0) {
      metaItems.push(`**Etiquetas:** ${topic.tags.map((t) => `\`#${t}\``).join(' ')}`);
    }

    if (topic.lastReviewedAt) {
      metaItems.push(`**Último repaso:** ${formatIsoDate(topic.lastReviewedAt)}`);
    } else if (topic.updatedAt) {
      metaItems.push(`**Actualizado:** ${formatIsoDate(topic.updatedAt)}`);
    }

    headerLines.push('');
    headerLines.push(metaItems.map((item) => `- ${item}`).join('\n'));
    headerLines.push('');
    headerLines.push('---');
    parts.push(headerLines.join('\n'));
  }

  if (bodyMd) {
    const normalizedBody = stripDuplicateTopH1(bodyMd, topic.title, includeMetadataHeader);
    if (normalizedBody) {
      parts.push(normalizedBody);
    }
  } else if (topic.plainText.trim()) {
    parts.push(topic.plainText.trim());
  }

  if (includeCustomOutline && topic.customOutlineMd?.trim()) {
    parts.push(`---\n\n## Esquema resumido\n\n${topic.customOutlineMd.trim()}`);
  }

  return parts.join('\n\n').trim() + '\n';
}

export function buildBlockMarkdownDocument(
  block: TaiBlock,
  topics: Topic[],
  options: TopicMarkdownExportOptions = {},
): string {
  const sorted = [...topics].sort((a, b) => a.order - b.order);
  const parts: string[] = [];

  parts.push(`# ${block.code} — ${block.title}`);
  if (block.description) {
    parts.push(`> ${block.description}`);
  }

  if (sorted.length > 0) {
    const tocLines = ['## Índice de temas', ''];
    for (const topic of sorted) {
      const statusLabel = TOPIC_STATUS_LABELS[topic.status] ?? topic.status;
      tocLines.push(`${topic.order}. **${topic.title}** *(${statusLabel} · ${topic.roundCount} vueltas)*`);
    }
    parts.push(tocLines.join('\n'));
  }

  for (const topic of sorted) {
    const topicMd = buildTopicMarkdownDocument(topic, block, options).trim();
    const shifted = shiftHeadingsDown(topicMd);
    parts.push(`---\n\n${shifted}`);
  }

  return parts.join('\n\n').trim() + '\n';
}

export function sanitizeExportFilename(value: string, fallback = 'apunte'): string {
  const cleaned = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);

  return cleaned || fallback;
}

function renderBlockNode(node: TipTapNode): string {
  if (!node || typeof node !== 'object') {
    return '';
  }

  switch (node.type) {
    case 'heading': {
      const rawLevel = Number(node.attrs?.['level'] ?? 1);
      const level = Number.isFinite(rawLevel) ? Math.min(Math.max(rawLevel, 1), 6) : 1;
      const text = renderInlineChildren(node.content).trim();
      return text ? `${'#'.repeat(level)} ${text}` : '';
    }

    case 'paragraph': {
      return renderInlineChildren(node.content).trimEnd();
    }

    case 'bulletList':
    case 'orderedList':
    case 'taskList': {
      return renderList(node, 0);
    }

    case 'blockquote': {
      const inner = renderNestedBlocks(node.content);
      if (!inner) {
        return '';
      }
      return inner
        .split('\n')
        .map((line) => (line.trim().length > 0 ? `> ${line}` : '>'))
        .join('\n');
    }

    case 'examCallout': {
      const inner = renderNestedBlocks(node.content);
      if (!inner) {
        return '';
      }
      const prefixed = inner
        .split('\n')
        .map((line) => (line.trim().length > 0 ? `> ${line}` : '>'))
        .join('\n');
      return `> [!IMPORTANT]\n> **Ojo examen**\n>\n${prefixed}`;
    }

    case 'codeBlock': {
      const language = typeof node.attrs?.['language'] === 'string' ? node.attrs['language'].trim() : '';
      const rawCode = extractRawText(node);
      const fence = rawCode.includes('```') ? '````' : '```';
      return `${fence}${language}\n${rawCode}\n${fence}`;
    }

    case 'horizontalRule': {
      return '---';
    }

    case 'table': {
      return renderTable(node);
    }

    default: {
      if (Array.isArray(node.content)) {
        return renderNestedBlocks(node.content);
      }
      return '';
    }
  }
}

function renderNestedBlocks(children?: TipTapNode[]): string {
  if (!Array.isArray(children) || children.length === 0) {
    return '';
  }
  return children
    .map((child) => renderBlockNode(child))
    .map((chunk) => chunk.trimEnd())
    .filter((chunk) => chunk.trim().length > 0)
    .join('\n\n');
}

function renderList(listNode: TipTapNode, indentLevel: number): string {
  const items = Array.isArray(listNode.content) ? listNode.content : [];
  if (items.length === 0) {
    return '';
  }

  const isOrdered = listNode.type === 'orderedList';
  const isTaskList = listNode.type === 'taskList';
  const startNum = Number(listNode.attrs?.['start'] ?? 1);
  const start = Number.isFinite(startNum) && startNum >= 1 ? Math.floor(startNum) : 1;
  const indent = '  '.repeat(indentLevel);
  const lines: string[] = [];

  items.forEach((item, index) => {
    if (!item || typeof item !== 'object') {
      return;
    }

    let marker = '-';
    if (isOrdered) {
      marker = `${start + index}.`;
    } else if (isTaskList) {
      const checked = Boolean(item.attrs?.['checked']);
      marker = checked ? '- [x]' : '- [ ]';
    }

    const children = Array.isArray(item.content) ? item.content : [];
    const inlineParts: string[] = [];
    const nestedBlocks: string[] = [];

    for (const child of children) {
      if (
        child.type === 'bulletList' ||
        child.type === 'orderedList' ||
        child.type === 'taskList'
      ) {
        const renderedNested = renderList(child, indentLevel + 1);
        if (renderedNested) {
          nestedBlocks.push(renderedNested);
        }
      } else if (child.type === 'paragraph') {
        const text = renderInlineChildren(child.content).trim();
        if (text) {
          inlineParts.push(text);
        }
      } else {
        const rendered = renderBlockNode(child);
        if (rendered) {
          nestedBlocks.push(
            rendered
              .split('\n')
              .map((line) => `${indent}  ${line}`)
              .join('\n'),
          );
        }
      }
    }

    if (inlineParts.length > 0) {
      const [first, ...rest] = inlineParts;
      lines.push(`${indent}${marker} ${first}`);
      for (const extra of rest) {
        lines.push(`${indent}  ${extra}`);
      }
    } else if (nestedBlocks.length > 0) {
      lines.push(`${indent}${marker}`);
    }

    for (const nested of nestedBlocks) {
      lines.push(nested);
    }
  });

  return lines.join('\n');
}

function renderTable(tableNode: TipTapNode): string {
  const rows = Array.isArray(tableNode.content)
    ? tableNode.content.filter((n) => n?.type === 'tableRow')
    : [];

  if (rows.length === 0) {
    return '';
  }

  const matrix: string[][] = rows.map((row) => {
    const cells = Array.isArray(row.content) ? row.content : [];
    return cells.map((cell) => renderTableCell(cell));
  });

  const colCount = Math.max(...matrix.map((r) => r.length), 0);
  if (colCount === 0) {
    return '';
  }

  const normalized = matrix.map((row) => {
    const copy = [...row];
    while (copy.length < colCount) {
      copy.push('');
    }
    return copy;
  });

  const headerRow = normalized[0];
  const bodyRows = normalized.slice(1);
  const separator = Array.from({ length: colCount }, () => '---');

  const lines = [
    `| ${headerRow.join(' | ')} |`,
    `| ${separator.join(' | ')} |`,
    ...bodyRows.map((row) => `| ${row.join(' | ')} |`),
  ];

  return lines.join('\n');
}

function renderTableCell(cellNode: TipTapNode): string {
  const blocks = Array.isArray(cellNode.content) ? cellNode.content : [];
  const text = blocks
    .map((child) => {
      if (child.type === 'paragraph') {
        return renderInlineChildren(child.content).trim();
      }
      return renderBlockNode(child).trim();
    })
    .filter(Boolean)
    .join('<br>');

  return text.replace(/\|/g, '\\|').replace(/\n+/g, '<br>');
}

function renderInlineChildren(children?: TipTapNode[]): string {
  if (!Array.isArray(children) || children.length === 0) {
    return '';
  }

  return children.map((node) => renderInlineNode(node)).join('');
}

function renderInlineNode(node: TipTapNode): string {
  if (!node || typeof node !== 'object') {
    return '';
  }

  if (node.type === 'hardBreak') {
    return '  \n';
  }

  if (node.type === 'text') {
    return applyMarks(node.text ?? '', node.marks);
  }

  if (Array.isArray(node.content)) {
    return renderInlineChildren(node.content);
  }

  return '';
}

function applyMarks(text: string, marks?: TipTapMark[]): string {
  if (!marks || marks.length === 0 || !text) {
    return text;
  }

  const trimmed = text.trim();
  if (!trimmed) {
    return text;
  }

  const leading = text.match(/^\s*/)?.[0] ?? '';
  const trailing = text.match(/\s*$/)?.[0] ?? '';
  const types = new Set(marks.map((m) => m.type).filter(Boolean));

  let result = trimmed;

  if (types.has('code')) {
    const delimiter = result.includes('`') ? '``' : '`';
    const padded = result.startsWith('`') || result.endsWith('`') ? ` ${result} ` : result;
    result = `${delimiter}${padded}${delimiter}`;
  } else {
    if (types.has('bold')) {
      result = `**${result}**`;
    }
    if (types.has('italic')) {
      result = `*${result}*`;
    }
    if (types.has('strike')) {
      result = `~~${result}~~`;
    }
    if (types.has('underline')) {
      result = `<u>${result}</u>`;
    }
  }

  return `${leading}${result}${trailing}`;
}

function extractRawText(node: TipTapNode): string {
  if (!node || typeof node !== 'object') {
    return '';
  }
  if (node.type === 'text') {
    return node.text ?? '';
  }
  if (node.type === 'hardBreak') {
    return '\n';
  }
  if (!Array.isArray(node.content)) {
    return '';
  }
  return node.content.map((child) => extractRawText(child)).join('');
}

function stripDuplicateTopH1(markdown: string, title: string, hasHeader: boolean): string {
  if (!hasHeader) {
    return markdown;
  }

  const lines = markdown.split('\n');
  const firstLine = lines[0]?.trim() ?? '';
  const normalizedTitle = title.trim().toLowerCase();
  if (firstLine.startsWith('# ') && firstLine.slice(2).trim().toLowerCase() === normalizedTitle) {
    return lines.slice(1).join('\n').trimStart();
  }

  return markdown;
}

function shiftHeadingsDown(markdown: string): string {
  let inCodeFence = false;
  return markdown
    .split('\n')
    .map((line) => {
      if (line.trim().startsWith('```')) {
        inCodeFence = !inCodeFence;
        return line;
      }
      if (!inCodeFence && /^#{1,5}\s+/.test(line)) {
        return `#${line}`;
      }
      return line;
    })
    .join('\n');
}

function formatIsoDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso.slice(0, 10);
  }
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
