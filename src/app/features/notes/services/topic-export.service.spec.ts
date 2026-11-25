import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { StudyBlock, Topic } from '../../../core/models/study.models';
import { TopicExportService } from './topic-export.service';

const sampleBlock: StudyBlock = {
  id: 'B2',
  code: 'Bloque II',
  title: 'Tecnología Básica',
  shortTitle: 'Tecnología',
  description: 'Arquitectura y sistemas.',
  color: '#0891b2',
  icon: 'memory',
  order: 2,
};

const sampleTopic: Topic = {
  id: 'topic-b2-1',
  blockId: 'B2',
  order: 3,
  title: 'Memoria Caché y Jerarquía',
  status: 'memorizing',
  roundCount: 3,
  tags: ['hardware'],
  contentJson: {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'La memoria SRAM es más rápida que la DRAM.' }],
      },
      {
        type: 'examCallout',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'SRAM no necesita refresco.' }] },
        ],
      },
    ],
  },
  plainText: 'La memoria SRAM es más rápida que la DRAM.',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-02-01T00:00:00.000Z',
};

describe('TopicExportService', () => {
  it('builds print-friendly HTML with callout styling and strips script tags', () => {
    TestBed.configureTestingModule({});
    const service = TestBed.inject(TopicExportService);

    const html = service.buildPrintableHtml(
      'Memoria Caché',
      'Bloque II · Tecnología Básica',
      '# Memoria Caché\n\n> [!IMPORTANT]\n> **Ojo examen**\n>\n> SRAM no necesita refresco.\n\n<script>alert(1)</script>',
    );

    expect(html).toContain('@page');
    expect(html).toContain('— crisisstudent');
    expect(html).toContain('>cris</span><span');
    expect(html).toContain('class="exam-callout"');
    expect(html).toContain('SRAM no necesita refresco.');
    expect(html).not.toContain('<script>');
  });

  it('sanitizes XSS vectors in raw HTML while preserving escaped script examples inside code blocks', () => {
    TestBed.configureTestingModule({});
    const service = TestBed.inject(TopicExportService);

    const md = [
      '```html',
      '<script>console.log("ok")</script>',
      '```',
      '',
      '<img src="x" onerror="alert(1)" />',
      '<a href="javascript:alert(2)">clic</a>',
    ].join('\n');

    const html = service.buildPrintableHtml('HTML y JS', 'Bloque III', md);

    expect(html).toContain('&lt;script&gt;console.log("ok")&lt;/script&gt;');
    expect(html).not.toContain('onerror=');
    expect(html).not.toContain('javascript:alert');
  });

  it('triggers a .md file download with sanitized filename', () => {
    TestBed.configureTestingModule({});
    const service = TestBed.inject(TopicExportService);

    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    const filename = service.downloadTopicMarkdown(sampleTopic, sampleBlock);

    expect(filename).toBe('b2-t3-memoria-cache-y-jerarquia.md');
    expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock');

    createObjectURLSpy.mockRestore();
    revokeObjectURLSpy.mockRestore();
    clickSpy.mockRestore();
  });
});
