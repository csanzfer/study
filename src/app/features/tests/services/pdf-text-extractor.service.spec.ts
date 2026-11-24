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
});
