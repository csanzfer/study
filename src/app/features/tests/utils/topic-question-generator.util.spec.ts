import { Topic } from '../../../core/models/study.models';
import {
  buildAiPromptForTopic,
  generateQuestionsFromTopic,
  stripMarkdownCodeFence,
} from './topic-question-generator.util';

const sampleTopic: Topic = {
  id: 'topic-1',
  blockId: 'B1',
  order: 1,
  title: 'Ley 39/2015 y Puertos',
  status: 'outlined',
  roundCount: 1,
  tags: ['leyes', 'plazos'],
  plainText: '',
  createdAt: '2026-11-23T00:00:00.000Z',
  updatedAt: '2026-11-23T00:00:00.000Z',
  contentJson: {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Plazos clave' }] },
      {
        type: 'examCallout',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'El plazo máximo general para resolver cuando la norma no fija plazo es de 3 meses.',
              },
            ],
          },
        ],
      },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Tabla de puertos' }] },
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
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'SSH' }] }] },
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: '22' }] }] },
            ],
          },
          {
            type: 'tableRow',
            content: [
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'HTTP' }] }] },
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: '80' }] }] },
            ],
          },
          {
            type: 'tableRow',
            content: [
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'HTTPS' }] }] },
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: '443' }] }] },
            ],
          },
          {
            type: 'tableRow',
            content: [
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'DNS' }] }] },
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: '53' }] }] },
            ],
          },
        ],
      },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Conceptos' }] },
      {
        type: 'bulletList',
        content: [
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Alzada: Recurso contra actos que no ponen fin a la vía administrativa' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Reposición: Recurso potestativo contra actos que agotan la vía administrativa' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Revisión: Recurso extraordinario contra actos firmes en vía administrativa' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Silencio: Ausencia de resolución expresa en el plazo legal establecido' }] }] },
        ],
      },
    ],
  },
};

describe('topic-question-generator.util', () => {
  it('should generate questions locally from callouts, tables, and definitions', () => {
    const drafts = generateQuestionsFromTopic(sampleTopic, {
      maxQuestions: 12,
      rng: () => 0.42,
    });

    expect(drafts.length).toBeGreaterThanOrEqual(5);
    expect(drafts.some((d) => d.strategy === 'callout')).toBe(true);
    expect(drafts.some((d) => d.strategy === 'table')).toBe(true);
    expect(drafts.some((d) => d.strategy === 'definition')).toBe(true);

    for (const d of drafts) {
      expect(d.blockId).toBe('B1');
      expect(d.topicId).toBe('topic-1');
      expect(d.options.length).toBe(4);
      expect(d.correctIndex).toBeGreaterThanOrEqual(0);
      expect(d.correctIndex).toBeLessThanOrEqual(3);
    }
  });

  it('should build a calibrated INAP AI prompt including callouts and tables', () => {
    const result = buildAiPromptForTopic(sampleTopic, {
      blockCode: 'Bloque I',
      questionCount: 10,
      difficulty: 'hard',
      focusCallouts: true,
    });

    expect(result.truncated).toBe(false);
    expect(result.prompt).toContain('exactamente 10 preguntas');
    expect(result.prompt).toContain('⚠️ OJO EXAMEN');
    expect(result.prompt).toContain('| Protocolo | Puerto |');
    expect(result.prompt).toContain('"blockId": "B1"');
  });

  it('should strip markdown code fences from pasted LLM JSON', () => {
    const fenced = '```json\n[{"prompt": "Test"}]\n```';
    expect(stripMarkdownCodeFence(fenced)).toBe('[{"prompt": "Test"}]');
  });
});
