import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { PdfTextExtractorService } from './pdf-text-extractor.service';

describe('PdfTextExtractorService', () => {
  it('reconstructs visual lines top-to-bottom and left-to-right from PDF coordinates', () => {
    TestBed.configureTestingModule({});
    const service = TestBed.inject(PdfTextExtractorService);

    const text = service.reconstructLinesFromTextItems([
      { str: 'b) Tres meses.', transform: [1, 0, 0, 1, 50, 700] },
      { str: 'de la Ley 39/2015', transform: [1, 0, 0, 1, 140, 760] },
      { str: '1. Según el art. 21', transform: [1, 0, 0, 1, 50, 760] },
      { str: 'a) Un mes.', transform: [1, 0, 0, 1, 50, 730] },
    ]);

    expect(text).toBe('1. Según el art. 21 de la Ley 39/2015\na) Un mes.\nb) Tres meses.');
  });

  it('returns empty string for empty items list', () => {
    TestBed.configureTestingModule({});
    const service = TestBed.inject(PdfTextExtractorService);

    expect(service.reconstructLinesFromTextItems([])).toBe('');
  });

  it('reconstructs structured lines with font size and Y coordinate', () => {
    TestBed.configureTestingModule({});
    const service = TestBed.inject(PdfTextExtractorService);

    const lines = service.reconstructStructuredLinesFromTextItems([
      { str: 'Título principal', transform: [18, 0, 0, 18, 50, 780] },
      { str: '   ', transform: [24, 0, 0, 24, 200, 780] },
      { str: 'Párrafo rotado', transform: [6, 8, -8, 6, 50, 720] },
      { str: 'continuación', transform: [12, 0, 0, 12, 160, 721] },
    ]);

    expect(lines).toEqual([
      { text: 'Título principal', fontSize: 18, y: 780 },
      { text: 'Párrafo rotado continuación', fontSize: 12, y: 720 },
    ]);
  });
});
