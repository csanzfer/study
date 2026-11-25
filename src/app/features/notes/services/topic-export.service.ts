import { Injectable } from '@angular/core';
import { marked } from 'marked';
import { StudyBlock, Topic } from '../../../core/models/study.models';
import {
  TopicMarkdownExportOptions,
  buildBlockMarkdownDocument,
  buildTopicMarkdownDocument,
  sanitizeExportFilename,
} from '../../../shared/utils/tiptap-markdown.util';

@Injectable({ providedIn: 'root' })
export class TopicExportService {
  private activePrintFrame: HTMLIFrameElement | null = null;
  private activePrintCleanupTimer: ReturnType<typeof setTimeout> | null = null;
  downloadTopicMarkdown(
    topic: Topic,
    block?: StudyBlock,
    options: TopicMarkdownExportOptions = {},
  ): string {
    const markdown = buildTopicMarkdownDocument(topic, block, options);
    const filename = `${topic.blockId.toLowerCase()}-t${topic.order}-${sanitizeExportFilename(topic.title)}.md`;
    this.triggerDownload(markdown, filename, 'text/markdown;charset=utf-8');
    return filename;
  }

  async copyTopicMarkdown(
    topic: Topic,
    block?: StudyBlock,
    options: TopicMarkdownExportOptions = {},
  ): Promise<boolean> {
    const markdown = buildTopicMarkdownDocument(topic, block, options);
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(markdown);
      return true;
    }
    return false;
  }

  downloadBlockMarkdown(
    block: StudyBlock,
    topics: Topic[],
    options: TopicMarkdownExportOptions = {},
  ): string {
    const markdown = buildBlockMarkdownDocument(block, topics, options);
    const filename = `${block.id.toLowerCase()}-${sanitizeExportFilename(block.shortTitle || block.title)}.md`;
    this.triggerDownload(markdown, filename, 'text/markdown;charset=utf-8');
    return filename;
  }

  printTopicPdf(
    topic: Topic,
    block?: StudyBlock,
    options: TopicMarkdownExportOptions = {},
  ): void {
    const markdown = buildTopicMarkdownDocument(topic, block, options);
    const subtitle = block ? `${block.code} · ${block.title}` : topic.blockId;
    const html = this.buildPrintableHtml(topic.title, subtitle, markdown);
    this.openPrintFrame(html);
  }

  printBlockPdf(
    block: StudyBlock,
    topics: Topic[],
    options: TopicMarkdownExportOptions = {},
  ): void {
    const markdown = buildBlockMarkdownDocument(block, topics, options);
    const html = this.buildPrintableHtml(
      `${block.code} — ${block.title}`,
      `Cuaderno completo · ${topics.length} temas`,
      markdown,
    );
    this.openPrintFrame(html);
  }

  buildPrintableHtml(title: string, subtitle: string, markdown: string): string {
    const rawHtml = marked.parse(markdown, {
      async: false,
      gfm: true,
      breaks: false,
    }) as string;
    const sanitizedHtml = this.sanitizeRenderedHtml(rawHtml);
    const enhancedHtml = this.enhanceExamCallouts(sanitizedHtml);
    const exportedDate = new Date().toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${this.escapeHtml(title)} — crisisstudent</title>
  <style>
    @page {
      size: A4;
      margin: 18mm 16mm 20mm 16mm;
    }
    * {
      box-sizing: border-box;
    }
    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #0f172a;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.55;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .print-banner {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      border-bottom: 2px solid #0891b2;
      padding-bottom: 6px;
      margin-bottom: 18px;
      font-size: 9pt;
      color: #475569;
    }
    .print-banner strong {
      color: #0891b2;
      letter-spacing: 0.03em;
    }
    article h1 {
      font-size: 20pt;
      line-height: 1.2;
      margin: 0 0 10px 0;
      color: #0f172a;
      page-break-after: avoid;
      break-after: avoid;
    }
    article h2 {
      font-size: 14pt;
      line-height: 1.3;
      margin: 20px 0 8px 0;
      padding-bottom: 3px;
      border-bottom: 1px solid #e2e8f0;
      color: #1e293b;
      page-break-after: avoid;
      break-after: avoid;
    }
    article h3 {
      font-size: 12pt;
      margin: 14px 0 6px 0;
      color: #1e293b;
      page-break-after: avoid;
      break-after: avoid;
    }
    article h4 {
      font-size: 11pt;
      margin: 12px 0 4px 0;
      color: #334155;
    }
    article p {
      margin: 0 0 8px 0;
    }
    article ul, article ol {
      margin: 0 0 10px 0;
      padding-left: 20px;
    }
    article li {
      margin-bottom: 3px;
    }
    article hr {
      border: 0;
      border-top: 1px solid #cbd5e1;
      margin: 16px 0;
    }
    article code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 9.5pt;
      background: #f1f5f9;
      padding: 1px 4px;
      border-radius: 4px;
    }
    article pre {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 10px 12px;
      overflow-x: auto;
      font-size: 9pt;
      line-height: 1.45;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    article pre code {
      background: transparent;
      padding: 0;
    }
    article blockquote {
      margin: 12px 0;
      padding: 8px 12px;
      border-left: 3px solid #94a3b8;
      background: #f8fafc;
      color: #334155;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    article blockquote p:last-child {
      margin-bottom: 0;
    }
    article .exam-callout {
      margin: 12px 0;
      padding: 10px 14px;
      border: 1px solid #f59e0b;
      border-left: 4px solid #d97706;
      border-radius: 6px;
      background: #fffbeb;
      color: #78350f;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    article .exam-callout-title {
      font-weight: 700;
      font-size: 10pt;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #b45309;
      margin-bottom: 4px;
    }
    article table {
      width: 100%;
      border-collapse: collapse;
      margin: 12px 0;
      font-size: 9.5pt;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    article th, article td {
      border: 1px solid #cbd5e1;
      padding: 6px 8px;
      text-align: left;
      vertical-align: top;
    }
    article th {
      background: #f1f5f9;
      font-weight: 600;
      color: #0f172a;
    }
  </style>
</head>
<body>
  <div class="print-banner">
    <span><strong><span style="color:#0891b2">cris</span><span style="color:#22d3ee">is</span><span style="color:#0f172a">student</span></strong> · ${this.escapeHtml(subtitle)}</span>
    <span>Exportado el ${exportedDate}</span>
  </div>
  <article>
    ${enhancedHtml}
  </article>
</body>
</html>`;
  }

  private sanitizeRenderedHtml(html: string): string {
    if (typeof DOMParser === 'undefined') {
      return html
        .replace(/<(script|style|iframe|object|embed|form)\b[\s\S]*?<\/\1>/gi, '')
        .replace(/<(script|style|iframe|object|embed|form|base|meta|link)\b[^>]*\/?>/gi, '');
    }

    const doc = new DOMParser().parseFromString(html, 'text/html');
    const forbiddenTags = 'script, style, iframe, object, embed, form, base, meta, link';
    doc.body.querySelectorAll(forbiddenTags).forEach((el) => el.remove());

    const dangerousUrlPattern = /^\s*(?:javascript|vbscript|data\s*:\s*text\/html)/i;
    doc.body.querySelectorAll('*').forEach((el) => {
      for (const attr of Array.from(el.attributes)) {
        const name = attr.name.toLowerCase();
        if (name.startsWith('on') || name === 'srcdoc') {
          el.removeAttribute(attr.name);
          continue;
        }
        if (
          (name === 'href' || name === 'src' || name === 'xlink:href' || name === 'formaction') &&
          dangerousUrlPattern.test(attr.value.replace(/[\u0000-\u001f]+/g, ''))
        ) {
          el.removeAttribute(attr.name);
        }
      }
    });

    return doc.body.innerHTML;
  }

  private enhanceExamCallouts(html: string): string {
    return html.replace(
      /<blockquote>\s*<p>\[!IMPORTANT\](?:<br\s*\/?>|\s)*<strong>Ojo examen<\/strong><\/p>([\s\S]*?)<\/blockquote>/gi,
      (_match, inner: string) =>
        `<div class="exam-callout"><div class="exam-callout-title">⚠ Ojo examen</div>${inner.trim()}</div>`,
    );
  }

  private triggerDownload(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  private openPrintFrame(html: string): void {
    this.cleanupActivePrintFrame();

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.setAttribute('aria-hidden', 'true');

    document.body.appendChild(iframe);
    this.activePrintFrame = iframe;

    const cleanup = () => {
      if (this.activePrintFrame === iframe) {
        this.cleanupActivePrintFrame();
      } else if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
    };

    const doc = iframe.contentDocument;
    const win = iframe.contentWindow;
    if (!doc || !win) {
      cleanup();
      return;
    }

    doc.open();
    doc.write(html);
    doc.close();

    let printed = false;
    const runPrint = () => {
      if (printed || this.activePrintFrame !== iframe) return;
      printed = true;
      win.focus();
      win.print();
      this.activePrintCleanupTimer = setTimeout(cleanup, 60_000);
    };

    win.addEventListener('afterprint', cleanup, { once: true });
    setTimeout(runPrint, 120);
  }

  private cleanupActivePrintFrame(): void {
    if (this.activePrintCleanupTimer !== null) {
      clearTimeout(this.activePrintCleanupTimer);
      this.activePrintCleanupTimer = null;
    }
    if (this.activePrintFrame?.parentNode) {
      this.activePrintFrame.parentNode.removeChild(this.activePrintFrame);
    }
    this.activePrintFrame = null;
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
