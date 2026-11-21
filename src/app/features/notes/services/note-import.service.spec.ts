import { TestBed } from '@angular/core/testing';
import { NoteImportService } from './note-import.service';

describe('NoteImportService', () => {
  let service: NoteImportService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [NoteImportService],
    });
    service = TestBed.inject(NoteImportService);
  });

  it('should detect supported formats (.docx, .md, .markdown)', () => {
    expect(service.detectFormat('Tema_1.docx')).toBe('docx');
    expect(service.detectFormat('tema-2.md')).toBe('md');
    expect(service.detectFormat('apunte.MARKDOWN')).toBe('md');
    expect(service.detectFormat('resumen.pdf')).toBeNull();
  });

  it('should parse markdown with YAML frontmatter, headings, checklists and exam callout', () => {
    const md = `---
title: "Ley 39/2015 LPAC"
tags: [leyes, plazos, administracion]
---

# Procedimiento Administrativo

## Plazos clave

- [x] Recurso de alzada: 1 mes
- [ ] Recurso de reposición: 1 mes

> [!WARNING]
> El plazo máximo de resolución por defecto es de 3 meses si la norma no fija otro.

| Recurso | Plazo |
| :--- | :--- |
| Alzada | 1 mes |
`;

    const result = service.parseMarkdownText(md, 'ley39.md');

    expect(result.format).toBe('md');
    expect(result.suggestedTitle).toBe('Ley 39/2015 LPAC');
    expect(result.suggestedTags).toEqual(['leyes', 'plazos', 'administracion']);
    expect(result.wordCount).toBeGreaterThan(10);

    const nodeTypes = (result.contentJson.content ?? []).map((node) => node.type);
    expect(nodeTypes).toContain('heading');
    expect(nodeTypes).toContain('taskList');
    expect(nodeTypes).toContain('examCallout');
    expect(nodeTypes).toContain('table');
    expect(result.plainText).toContain('Procedimiento Administrativo');
    expect(result.plainText).toContain('3 meses');
  });

  it('should map "Ojo examen:" blockquotes into examCallout and fallback title from filename', () => {
    const md = `> **Ojo examen:** El puerto HTTPS por defecto es el 443.

Lista rápida:
- TCP 80
- TCP 443`;

    const result = service.parseMarkdownText(md, 'tema_04_puertos_red.md');

    expect(result.suggestedTitle).toBe('tema 04 puertos red');
    const nodeTypes = (result.contentJson.content ?? []).map((node) => node.type);
    expect(nodeTypes).toContain('examCallout');
    expect(nodeTypes).toContain('bulletList');
  });

  it('should merge incoming TipTap document into an existing document with a divider', () => {
    const base = service.parseMarkdownText('# Parte 1\n\nTexto inicial.', 'p1.md').contentJson;
    const incoming = service.parseMarkdownText('# Parte 2\n\nTexto añadido.', 'p2.md').contentJson;

    const merged = service.mergeTipTapDocuments(base, incoming);
    const nodeTypes = (merged.contentJson.content ?? []).map((node) => node.type);

    expect(nodeTypes).toContain('horizontalRule');
    expect(merged.plainText).toContain('Parte 1');
    expect(merged.plainText).toContain('Parte 2');
  });
});
