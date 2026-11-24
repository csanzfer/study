import { describe, expect, it } from 'vitest';
import {
  applyInapAnswerKey,
  cleanInapPdfText,
  inferInapMetadataFromFilename,
  normalizePromptForDuplicateCheck,
  parseInapAnswerKeyText,
  parseInapQuestionnaireText,
} from './inap-pdf-parser.util';

const SAMPLE_INAP_CUESTIONARIO = `
PROCESO SELECTIVO PARA INGRESO EN EL CUERPO DE TÉCNICOS AUXILIARES DE INFORMÁTICA
MODELO A
Página 1 de 12

1. Según el artículo 21 de la Ley 39/2015, cuando las normas reguladoras de los procedimientos
no fijen el plazo máximo para resolver, este será de:
a) Un mes.
b) Tres meses.
c) Seis meses.
d) Quince días hábiles.

2. ¿Qué protocolo opera en la capa de transporte del modelo TCP/IP y no garantiza
la entrega ordenada de paquetes?
a) TCP
b) UDP
c) HTTP
d) ICMP

PREGUNTAS DE RESERVA
R1. ¿Cuál es el puerto por defecto del servicio SSH?
a) 21
b) 22
c) 23
d) 25
`;

const SAMPLE_INAP_PLANTILLA = `
COMISIÓN PERMANENTE DE SELECCIÓN
PLANTILLA DEFINITIVA DE RESPUESTAS
1 B   2 ANULADA   R1 B
`;

const SAMPLE_INAP_SUPUESTO = `
SUPUESTO PRÁCTICO I — DESARROLLO DE SISTEMAS
Un ministerio necesita migrar su aplicación monolítica de gestión de expedientes a una arquitectura
de microservicios con base de datos PostgreSQL y autenticación mediante OAuth 2.0.

1. ¿Qué flujo de OAuth 2.0 es el recomendado para una SPA en navegador?
a) Implicit Grant
b) Authorization Code con PKCE
c) Resource Owner Password
d) Client Credentials

2. ¿Qué índice de PostgreSQL resulta más eficiente para búsquedas en columnas JSONB?
a) B-Tree
b) GIN
c) BRIN
d) Hash
`;

describe('inap-pdf-parser.util', () => {
  it('cleans headers, page numbers and hyphenated line breaks', () => {
    const cleaned = cleanInapPdfText(
      'Página 1 de 10\nMODELO A\nLa Adminis-\ntración pública\n---',
    );
    expect(cleaned).toBe('La Administración pública');
  });

  it('parses standard INAP questions including multiline prompts and reserve items', () => {
    const result = parseInapQuestionnaireText(SAMPLE_INAP_CUESTIONARIO, {
      defaultBlockId: 'B1',
    });

    expect(result.warnings).toHaveLength(0);
    expect(result.questions).toHaveLength(3);

    expect(result.questions[0].numberLabel).toBe('1');
    expect(result.questions[0].prompt).toContain('artículo 21 de la Ley 39/2015');
    expect(result.questions[0].options).toEqual([
      'Un mes.',
      'Tres meses.',
      'Seis meses.',
      'Quince días hábiles.',
    ]);

    expect(result.questions[2].numberLabel).toBe('R1');
    expect(result.questions[2].isReserve).toBe(true);
    expect(result.questions[2].options[1]).toBe('22');
  });

  it('parses INAP answer key tables and merges answers and annulled questions', () => {
    const parsed = parseInapQuestionnaireText(SAMPLE_INAP_CUESTIONARIO);
    const key = parseInapAnswerKeyText(SAMPLE_INAP_PLANTILLA);

    expect(key.get('1')).toBe(1);
    expect(key.get('2')).toBe('ANULADA');
    expect(key.get('R1')).toBe(1);

    const merged = applyInapAnswerKey(parsed.questions, key);
    expect(merged.matchedCount).toBe(3);
    expect(merged.annulledCount).toBe(1);

    expect(merged.questions[0].correctIndex).toBe(1);
    expect(merged.questions[0].selected).toBe(true);

    expect(merged.questions[1].isAnnulled).toBe(true);
    expect(merged.questions[1].correctIndex).toBeNull();
    expect(merged.questions[1].selected).toBe(false);

    expect(merged.questions[2].correctIndex).toBe(1);
  });

  it('extracts case study statement and linked questions in case_study mode', () => {
    const result = parseInapQuestionnaireText(SAMPLE_INAP_SUPUESTO, {
      defaultBlockId: 'B3',
      mode: 'case_study',
    });

    expect(result.caseStudyStatement).toContain('arquitectura de microservicios');
    expect(result.questions).toHaveLength(2);
    expect(result.questions[0].blockId).toBe('B3');
    expect(result.questions[1].options[1]).toBe('GIN');
  });

  it('infers source and tags from PDF filename and normalizes duplicate prompts', () => {
    const meta = inferInapMetadataFromFilename('TAI_2024_Libre_Cuestionario.pdf');
    expect(meta.source).toContain('2024');
    expect(meta.tags).toEqual(expect.arrayContaining(['inap', '2024', 'libre']));

    expect(normalizePromptForDuplicateCheck('¿Qué es la Constitución Española?')).toBe(
      normalizePromptForDuplicateCheck('Que es la Constitucion Espanola'),
    );
  });

  it('normalizes R.1 / Reserva 01 keys and ignores Spanish preposition "a" in headers', () => {
    const key = parseInapAnswerKeyText(
      'Primera parte (preguntas 1 a 80)\n1 B  R.1 C  Reserva 02: d  10 a 12 horas',
    );

    expect(key.get('1')).toBe(1);
    expect(key.get('R1')).toBe(2);
    expect(key.get('R2')).toBe(3);
    expect(key.has('10')).toBe(false);
    expect(key.has('R0.1')).toBe(false);
  });

  it('does not assign regular question 1 answer to reserve question R1 when R1 is missing', () => {
    const parsed = parseInapQuestionnaireText(SAMPLE_INAP_CUESTIONARIO);
    const keyWithoutReserve = parseInapAnswerKeyText('1 B  2 C');

    const merged = applyInapAnswerKey(parsed.questions, keyWithoutReserve);
    expect(merged.questions[0].correctIndex).toBe(1);
    expect(merged.questions[2].numberLabel).toBe('R1');
    expect(merged.questions[2].correctIndex).toBeNull();
    expect(merged.questions[2].warnings.some((w) => w.includes('Sin respuesta'))).toBe(true);
  });
});
