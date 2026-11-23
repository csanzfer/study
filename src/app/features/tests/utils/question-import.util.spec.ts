import {
  IMPORT_SAMPLE_TEMPLATES,
  parseQuestionsFromCsv,
  parseQuestionsFromJson,
  parseQuestionsFromText,
} from './question-import.util';

describe('question-import.util', () => {
  const defaults = { defaultBlockId: 'B1' as const };

  it('should parse formatted INAP text including starred options and metadata', () => {
    const res = parseQuestionsFromText(IMPORT_SAMPLE_TEMPLATES.text, defaults);
    expect(res.errors).toEqual([]);
    expect(res.valid.length).toBe(2);
    expect(res.valid[0].correctIndex).toBe(1);
    expect(res.valid[0].reference).toBe('Art. 21.3 Ley 39/2015');
    expect(res.valid[1].blockId).toBe('B4');
    expect(res.valid[1].correctIndex).toBe(2);
  });

  it('should report errors for incomplete text blocks without failing valid ones', () => {
    const raw = `1. Pregunta válida
a) Uno
b) Dos
c) Tres
d) Cuatro
Respuesta: A

2. Pregunta sin respuesta correcta
a) Uno
b) Dos
c) Tres
d) Cuatro`;

    const res = parseQuestionsFromText(raw, defaults);
    expect(res.valid.length).toBe(1);
    expect(res.errors.length).toBe(1);
    expect(res.errors[0].entryIndex).toBe(2);
  });

  it('should parse CSV with comma or semicolon delimiters and quoted commas', () => {
    const res = parseQuestionsFromCsv(IMPORT_SAMPLE_TEMPLATES.csv, defaults);
    expect(res.errors).toEqual([]);
    expect(res.valid.length).toBe(2);
    expect(res.valid[0].blockId).toBe('B1');
    expect(res.valid[0].correctIndex).toBe(1);
    expect(res.valid[0].tags).toEqual(['leyes', 'ce']);
    expect(res.valid[1].blockId).toBe('B3');

    const semi = `bloque;enunciado;a;b;c;d;correcta\nB4;"Puerto SSH, estándar";21;22;23;25;B`;
    const resSemi = parseQuestionsFromCsv(semi, defaults);
    expect(resSemi.errors).toEqual([]);
    expect(resSemi.valid[0].prompt).toBe('Puerto SSH, estándar');
    expect(resSemi.valid[0].correctIndex).toBe(1);
  });

  it('should parse JSON array and validate malformed entries', () => {
    const res = parseQuestionsFromJson(IMPORT_SAMPLE_TEMPLATES.json, defaults);
    expect(res.errors).toEqual([]);
    expect(res.valid.length).toBe(1);
    expect(res.valid[0].blockId).toBe('B2');
    expect(res.valid[0].correctIndex).toBe(2);

    const invalid = parseQuestionsFromJson('[{"prompt":"Solo 2 opciones","options":["a","b"],"correctIndex":0}]', defaults);
    expect(invalid.valid.length).toBe(0);
    expect(invalid.errors.length).toBe(1);
  });
});
