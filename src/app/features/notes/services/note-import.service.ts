import { Injectable, inject } from '@angular/core';
import { Editor, JSONContent } from '@tiptap/core';
import { marked } from 'marked';
import {
  PdfStructuredLine,
  PdfStructuredPage,
  PdfTextExtractorService,
} from '../../tests/services/pdf-text-extractor.service';
import { createNoteEditorExtensions } from '../editor/note-editor.extensions';

export type ImportFileFormat = 'docx' | 'md' | 'pdf' | 'pptx';

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
  private readonly pdfExtractor = inject(PdfTextExtractorService);

  detectFormat(fileName: string): ImportFileFormat | null {
    const lower = fileName.toLowerCase();
    if (lower.endsWith('.docx')) {
      return 'docx';
    }
    if (lower.endsWith('.md') || lower.endsWith('.markdown')) {
      return 'md';
    }
    if (lower.endsWith('.pdf')) {
      return 'pdf';
    }
    if (lower.endsWith('.pptx')) {
      return 'pptx';
    }
    return null;
  }

  async parseFile(file: File): Promise<ImportedNoteResult> {
    const format = this.detectFormat(file.name);
    if (!format) {
      throw new Error(
        `Formato no soportado para "${file.name}". Usa archivos .docx, .md, .pdf o .pptx.`,
      );
    }

    if (format === 'md') {
      const text = await file.text();
      return this.parseMarkdownText(text, file.name);
    }

    if (format === 'pdf') {
      return this.parsePdfFile(file);
    }

    const arrayBuffer = await file.arrayBuffer();
    if (format === 'pptx') {
      return this.parsePptxArrayBuffer(arrayBuffer, file.name);
    }

    return this.parseDocxArrayBuffer(arrayBuffer, file.name);
  }

  async parsePdfFile(file: File): Promise<ImportedNoteResult> {
    const { pages } = await this.pdfExtractor.extractStructuredPagesFromPdfFile(file);
    return this.parsePdfPages(pages, file.name);
  }

  parsePdfPages(
    pages: PdfStructuredPage[],
    fileName = 'documento.pdf',
  ): ImportedNoteResult {
    const html = this.pdfPagesToHtml(pages);
    const cleanedHtml = this.cleanHtml(html);
    const { contentJson, plainText } = this.htmlToTipTap(cleanedHtml);
    const warnings: string[] = [];

    if (!plainText.trim()) {
      warnings.push(
        'No se encontró texto seleccionable en el PDF (puede ser un documento escaneado como imagen).',
      );
    }

    const suggestedTitle =
      this.extractFirstHeadingText(cleanedHtml) || this.titleFromFileName(fileName);

    return {
      fileName,
      format: 'pdf',
      suggestedTitle,
      suggestedTags: [],
      contentJson,
      plainText,
      wordCount: this.countWords(plainText),
      warnings,
    };
  }

  async parsePptxArrayBuffer(
    arrayBuffer: ArrayBuffer,
    fileName = 'presentacion.pptx',
  ): Promise<ImportedNoteResult> {
    const jszipModule = await import('jszip');
    const JSZip = jszipModule.default ?? jszipModule;
    const zip = await JSZip.loadAsync(arrayBuffer);

    const slideEntries = await this.resolvePptxSlideEntries(zip);

    if (slideEntries.length === 0) {
      throw new Error(
        `El archivo "${fileName}" no contiene diapositivas válidas de PowerPoint (.pptx).`,
      );
    }

    const slideHtmlParts: string[] = [];
    let emptySlides = 0;

    for (let index = 0; index < slideEntries.length; index += 1) {
      const entry = slideEntries[index];
      const slideFile = zip.file(entry.path);
      if (!slideFile) {
        continue;
      }

      const slideXml = await slideFile.async('string');
      const notesXml = await this.readSlideNotesXml(zip, entry.path, entry.number);
      const slideHtml = this.parsePptxSlideXml(slideXml, index + 1, notesXml);

      if (slideHtml.trim()) {
        slideHtmlParts.push(slideHtml);
      } else {
        emptySlides += 1;
      }
    }

    const warnings: string[] = [];
    if (emptySlides > 0) {
      warnings.push(
        `${emptySlides} diapositiva(s) no contenían texto extraíble (pueden contener solo imágenes o gráficos).`,
      );
    }

    const cleanedHtml = this.cleanHtml(slideHtmlParts.join('\n'));
    const { contentJson, plainText } = this.htmlToTipTap(cleanedHtml);
    const suggestedTitle =
      this.extractFirstHeadingText(cleanedHtml) || this.titleFromFileName(fileName);

    return {
      fileName,
      format: 'pptx',
      suggestedTitle,
      suggestedTags: [],
      contentJson,
      plainText,
      wordCount: this.countWords(plainText),
      warnings,
    };
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
      const match = html.match(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/i);
      return match ? match[1].replace(/<[^>]+>/g, '').trim() : null;
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const heading = doc.body.querySelector('h1, h2');
    return heading?.textContent?.trim() || null;
  }

  private titleFromFileName(fileName: string): string {
    const withoutExt = fileName.replace(/\.(docx|md|markdown|pdf|pptx)$/i, '');
    return withoutExt.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Nuevo tema';
  }

  private pdfPagesToHtml(pages: PdfStructuredPage[]): string {
    const fontSizes = pages
      .flatMap((page) => page.lines)
      .map((line) => line.fontSize)
      .filter((size) => size > 0)
      .sort((a, b) => a - b);

    const medianFontSize =
      fontSizes.length > 0 ? fontSizes[Math.floor(fontSizes.length / 2)] : 0;

    const blocks: string[] = [];
    let paragraphLines: string[] = [];
    let openList: 'ul' | 'ol' | null = null;
    let listItems: string[] = [];

    const flushParagraph = (): void => {
      if (paragraphLines.length === 0) {
        return;
      }
      let joined = '';
      for (const part of paragraphLines) {
        if (!joined) {
          joined = part;
        } else if (/\p{L}-$/u.test(joined) && /^\p{Ll}/u.test(part)) {
          joined = joined.slice(0, -1) + part;
        } else {
          joined += ` ${part}`;
        }
      }
      blocks.push(`<p>${this.escapeHtml(joined)}</p>`);
      paragraphLines = [];
    };

    const flushList = (): void => {
      if (!openList || listItems.length === 0) {
        openList = null;
        listItems = [];
        return;
      }
      const itemsHtml = listItems
        .map((item) => `<li><p>${this.escapeHtml(item)}</p></li>`)
        .join('');
      blocks.push(`<${openList}>${itemsHtml}</${openList}>`);
      openList = null;
      listItems = [];
    };

    const detectHeadingLevel = (line: PdfStructuredLine): 1 | 2 | 3 | null => {
      if (medianFontSize <= 0 || line.fontSize <= 0) {
        return null;
      }
      const text = line.text.trim();
      if (text.length > 140 || /[.;]$/.test(text)) {
        return null;
      }
      const ratio = line.fontSize / medianFontSize;
      if (ratio >= 1.45) {
        return 1;
      }
      if (ratio >= 1.2) {
        return 2;
      }
      if (ratio >= 1.1) {
        return 3;
      }
      return null;
    };

    for (let pageIdx = 0; pageIdx < pages.length; pageIdx += 1) {
      const page = pages[pageIdx];
      if (pageIdx > 0 && paragraphLines.length > 0) {
        const lastLine = paragraphLines[paragraphLines.length - 1];
        if (/[.:?!]$/.test(lastLine)) {
          flushParagraph();
        }
      }

      let prevY: number | null = null;

      for (const line of page.lines) {
        const text = line.text.trim();
        if (!text) {
          continue;
        }

        const headingLevel = detectHeadingLevel(line);
        if (headingLevel) {
          flushParagraph();
          flushList();
          blocks.push(`<h${headingLevel}>${this.escapeHtml(text)}</h${headingLevel}>`);
          prevY = line.y;
          continue;
        }

        const bulletMatch = text.match(/^[•●▪◦‣–—*-]\s+(.+)$/);
        if (bulletMatch) {
          flushParagraph();
          if (openList && openList !== 'ul') {
            flushList();
          }
          openList = 'ul';
          listItems.push(bulletMatch[1].trim());
          prevY = line.y;
          continue;
        }

        const orderedMatch = text.match(/^\d+[.)]\s+(.+)$/);
        if (orderedMatch) {
          flushParagraph();
          if (openList && openList !== 'ol') {
            flushList();
          }
          openList = 'ol';
          listItems.push(orderedMatch[1].trim());
          prevY = line.y;
          continue;
        }

        flushList();

        const referenceSize = line.fontSize || medianFontSize || 11;
        const paragraphGap = Math.max(referenceSize * 1.85, 18);
        if (prevY !== null && prevY - line.y > paragraphGap) {
          flushParagraph();
        }

        paragraphLines.push(text);
        prevY = line.y;
      }
    }

    flushParagraph();
    flushList();

    return blocks.join('\n');
  }

  private async resolvePptxSlideEntries(zip: {
    files: Record<string, unknown>;
    file: (path: string) => { async: (type: 'string') => Promise<string> } | null;
  }): Promise<Array<{ path: string; number: number | null }>> {
    if (typeof DOMParser !== 'undefined') {
      const presFile = zip.file('ppt/presentation.xml');
      const relsFile = zip.file('ppt/_rels/presentation.xml.rels');

      if (presFile && relsFile) {
        try {
          const [presXml, relsXml] = await Promise.all([
            presFile.async('string'),
            relsFile.async('string'),
          ]);
          const parser = new DOMParser();
          const relsDoc = parser.parseFromString(relsXml, 'application/xml');
          const relTargets = new Map<string, string>();
          for (const rel of this.getDescendantsByLocalName(relsDoc.documentElement, 'Relationship')) {
            const id = rel.getAttribute('Id');
            const target = rel.getAttribute('Target');
            if (id && target) {
              const normalizedPath = target.startsWith('/')
                ? target.slice(1)
                : target.startsWith('ppt/')
                  ? target
                  : `ppt/${target.replace(/^\.\//, '')}`;
              relTargets.set(id, normalizedPath);
            }
          }

          const presDoc = parser.parseFromString(presXml, 'application/xml');
          const sldIds = this.getDescendantsByLocalName(presDoc.documentElement, 'sldId');
          const orderedEntries: Array<{ path: string; number: number | null }> = [];
          const seen = new Set<string>();

          for (const sldId of sldIds) {
            const rId =
              sldId.getAttribute('r:id') ??
              sldId.getAttributeNS(
                'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
                'id',
              );
            if (!rId) {
              continue;
            }
            const targetPath = relTargets.get(rId);
            if (!targetPath || seen.has(targetPath) || !zip.file(targetPath)) {
              continue;
            }
            seen.add(targetPath);
            const numMatch = targetPath.match(/slide(\d+)\.xml$/i);
            orderedEntries.push({
              path: targetPath,
              number: numMatch ? Number(numMatch[1]) : null,
            });
          }

          if (orderedEntries.length > 0) {
            return orderedEntries;
          }
        } catch {
          // Fallback to filename-based ordering below
        }
      }
    }

    return Object.keys(zip.files)
      .map((path) => {
        const match = path.match(/^ppt\/slides\/slide(\d+)\.xml$/i);
        return match ? { path, number: Number(match[1]) } : null;
      })
      .filter((entry): entry is { path: string; number: number } => entry !== null)
      .sort((a, b) => a.number - b.number);
  }

  private async readSlideNotesXml(
    zip: { file: (path: string) => { async: (type: 'string') => Promise<string> } | null },
    slidePath: string,
    slideNumber: number | null,
  ): Promise<string | null> {
    const lastSlash = slidePath.lastIndexOf('/');
    const slideDir = lastSlash >= 0 ? slidePath.slice(0, lastSlash) : 'ppt/slides';
    const slideBaseName = lastSlash >= 0 ? slidePath.slice(lastSlash + 1) : slidePath;
    const relsFile = zip.file(`${slideDir}/_rels/${slideBaseName}.rels`);
    if (relsFile && typeof DOMParser !== 'undefined') {
      try {
        const relsXml = await relsFile.async('string');
        const parser = new DOMParser();
        const relsDoc = parser.parseFromString(relsXml, 'application/xml');
        const relationships = this.getDescendantsByLocalName(relsDoc.documentElement, 'Relationship');
        for (const rel of relationships) {
          const type = rel.getAttribute('Type') ?? '';
          const target = rel.getAttribute('Target') ?? '';
          if (type.includes('notesSlide') && target) {
            const normalizedPath = target.startsWith('../')
              ? `ppt/${target.slice(3)}`
              : target.startsWith('/')
                ? target.slice(1)
                : `${slideDir}/${target.replace(/^\.\//, '')}`;
            const notesFile = zip.file(normalizedPath);
            if (notesFile) {
              return await notesFile.async('string');
            }
          }
        }
      } catch {
        // Fallback to conventional notesSlide path below
      }
    }

    if (slideNumber !== null) {
      const fallbackFile = zip.file(`ppt/notesSlides/notesSlide${slideNumber}.xml`);
      if (fallbackFile) {
        return await fallbackFile.async('string');
      }
    }

    return null;
  }

  parsePptxSlideXml(
    slideXml: string,
    slideIndex: number,
    notesXml?: string | null,
  ): string {
    if (typeof DOMParser === 'undefined') {
      return '';
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(slideXml, 'application/xml');
    const spTree = this.getDescendantsByLocalName(doc.documentElement, 'spTree')[0];
    if (!spTree) {
      return '';
    }

    let titleHtml = '';
    let subtitleHtml = '';
    const bodyBlocks: string[] = [];

    const processContainer = (container: Element): void => {
      for (const child of Array.from(container.children)) {
        const name = child.localName;
        if (name === 'grpSp') {
          processContainer(child);
          continue;
        }

        if (name === 'sp') {
          const ph = this.getDescendantsByLocalName(child, 'ph')[0];
          const phType = ph?.getAttribute('type') ?? '';
          if (phType === 'sldNum' || phType === 'ftr' || phType === 'dt') {
            continue;
          }

          const txBody = this.getDirectChildrenByLocalName(child, 'txBody')[0];
          if (!txBody) {
            continue;
          }

          const isTitle = phType === 'title' || phType === 'ctrTitle';
          const isSubtitle = phType === 'subTitle';
          const isBodyPlaceholder = phType === 'body' || phType === 'obj' || phType === '';

          if (isTitle) {
            const headingText = this.extractPlainTextFromTxBody(txBody);
            if (headingText && !titleHtml) {
              const tag = slideIndex === 1 ? 'h1' : 'h2';
              titleHtml = `<${tag}>${this.escapeHtml(headingText)}</${tag}>`;
            }
            continue;
          }

          if (isSubtitle) {
            const subText = this.extractPlainTextFromTxBody(txBody);
            if (subText && !subtitleHtml) {
              subtitleHtml = `<h3>${this.escapeHtml(subText)}</h3>`;
            }
            continue;
          }

          const shapeHtml = this.pptxTxBodyToHtml(txBody, isBodyPlaceholder);
          if (shapeHtml) {
            bodyBlocks.push(shapeHtml);
          }
          continue;
        }

        if (name === 'graphicFrame') {
          const tables = this.getDescendantsByLocalName(child, 'tbl');
          for (const tbl of tables) {
            const tableHtml = this.pptxTableToHtml(tbl);
            if (tableHtml) {
              bodyBlocks.push(tableHtml);
            }
          }
        }
      }
    };

    processContainer(spTree);

    if (notesXml) {
      const notesText = this.extractPptxNotesText(notesXml);
      if (notesText) {
        bodyBlocks.push(
          `<blockquote><p><strong>Notas de la diapositiva:</strong> ${this.escapeHtml(notesText)}</p></blockquote>`,
        );
      }
    }

    if (!titleHtml && !subtitleHtml && bodyBlocks.length === 0) {
      return '';
    }

    const parts: string[] = [];
    if (titleHtml) {
      parts.push(titleHtml);
    } else if (bodyBlocks.length > 0 || subtitleHtml) {
      parts.push(`<h2>Diapositiva ${slideIndex}</h2>`);
    }
    if (subtitleHtml) {
      parts.push(subtitleHtml);
    }
    parts.push(...bodyBlocks);

    return parts.join('\n');
  }

  private extractPlainTextFromTxBody(txBody: Element): string {
    const paragraphs = this.getDirectChildrenByLocalName(txBody, 'p');
    return paragraphs
      .map((p) =>
        this.getDescendantsByLocalName(p, 't')
          .map((t) => t.textContent ?? '')
          .join('')
          .trim(),
      )
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private pptxTxBodyToHtml(txBody: Element, defaultToList: boolean): string {
    const paragraphs = this.getDirectChildrenByLocalName(txBody, 'p');
    const htmlBlocks: string[] = [];
    let openList: 'ul' | 'ol' | null = null;
    let listItems: string[] = [];

    const flushList = (): void => {
      if (!openList || listItems.length === 0) {
        openList = null;
        listItems = [];
        return;
      }
      const items = listItems.map((item) => `<li><p>${item}</p></li>`).join('');
      htmlBlocks.push(`<${openList}>${items}</${openList}>`);
      openList = null;
      listItems = [];
    };

    for (const p of paragraphs) {
      const inlineHtml = this.pptxParagraphInlineHtml(p);
      if (!inlineHtml.trim()) {
        continue;
      }

      const pPr = this.getDirectChildrenByLocalName(p, 'pPr')[0];
      const hasBuNone = Boolean(pPr && this.getDirectChildrenByLocalName(pPr, 'buNone').length > 0);
      const hasBuAutoNum = Boolean(
        pPr && this.getDirectChildrenByLocalName(pPr, 'buAutoNum').length > 0,
      );
      const hasBuChar = Boolean(
        pPr && this.getDirectChildrenByLocalName(pPr, 'buChar').length > 0,
      );
      const level = Number(pPr?.getAttribute('lvl') ?? '0');

      const shouldBeOrdered = !hasBuNone && hasBuAutoNum;
      const shouldBeUnordered =
        !hasBuNone &&
        !shouldBeOrdered &&
        (hasBuChar || level > 0 || (defaultToList && paragraphs.length > 1));

      if (shouldBeOrdered) {
        if (openList && openList !== 'ol') {
          flushList();
        }
        openList = 'ol';
        listItems.push(inlineHtml);
      } else if (shouldBeUnordered) {
        if (openList && openList !== 'ul') {
          flushList();
        }
        openList = 'ul';
        listItems.push(inlineHtml);
      } else {
        flushList();
        htmlBlocks.push(`<p>${inlineHtml}</p>`);
      }
    }

    flushList();
    return htmlBlocks.join('\n');
  }

  private pptxParagraphInlineHtml(p: Element): string {
    const chunks: string[] = [];

    for (const child of Array.from(p.children)) {
      if (child.localName === 'br') {
        chunks.push('<br>');
        continue;
      }
      if (child.localName === 'r' || child.localName === 'fld') {
        const textNode = this.getDirectChildrenByLocalName(child, 't')[0];
        const rawText = textNode?.textContent ?? '';
        if (!rawText) {
          continue;
        }
        let html = this.escapeHtml(rawText);
        const rPr = this.getDirectChildrenByLocalName(child, 'rPr')[0];
        if (rPr) {
          if (rPr.getAttribute('b') === '1') {
            html = `<strong>${html}</strong>`;
          }
          if (rPr.getAttribute('i') === '1') {
            html = `<em>${html}</em>`;
          }
          const underline = rPr.getAttribute('u');
          if (underline && underline !== 'none') {
            html = `<u>${html}</u>`;
          }
        }
        chunks.push(html);
      }
    }

    return chunks.join('');
  }

  private pptxTableToHtml(tbl: Element): string {
    const rows = this.getDirectChildrenByLocalName(tbl, 'tr');
    if (rows.length === 0) {
      return '';
    }

    const rowHtmlList: string[] = [];
    rows.forEach((tr, rowIndex) => {
      const cells = this.getDirectChildrenByLocalName(tr, 'tc');
      if (cells.length === 0) {
        return;
      }
      const tag = rowIndex === 0 ? 'th' : 'td';
      const cellsHtml = cells
        .map((tc) => {
          const txBody = this.getDirectChildrenByLocalName(tc, 'txBody')[0];
          const text = txBody ? this.extractPlainTextFromTxBody(txBody) : '';
          return `<${tag}><p>${this.escapeHtml(text)}</p></${tag}>`;
        })
        .join('');
      rowHtmlList.push(`<tr>${cellsHtml}</tr>`);
    });

    if (rowHtmlList.length === 0) {
      return '';
    }
    return `<table><tbody>${rowHtmlList.join('')}</tbody></table>`;
  }

  private extractPptxNotesText(notesXml: string): string {
    const parser = new DOMParser();
    const doc = parser.parseFromString(notesXml, 'application/xml');
    const shapes = this.getDescendantsByLocalName(doc.documentElement, 'sp');
    const parts: string[] = [];

    for (const sp of shapes) {
      const ph = this.getDescendantsByLocalName(sp, 'ph')[0];
      const phType = ph?.getAttribute('type') ?? '';
      if (phType === 'sldNum' || phType === 'sldImg' || phType === 'hdr' || phType === 'ftr') {
        continue;
      }
      const txBody = this.getDirectChildrenByLocalName(sp, 'txBody')[0];
      if (!txBody) {
        continue;
      }
      const text = this.extractPlainTextFromTxBody(txBody);
      if (text) {
        parts.push(text);
      }
    }

    return parts.join(' ').trim();
  }

  private getDirectChildrenByLocalName(parent: Element, localName: string): Element[] {
    return Array.from(parent.children).filter((el) => el.localName === localName);
  }

  private getDescendantsByLocalName(root: Element | null, localName: string): Element[] {
    if (!root) {
      return [];
    }
    return Array.from(root.getElementsByTagName('*')).filter(
      (el) => el.localName === localName,
    );
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
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
