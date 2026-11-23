import { describe, expect, it } from 'vitest';
import { Topic } from '../../../core/models/study.models';
import {
  extractFlashcardsFromTopic,
  parseFlashcardsBatch,
  parseSelectedTextToFlashcardDraft,
} from './flashcard-import.util';

describe('flashcard-import.util', () => {
  it('parses :: and JSON batches while deduplicating fronts', () => {
    const raw = `
      # Comentario
      DNS :: Domain Name System :: Puerto 53 :: siglas, puertos
      DNS :: Duplicada
      HTTP :: HyperText Transfer Protocol :: Puerto 80
    `;
    const result = parseFlashcardsBatch(raw, { blockId: 'B4', tags: ['redes'] });
    expect(result.items.length).toBe(2);
    expect(result.skippedDuplicates).toBe(1);
    expect(result.items[0].tags).toEqual(['redes', 'siglas', 'puertos']);
    expect(result.items[0].hint).toBe('Puerto 53');
  });

  it('detects acronym patterns from TipTap text selections', () => {
    const acr = parseSelectedTextToFlashcardDraft('ENS (Esquema Nacional de Seguridad)');
    expect(acr).toEqual({
      front: 'ENS',
      back: 'Esquema Nacional de Seguridad',
      isAcronym: true,
    });

    const def = parseSelectedTextToFlashcardDraft('Plazo recurso alzada: 1 mes si es expreso');
    expect(def.front).toBe('Plazo recurso alzada');
    expect(def.back).toBe('1 mes si es expreso');
    expect(def.isAcronym).toBe(false);
  });

  it('extracts acronyms, exam callouts, and table rows from a topic', () => {
    const topic: Topic = {
      id: 't-1',
      blockId: 'B4',
      order: 1,
      title: 'Protocolos de Red',
      status: 'first_round',
      roundCount: 0,
      tags: ['redes'],
      plainText: 'El protocolo DHCP (Dynamic Host Configuration Protocol) asigna IPs.',
      contentJson: {
        type: 'doc',
        content: [
          {
            type: 'examCallout',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'SSH: Puerto 22 TCP cifrado' }],
              },
            ],
          },
          {
            type: 'table',
            content: [
              {
                type: 'tableRow',
                content: [
                  { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Sigla' }] }] },
                  { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Significado' }] }] },
                ],
              },
              {
                type: 'tableRow',
                content: [
                  { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'BGP' }] }] },
                  { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Border Gateway Protocol' }] }] },
                ],
              },
            ],
          },
        ],
      },
      createdAt: '2026-11-23T10:00:00.000Z',
      updatedAt: '2026-11-23T10:00:00.000Z',
    };

    const extracted = extractFlashcardsFromTopic(topic);
    expect(extracted.map((c) => c.front)).toEqual(['DHCP', 'SSH', 'BGP']);
    expect(extracted[0].tags).toContain('siglas');
    expect(extracted[1].tags).toContain('ojo-examen');
    expect(extracted[2].tags).toContain('siglas');
  });
});
