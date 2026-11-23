import { describe, expect, it } from 'vitest';
import { tiptapJsonToOutlineMarkdown } from './tiptap-outline.util';

describe('tiptapJsonToOutlineMarkdown', () => {
  it('returns empty non-structured result for null, empty, or paragraph-only docs', () => {
    expect(tiptapJsonToOutlineMarkdown(null)).toEqual({
      markdown: '',
      hasStructure: false,
      headingCount: 0,
      itemCount: 0,
    });

    expect(
      tiptapJsonToOutlineMarkdown({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Solo texto plano sin títulos ni listas.' }],
          },
        ],
      }),
    ).toEqual({
      markdown: '',
      hasStructure: false,
      headingCount: 0,
      itemCount: 0,
    });
  });

  it('extracts H1-H4 headings, nested lists, checklists, and exam callouts in full mode', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Constitución Española 1978' }],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Estructura' }],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    { type: 'text', text: '169 artículos', marks: [{ type: 'bold' }] },
                    { type: 'text', text: ' en total' },
                  ],
                },
                {
                  type: 'bulletList',
                  content: [
                    {
                      type: 'listItem',
                      content: [
                        {
                          type: 'paragraph',
                          content: [{ type: 'text', text: 'Título Preliminar (arts. 1-9)' }],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          type: 'heading',
          attrs: { level: 3 },
          content: [{ type: 'text', text: 'Repaso rápido' }],
        },
        {
          type: 'taskList',
          content: [
            {
              type: 'taskItem',
              attrs: { checked: true },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Derechos fundamentales' }] }],
            },
            {
              type: 'taskItem',
              attrs: { checked: false },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Reforma constitucional' }] }],
            },
          ],
        },
        {
          type: 'examCallout',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'El art. 14 no está en la Sección 1ª pero sí tiene amparo.' }],
            },
          ],
        },
      ],
    };

    const result = tiptapJsonToOutlineMarkdown(doc, {
      depth: 'full',
      rootTitle: 'Constitución Española 1978',
    });

    expect(result.hasStructure).toBe(true);
    expect(result.headingCount).toBe(3);
    expect(result.itemCount).toBe(5);
    expect(result.markdown).toBe(
      [
        '# Constitución Española 1978',
        '## Estructura',
        '- **169 artículos** en total',
        '  - Título Preliminar (arts. 1-9)',
        '### Repaso rápido',
        '- ☑ Derechos fundamentales',
        '- ☐ Reforma constitucional',
        '- ⚠️ El art. 14 no está en la Sección 1ª pero sí tiene amparo.',
      ].join('\n'),
    );
  });

  it('respects depth modes headings-h2, headings-h3, and headings-all', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Tema 1' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Sección A' }] },
        { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Subsección A.1' }] },
        { type: 'heading', attrs: { level: 4 }, content: [{ type: 'text', text: 'Detalle A.1.1' }] },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Viñeta' }] }],
            },
          ],
        },
      ],
    };

    const h2 = tiptapJsonToOutlineMarkdown(doc, { depth: 'headings-h2' });
    expect(h2.markdown).toBe('# Tema 1\n## Sección A');
    expect(h2.headingCount).toBe(2);
    expect(h2.itemCount).toBe(0);

    const h3 = tiptapJsonToOutlineMarkdown(doc, { depth: 'headings-h3' });
    expect(h3.markdown).toBe('# Tema 1\n## Sección A\n### Subsección A.1');

    const allHeadings = tiptapJsonToOutlineMarkdown(doc, { depth: 'headings-all' });
    expect(allHeadings.markdown).toBe('# Tema 1\n## Sección A\n### Subsección A.1\n#### Detalle A.1.1');
  });

  it('adds synthetic rootTitle when document starts at H2 or has multiple H1 headings', () => {
    const h2OnlyDoc = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Plazos' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Recursos' }] },
      ],
    };

    const h2Result = tiptapJsonToOutlineMarkdown(h2OnlyDoc, {
      depth: 'full',
      rootTitle: 'Ley 39/2015',
    });
    expect(h2Result.markdown).toBe('# Ley 39/2015\n## Plazos\n## Recursos');

    const multiH1Doc = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Parte 1' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Detalle' }] },
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Parte 2' }] },
      ],
    };

    const multiH1Result = tiptapJsonToOutlineMarkdown(multiH1Doc, {
      depth: 'full',
      rootTitle: 'Redes TCP/IP',
    });
    expect(multiH1Result.markdown).toBe('# Redes TCP/IP\n## Parte 1\n### Detalle\n## Parte 2');
  });
});
