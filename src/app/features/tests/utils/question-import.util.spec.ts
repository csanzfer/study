import { StudyBlock } from '../../../core/models/study.models';
import {
  IMPORT_SAMPLE_TEMPLATES,
  parseQuestionsFromCsv,
  parseQuestionsFromJson,
  parseQuestionsFromText,
} from './question-import.util';

const SAMPLE_BLOCKS: StudyBlock[] = [
  {
    id: 'block-net',
    code: 'RED',
    title: 'Redes y Comunicaciones',
    shortTitle: 'Redes',
    description: '',
    color: '#059669',
    icon: 'lan',
    order: 1,
  },
  {
    id: 'block-hist',
    code: 'HIST',
    title: 'Historia Contemporánea',
    shortTitle: 'Historia',
    description: '',
    color: '#7c3aed',
    icon: 'history_edu',
    order: 2,
  },
];

describe('question-import.util', () => {
  const defaults = { defaultBlockId: 'block-net', blocks: SAMPLE_BLOCKS };

  it('should parse formatted text including starred options and metadata', () => {
    const res = parseQuestionsFromText(IMPORT_SAMPLE_TEMPLATES.text, defaults);
    expect(res.errors).toEqual([]);
    expect(res.valid.length).toBe(2);
    expect(res.valid[0].blockId).toBe('block-net');
    expect(res.valid[0].correctIndex).toBe(1);
    expect(res.valid[0].reference).toBe('RFC 2818 / IANA');
    expect(res.valid[1].correctIndex).toBe(1);
  });

  it('should resolve dynamic blocks by id, code, or normalized title with fallback', () => {
    const raw = JSON.stringify([
      {
        blockId: 'hist',
        prompt: 'Por código',
        options: ['A', 'B', 'C', 'D'],
        correctIndex: 0,
      },
      {
        bloque: 'Historia Contemporanea',
        prompt: 'Por título sin tilde',
        options: ['A', 'B', 'C', 'D'],
        correctIndex: 1,
      },
      {
        block: 'inexistente',
        prompt: 'Fallback al bloque por defecto',
        options: ['A', 'B', 'C', 'D'],
        correctIndex: 2,
      },
    ]);

    const res = parseQuestionsFromJson(raw, defaults);
    expect(res.errors).toEqual([]);
    expect(res.valid.map((q) => q.blockId)).toEqual(['block-hist', 'block-hist', 'block-net']);
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
    expect(res.valid[0].blockId).toBe('block-net');
    expect(res.valid[0].correctIndex).toBe(1);
    expect(res.valid[0].tags).toEqual(['sql', 'bbdd']);
    expect(res.valid[1].correctIndex).toBe(2);

    const semi = `bloque;enunciado;a;b;c;d;correcta\nHIST;"Puerto SSH, estándar";21;22;23;25;B`;
    const resSemi = parseQuestionsFromCsv(semi, defaults);
    expect(resSemi.errors).toEqual([]);
    expect(resSemi.valid[0].blockId).toBe('block-hist');
    expect(resSemi.valid[0].prompt).toBe('Puerto SSH, estándar');
    expect(resSemi.valid[0].correctIndex).toBe(1);
  });

  it('should parse JSON array and validate malformed entries', () => {
    const res = parseQuestionsFromJson(IMPORT_SAMPLE_TEMPLATES.json, defaults);
    expect(res.errors).toEqual([]);
    expect(res.valid.length).toBe(1);
    expect(res.valid[0].blockId).toBe('block-net');
    expect(res.valid[0].correctIndex).toBe(2);

    const invalid = parseQuestionsFromJson(
      '[{"prompt":"Solo 2 opciones","options":["a","b"],"correctIndex":0}]',
      defaults,
    );
    expect(invalid.valid.length).toBe(0);
    expect(invalid.errors.length).toBe(1);
  });
});
