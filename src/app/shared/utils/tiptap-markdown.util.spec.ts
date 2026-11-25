import { describe, expect, it } from 'vitest';
import { TaiBlock, Topic } from '../../core/models/study.models';
import {
  buildBlockMarkdownDocument,
  buildTopicMarkdownDocument,
  sanitizeExportFilename,
  tiptapJsonToMarkdown,
} from './tiptap-markdown.util';

const sampleBlock: TaiBlock = {
  id: 'B1',
  code: 'Bloque I',
  title: 'Organización del Estado y Administración Electrónica',
  shortTitle: 'Org. Estado',
  description: 'Constitución, leyes 39/2015 y 40/2015.',
  color: '#2563eb',
  icon: 'account_balance',
  order: 1,
};

function makeTopic(overrides: Partial<Topic> = {}): Topic {
  return {
    id: 'topic-1',
    blockId: 'B1',
    order: 1,
    title: 'Ley 39/2015 LPACAP',
    status: 'outlined',
    roundCount: 2,
    tags: ['leyes', 'plazos'],
    contentJson: {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Plazos clave' }],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Recurso de alzada: ' },
            { type: 'text', text: '1 mes', marks: [{ type: 'bold' }] },
            { type: 'text', text: ' si el acto es expreso.' },
          ],
        },
      ],
    },
    plainText: 'Plazos clave Recurso de alzada: 1 mes si el acto es expreso.',
    createdAt: '2026-01-10T10:00:00.000Z',
    updatedAt: '2026-02-15T12:00:00.000Z',
    ...overrides,
  };
}

describe('tiptap-markdown.util', () => {
  it('returns empty string for null or empty doc', () => {
    expect(tiptapJsonToMarkdown(null)).toBe('');
    expect(tiptapJsonToMarkdown({ type: 'doc', content: [] })).toBe('');
  });

  it('serializes headings, inline marks, code blocks, lists and task lists', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Tema 1' }],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Texto ' },
            { type: 'text', text: 'negrita', marks: [{ type: 'bold' }] },
            { type: 'text', text: ', ' },
            { type: 'text', text: 'cursiva', marks: [{ type: 'italic' }] },
            { type: 'text', text: ', ' },
            { type: 'text', text: 'subrayado', marks: [{ type: 'underline' }] },
            { type: 'text', text: ' y ' },
            { type: 'text', text: 'SELECT 1', marks: [{ type: 'code' }] },
          ],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                { type: 'paragraph', content: [{ type: 'text', text: 'Elemento A' }] },
                {
                  type: 'orderedList',
                  content: [
                    {
                      type: 'listItem',
                      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Sub 1' }] }],
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          type: 'taskList',
          content: [
            {
              type: 'taskItem',
              attrs: { checked: true },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Repasado' }] }],
            },
            {
              type: 'taskItem',
              attrs: { checked: false },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Pendiente' }] }],
            },
          ],
        },
        {
          type: 'codeBlock',
          attrs: { language: 'sql' },
          content: [{ type: 'text', text: 'SELECT * FROM oposiciones;' }],
        },
      ],
    };

    const md = tiptapJsonToMarkdown(doc);
    expect(md).toContain('# Tema 1');
    expect(md).toContain('Texto **negrita**, *cursiva*, <u>subrayado</u> y `SELECT 1`');
    expect(md).toContain('- Elemento A\n  1. Sub 1');
    expect(md).toContain('- [x] Repasado\n- [ ] Pendiente');
    expect(md).toContain('```sql\nSELECT * FROM oposiciones;\n```');
  });

  it('serializes tables and escapes pipe characters inside cells', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Protocolo' }] }] },
                { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Puerto' }] }] },
              ],
            },
            {
              type: 'tableRow',
              content: [
                { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'HTTP | TLS' }] }] },
                { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: '80 / 443' }] }] },
              ],
            },
          ],
        },
      ],
    };

    const md = tiptapJsonToMarkdown(doc);
    expect(md).toBe(
      '| Protocolo | Puerto |\n| --- | --- |\n| HTTP \\| TLS | 80 / 443 |',
    );
  });

  it('serializes examCallout nodes as GFM IMPORTANT callouts', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'examCallout',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'El plazo de subsanación es de 10 días hábiles.' }],
            },
          ],
        },
      ],
    };

    const md = tiptapJsonToMarkdown(doc);
    expect(md).toContain('> [!IMPORTANT]');
    expect(md).toContain('> **Ojo examen**');
    expect(md).toContain('> El plazo de subsanación es de 10 días hábiles.');
  });

  it('builds complete topic markdown with metadata and custom outline', () => {
    const topic = makeTopic({
      customOutlineMd: '# Resumen\n- Alzada: 1 mes',
    });

    const md = buildTopicMarkdownDocument(topic, sampleBlock);
    expect(md).toContain('# Ley 39/2015 LPACAP');
    expect(md).toContain('**Bloque:** Bloque I — Organización del Estado y Administración Electrónica');
    expect(md).toContain('**Etiquetas:** `#leyes` `#plazos`');
    expect(md).toContain('## Plazos clave');
    expect(md).toContain('## Esquema resumido');
    expect(md).toContain('- Alzada: 1 mes');
  });

  it('builds a compiled block markdown notebook with TOC and shifted headings', () => {
    const t1 = makeTopic({ id: 't1', order: 1, title: 'Constitución Española' });
    const t2 = makeTopic({ id: 't2', order: 2, title: 'Ley 39/2015' });

    const md = buildBlockMarkdownDocument(sampleBlock, [t2, t1]);
    expect(md).toContain('# Bloque I — Organización del Estado y Administración Electrónica');
    expect(md).toContain('## Índice de temas');
    expect(md).toContain('1. **Constitución Española**');
    expect(md).toContain('2. **Ley 39/2015**');
    expect(md).toContain('## Constitución Española');
  });

  it('sanitizes filenames removing accents and unsafe characters', () => {
    expect(sanitizeExportFilename('Tema 1: Constitución Española (1978)')).toBe(
      'tema-1-constitucion-espanola-1978',
    );
    expect(sanitizeExportFilename('   ')).toBe('apunte');
  });
});
