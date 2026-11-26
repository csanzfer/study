import { Injectable } from '@angular/core';

export interface PdfTextItemLike {
  str: string;
  transform?: number[];
  hasEOL?: boolean;
}

export interface PdfExtractionResult {
  text: string;
  pageCount: number;
}

export interface PdfStructuredLine {
  text: string;
  fontSize: number;
  y: number;
}

export interface PdfStructuredPage {
  pageNumber: number;
  lines: PdfStructuredLine[];
}

export interface PdfStructuredExtractionResult {
  pages: PdfStructuredPage[];
  pageCount: number;
}

@Injectable({ providedIn: 'root' })
export class PdfTextExtractorService {
  private workerConfigured = false;

  async extractTextFromPdfFile(file: File): Promise<PdfExtractionResult> {
    const structured = await this.extractStructuredPagesFromPdfFile(file);
    return {
      text: structured.pages
        .map((page) => page.lines.map((line) => line.text).join('\n'))
        .join('\n\n'),
      pageCount: structured.pageCount,
    };
  }

  async extractStructuredPagesFromPdfFile(
    file: File,
  ): Promise<PdfStructuredExtractionResult> {
    const pdfjs = await import('pdfjs-dist');
    if (!this.workerConfigured) {
      pdfjs.GlobalWorkerOptions.workerSrc =
        typeof document !== 'undefined' && document.baseURI
          ? new URL('assets/pdf.worker.min.mjs', document.baseURI).toString()
          : '/assets/pdf.worker.min.mjs';
      this.workerConfigured = true;
    }

    const buffer = await file.arrayBuffer();
    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) });
    try {
      const pdf = await loadingTask.promise;

      const pages: PdfStructuredPage[] = [];
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        const items: PdfTextItemLike[] = [];
        for (const item of content.items) {
          if ('str' in item && typeof item.str === 'string') {
            items.push({
              str: item.str,
              transform: item.transform,
              hasEOL: item.hasEOL,
            });
          }
        }
        pages.push({
          pageNumber,
          lines: this.reconstructStructuredLinesFromTextItems(items),
        });
      }

      return {
        pages,
        pageCount: pdf.numPages,
      };
    } finally {
      await loadingTask.destroy();
    }
  }

  reconstructLinesFromTextItems(items: PdfTextItemLike[]): string {
    return this.reconstructStructuredLinesFromTextItems(items)
      .map((line) => line.text)
      .join('\n');
  }

  reconstructStructuredLinesFromTextItems(items: PdfTextItemLike[]): PdfStructuredLine[] {
    if (items.length === 0) {
      return [];
    }

    interface PositionedChunk {
      x: number;
      y: number;
      fontSize: number;
      text: string;
      hasEOL: boolean;
    }

    const chunks: PositionedChunk[] = [];
    for (const item of items) {
      const text = item.str;
      if (!text && !item.hasEOL) {
        continue;
      }
      const x = typeof item.transform?.[4] === 'number' ? item.transform[4] : 0;
      const y = typeof item.transform?.[5] === 'number' ? item.transform[5] : 0;
      const scaleX = typeof item.transform?.[0] === 'number' ? item.transform[0] : 0;
      const skewY = typeof item.transform?.[1] === 'number' ? item.transform[1] : 0;
      const scaleY = typeof item.transform?.[3] === 'number' ? item.transform[3] : 0;
      const fontSize = Math.hypot(scaleX, skewY) || Math.abs(scaleY) || 0;
      chunks.push({ x, y, fontSize, text, hasEOL: Boolean(item.hasEOL) });
    }

    if (chunks.length === 0) {
      return [];
    }

    // Group chunks into visual lines using a Y tolerance of 3pt.
    const lines: Array<{ y: number; items: PositionedChunk[] }> = [];
    const Y_TOLERANCE = 3;

    for (const chunk of chunks) {
      const existingLine = lines.find((line) => Math.abs(line.y - chunk.y) <= Y_TOLERANCE);
      if (existingLine) {
        existingLine.items.push(chunk);
      } else {
        lines.push({ y: chunk.y, items: [chunk] });
      }
    }

    // PDF coordinates grow upwards: sort top-to-bottom (higher Y first).
    lines.sort((a, b) => b.y - a.y);

    return lines
      .map((line) => {
        line.items.sort((a, b) => a.x - b.x);
        const text = line.items
          .map((item) => item.text)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
        const fontSize = line.items.reduce(
          (maxSize, item) => (item.text.trim() ? Math.max(maxSize, item.fontSize) : maxSize),
          0,
        );
        return { text, fontSize, y: line.y };
      })
      .filter((line) => Boolean(line.text));
  }
}
