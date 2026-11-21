import { Injectable } from '@angular/core';
import { Editor, JSONContent } from '@tiptap/core';
import { marked } from 'marked';
import { createNoteEditorExtensions } from '../editor/note-editor.extensions';

export type ImportFileFormat = 'docx' | 'md';

export interface ImportedNoteResult {
  fileName: string;
  format: ImportFileFormat;
  suggestedTitle: string;
  suggestedTags: string[];
  contentJson: JSONContent;
  plainText: string;
  wordCount: number;
  warnings: string[];
}

interface ParsedFrontmatter {
  title?: string;
  tags: string[];
  body: string;
}

const DOCX_STYLE_MAP = [
  "p[style-name='Heading 1'] => h1:fresh",
  "p[style-name='Heading 2'] => h2:fresh",
  "p[style-name='Heading 3'] => h3:fresh",
  "p[style-name='Heading 4'] => h4:fresh",
  "p[style-name='Título 1'] => h1:fresh",
  "p[style-name='Título 2'] => h2:fresh",
  "p[style-name='Título 3'] => h3:fresh",
  "p[style-name='Título 4'] => h4:fresh",
  "p[style-name='Title'] => h1:fresh",
  "p[style-name='Título'] => h1:fresh",
];

@Injectable({ providedIn: 'root' })
export class NoteImportService {
  detectFormat(fileName: string): ImportFileFormat | null {
    const lower = fileName.toLowerCase();
    if (lower.endsWith('.docx')) {
      return 'docx';
    }
    if (lower.endsWith('.md') || lower.endsWith('.markdown')) {
      return 'md';
    }
    return null;
  }

  async parseFile(file: File): Promise<ImportedNoteResult> {
    const format = this.detectFormat(file.name);
    if (!format) {
      throw new Error(
        `Formato no soportado para "${file.name}". Usa archivos .docx o .md.`,
      );
    }

    if (format === 'md') {
      const text = await file.text();
      return this.parseMarkdownText(text, file.name);
    }

    const arrayBuffer = await file.arrayBuffer();
    return this.parseDocxArrayBuffer(arrayBuffer, file.name);
  }

  async parseDocxArrayBuffer(
    arrayBuffer: ArrayBuffer,
    fileName = 'documento.docx',
  ): Promise<ImportedNoteResult> {
    const mammothModule = await import('mammoth');
    const mammoth = mammothModule.default ?? mammothModule;

    const result = await mammoth.convertToHtml(
      { arrayBuffer },
      { styleMap: DOCX_STYLE_MAP },
    );

    const cleanedHtml = this.cleanHtml(result.value);
    const warnings = (result.messages ?? [])
      .filter((msg) => msg.type === 'warning' || msg.type === 'error')
      .map((msg) => msg.message);

    const { contentJson, plainText } = this.htmlToTipTap(cleanedHtml);
    const suggestedTitle =
      this.extractFirstHeadingText(cleanedHtml) || this.titleFromFileName(fileName);

    return {
      fileName,
      format: 'docx',
      suggestedTitle,
      suggestedTags: [],
      contentJson,
      plainText,
      wordCount: this.countWords(plainText),
      warnings,
    };
  }

  parseMarkdownText(markdown: string, fileName = 'apunte.md'): ImportedNoteResult {
    const { title: fmTitle, tags, body } = this.extractFrontmatter(markdown);

    const rawHtml = marked.parse(body, {
      gfm: true,
      breaks: false,
      async: false,
    }) as string;

    const normalizedHtml = this.normalizeMarkdownHtml(rawHtml);
    const cleanedHtml = this.cleanHtml(normalizedHtml);
    const { contentJson, plainText } = this.htmlToTipTap(cleanedHtml);

    const suggestedTitle =
      fmTitle || this.extractFirstHeadingText(cleanedHtml) || this.titleFromFileName(fileName);

    return {
      fileName,
      format: 'md',
      suggestedTitle,
      suggestedTags: tags,
      contentJson,
      plainText,
      wordCount: this.countWords(plainText),
      warnings: [],
    };
  }

  mergeTipTapDocuments(
    baseContent: unknown,
    incomingDoc: JSONContent,
  ): { contentJson: JSONContent; plainText: string } {
    const baseDoc = this.normalizeDoc(baseContent);
    const baseNodes = Array.isArray(baseDoc.content) ? baseDoc.content : [];
    const incomingNodes = Array.isArray(incomingDoc.content) ? incomingDoc.content : [];

    const hasMeaningfulBase = baseNodes.some((node) => {
      if (node.type !== 'paragraph') {
        return true;
      }
      return Array.isArray(node.content) && node.content.length > 0;
    });

    const mergedNodes: JSONContent[] = hasMeaningfulBase
      ? [...baseNodes, { type: 'horizontalRule' }, ...incomingNodes]
      : [...incomingNodes];

    const mergedDoc: JSONContent = {
      type: 'doc',
      content: mergedNodes.length > 0 ? mergedNodes : [{ type: 'paragraph' }],
    };

    const editor = new Editor({
      extensions: createNoteEditorExtensions(),
      content: mergedDoc,
    });
    try {
      return {
        contentJson: editor.getJSON(),
        plainText: editor.getText({ blockSeparator: '\n' }),
      };
    } finally {
      editor.destroy();
    }
  }

  private htmlToTipTap(html: string): { contentJson: JSONContent; plainText: string } {
    const editor = new Editor({
      extensions: createNoteEditorExtensions(),
      content: html || '<p></p>',
    });
    try {
      return {
        contentJson: editor.getJSON(),
        plainText: editor.getText({ blockSeparator: '\n' }),
      };
    } finally {
      editor.destroy();
    }
  }

  private extractFrontmatter(raw: string): ParsedFrontmatter {
    const normalized = raw.replace(/\r\n/g, '\n');
    const match = normalized.match(/^---\n([\s\S]*?)\n---\n?/);
    if (!match) {
      return { tags: [], body: normalized };
    }

    const fmBlock = match[1];
    const body = normalized.slice(match[0].length);
    let title: string | undefined;
    const tags: string[] = [];

    const lines = fmBlock.split('\n');
    let readingTagList = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }

      if (readingTagList) {
        const listMatch = trimmed.match(/^-\s+(.+)$/);
        if (listMatch) {
          tags.push(this.stripQuotes(listMatch[1]));
          continue;
        }
        readingTagList = false;
      }

      const titleMatch = trimmed.match(/^title\s*:\s*(.+)$/i);
      if (titleMatch) {
        title = this.stripQuotes(titleMatch[1]);
        continue;
      }

      const inlineTagsMatch = trimmed.match(/^tags\s*:\s*\[([^\]]*)\]$/i);
      if (inlineTagsMatch) {
        const items = inlineTagsMatch[1]
          .split(',')
          .map((item) => this.stripQuotes(item))
          .filter(Boolean);
        tags.push(...items);
        continue;
      }

      const tagsKeyOnly = trimmed.match(/^tags\s*:\s*(.*)$/i);
      if (tagsKeyOnly) {
        if (tagsKeyOnly[1].trim()) {
          const items = tagsKeyOnly[1]
            .split(',')
            .map((item) => this.stripQuotes(item))
            .filter(Boolean);
          tags.push(...items);
        } else {
          readingTagList = true;
        }
      }
    }

    return {
      title: title || undefined,
      tags: Array.from(new Set(tags)),
      body,
    };
  }

  private normalizeMarkdownHtml(html: string): string {
    if (typeof DOMParser === 'undefined') {
      return html;
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // 1. Convert GitHub alert blockquotes (> [!WARNING], > [!IMPORTANT], > [!CAUTION])
    //    or > **Ojo examen:** blockquotes into TipTap's examCallout node
    const blockquotes = Array.from(doc.querySelectorAll('blockquote'));
    for (const bq of blockquotes) {
      const firstP = bq.querySelector('p');
      if (!firstP) {
        continue;
      }

      const text = firstP.textContent?.trim() ?? '';
      const alertMatch = text.match(/^\[!(WARNING|IMPORTANT|CAUTION)\]\s*/i);
      const ojoMatch = text.match(/^(?:⚠️\s*)?ojo\s+examen\s*:?\s*/i);

      if (!alertMatch && !ojoMatch) {
        continue;
      }

      if (alertMatch) {
        firstP.innerHTML = firstP.innerHTML.replace(
          /^\s*\[!(?:WARNING|IMPORTANT|CAUTION)\]\s*(?:<br\s*\/?>)?\s*/i,
          '',
        );
      } else if (ojoMatch) {
        firstP.innerHTML = firstP.innerHTML.replace(
          /^\s*(?:<strong>)?(?:⚠️\s*)?ojo\s+examen\s*:?(?:<\/strong>)?\s*/i,
          '',
        );
      }

      if (!firstP.textContent?.trim()) {
        firstP.remove();
      }

      const callout = doc.createElement('div');
      callout.setAttribute('data-type', 'exam-callout');
      callout.className = 'exam-callout';
      while (bq.firstChild) {
        callout.appendChild(bq.firstChild);
      }
      if (!callout.querySelector('p')) {
        const p = doc.createElement('p');
        callout.appendChild(p);
      }
      bq.replaceWith(callout);
    }

    // 2. Convert GFM task lists (<li><input type="checkbox">...) to TipTap TaskList/TaskItem
    const uls = Array.from(doc.querySelectorAll('ul'));
    for (const ul of uls) {
      const directItems = Array.from(ul.children).filter((el) => el.tagName === 'LI');
      const hasCheckbox = directItems.some((li) =>
        Boolean(li.querySelector(':scope > input[type="checkbox"], :scope > p > input[type="checkbox"]')),
      );
      if (!hasCheckbox) {
        continue;
      }

      ul.setAttribute('data-type', 'taskList');
      for (const li of directItems) {
        const checkbox = li.querySelector(
          ':scope > input[type="checkbox"], :scope > p > input[type="checkbox"]',
        ) as HTMLInputElement | null;
        if (!checkbox) {
          continue;
        }

        const isChecked = checkbox.hasAttribute('checked') || checkbox.checked;
        checkbox.remove();
        li.setAttribute('data-type', 'taskItem');
        li.setAttribute('data-checked', isChecked ? 'true' : 'false');

        // Ensure text inside taskItem is wrapped in a <p> for TipTap
        const firstElement = li.firstElementChild;
        if (!firstElement || firstElement.tagName !== 'P') {
          const p = doc.createElement('p');
          while (li.firstChild && !(li.firstChild instanceof Element && li.firstChild.tagName === 'UL')) {
            p.appendChild(li.firstChild);
          }
          p.innerHTML = p.innerHTML.trim();
          li.insertBefore(p, li.firstChild);
        }
      }
    }

    return doc.body.innerHTML;
  }

  private cleanHtml(html: string): string {
    if (typeof DOMParser === 'undefined') {
      return html.trim();
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Remove inline styles & Word-specific classes/attributes except our custom data attributes
    for (const el of Array.from(doc.body.querySelectorAll('*'))) {
      el.removeAttribute('style');
      if (el.getAttribute('data-type') !== 'exam-callout') {
        el.removeAttribute('class');
      }
    }

    // Remove empty paragraphs (common in Word documents)
    for (const p of Array.from(doc.body.querySelectorAll('p'))) {
      const hasMedia = p.querySelector('img, br, input, table');
      if (!hasMedia && !p.textContent?.trim()) {
        p.remove();
      }
    }

    return doc.body.innerHTML.trim();
  }

  private extractFirstHeadingText(html: string): string | null {
    if (typeof DOMParser === 'undefined') {
      const match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
      return match ? match[1].replace(/<[^>]+>/g, '').trim() : null;
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const h1 = doc.body.querySelector('h1');
    return h1?.textContent?.trim() || null;
  }

  private titleFromFileName(fileName: string): string {
    const withoutExt = fileName.replace(/\.(docx|md|markdown)$/i, '');
    return withoutExt.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Nuevo tema';
  }

  private stripQuotes(value: string): string {
    return value.trim().replace(/^["']|["']$/g, '').trim();
  }

  private countWords(text: string): number {
    const trimmed = text.trim();
    if (!trimmed) {
      return 0;
    }
    return trimmed.split(/\s+/).length;
  }

  private normalizeDoc(content: unknown): JSONContent {
    if (content && typeof content === 'object' && 'type' in content) {
      return content as JSONContent;
    }
    return { type: 'doc', content: [] };
  }
}
