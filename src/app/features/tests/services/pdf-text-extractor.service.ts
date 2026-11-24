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

@Injectable({ providedIn: 'root' })
export class PdfTextExtractorService {
  private workerConfigured = false;

  async extractTextFromPdfFile(file: File): Promise<PdfExtractionResult> {
    const pdfjs = await import('pdfjs-dist');
    if (!this.workerConfigured) {
      pdfjs.GlobalWorkerOptions.workerSrc = '/assets/pdf.worker.min.mjs';
      this.workerConfigured = true;
    }

    const buffer = await file.arrayBuffer();
    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) });
    try {
      const pdf = await loadingTask.promise;

      const pageTexts: string[] = [];
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
        pageTexts.push(this.reconstructLinesFromTextItems(items));
      }

      return {
        text: pageTexts.join('\n\n'),
        pageCount: pdf.numPages,
      };
    } finally {
      await loadingTask.destroy();
    }
  }

  reconstructLinesFromTextItems(items: PdfTextItemLike[]): string {
    if (items.length === 0) {
      return '';
    }

    interface PositionedChunk {
      x: number;
      y: number;
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
      chunks.push({ x, y, text, hasEOL: Boolean(item.hasEOL) });
    }

    if (chunks.length === 0) {
      return '';
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
        return line.items
          .map((item) => item.text)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
      })
      .filter(Boolean)
      .join('\n');
  }
}
