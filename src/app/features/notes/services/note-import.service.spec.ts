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

  it('should detect supported formats (.docx, .md, .markdown, .pdf, .pptx)', () => {
    expect(service.detectFormat('Tema_1.docx')).toBe('docx');
    expect(service.detectFormat('tema-2.md')).toBe('md');
    expect(service.detectFormat('apunte.MARKDOWN')).toBe('md');
    expect(service.detectFormat('resumen.pdf')).toBe('pdf');
    expect(service.detectFormat('clase_03.PPTX')).toBe('pptx');
    expect(service.detectFormat('notas.txt')).toBeNull();
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

  it('should parse structured PDF pages into headings, paragraphs and lists', () => {
    const result = service.parsePdfPages(
      [
        {
          pageNumber: 1,
          lines: [
            { text: 'Tema 1: Redes de Computadores', fontSize: 20, y: 760 },
            { text: 'Modelo OSI', fontSize: 15, y: 720 },
            { text: 'El modelo OSI divide la comunica-', fontSize: 11, y: 695 },
            { text: 'ción en siete capas independientes.', fontSize: 11, y: 681 },
            { text: '• Capa física y de enlace', fontSize: 11, y: 650 },
            { text: '• Capa de red y transporte', fontSize: 11, y: 636 },
            { text: '1. Encapsulación de paquetes', fontSize: 11, y: 605 },
            { text: '2. Enrutamiento entre nodos', fontSize: 11, y: 591 },
          ],
        },
      ],
      'redes_osi.pdf',
    );

    expect(result.format).toBe('pdf');
    expect(result.suggestedTitle).toBe('Tema 1: Redes de Computadores');
    expect(result.warnings).toEqual([]);

    const nodeTypes = (result.contentJson.content ?? []).map((node) => node.type);
    expect(nodeTypes).toContain('heading');
    expect(nodeTypes).toContain('paragraph');
    expect(nodeTypes).toContain('bulletList');
    expect(nodeTypes).toContain('orderedList');
    expect(result.plainText).toContain('comunicación en siete capas independientes.');
  });

  it('should emit a warning when a PDF has no extractable text', () => {
    const result = service.parsePdfPages([{ pageNumber: 1, lines: [] }], 'escaneado.pdf');

    expect(result.format).toBe('pdf');
    expect(result.suggestedTitle).toBe('escaneado');
    expect(result.wordCount).toBe(0);
    expect(result.warnings.length).toBe(1);
  });

  it('should parse a .pptx archive preserving slide order, headings, lists, tables and speaker notes', async () => {
    const jszipModule = await import('jszip');
    const JSZip = jszipModule.default ?? jszipModule;
    const zip = new JSZip();

    const slide1Xml = `<?xml version="1.0" encoding="UTF-8"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld><p:spTree>
    <p:sp>
      <p:nvSpPr><p:cNvPr id="2" name="Title"/><p:nvPr><p:ph type="ctrTitle"/></p:nvPr></p:nvSpPr>
      <p:txBody><a:p><a:r><a:t>Arquitectura TCP/IP</a:t></a:r></a:p></p:txBody>
    </p:sp>
    <p:sp>
      <p:nvSpPr><p:cNvPr id="3" name="Subtitle"/><p:nvPr><p:ph type="subTitle"/></p:nvPr></p:nvSpPr>
      <p:txBody><a:p><a:r><a:t>Resumen de protocolos clave</a:t></a:r></a:p></p:txBody>
    </p:sp>
    <p:sp>
      <p:nvSpPr><p:cNvPr id="4" name="SlideNum"/><p:nvPr><p:ph type="sldNum"/></p:nvPr></p:nvSpPr>
      <p:txBody><a:p><a:r><a:t>1</a:t></a:r></a:p></p:txBody>
    </p:sp>
  </p:spTree></p:cSld>
</p:sld>`;

    const slide2Xml = `<?xml version="1.0" encoding="UTF-8"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld><p:spTree>
    <p:sp>
      <p:nvSpPr><p:cNvPr id="2" name="Title"/><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>
      <p:txBody><a:p><a:r><a:t>Puertos frecuentes</a:t></a:r></a:p></p:txBody>
    </p:sp>
    <p:sp>
      <p:nvSpPr><p:cNvPr id="3" name="Content"/><p:nvPr><p:ph type="body"/></p:nvPr></p:nvSpPr>
      <p:txBody>
        <a:p><a:r><a:rPr b="1"/><a:t>HTTP:</a:t></a:r><a:r><a:t> puerto 80</a:t></a:r></a:p>
        <a:p><a:r><a:rPr b="1"/><a:t>HTTPS:</a:t></a:r><a:r><a:t> puerto 443</a:t></a:r></a:p>
      </p:txBody>
    </p:sp>
    <p:graphicFrame>
      <a:graphic><a:graphicData><a:tbl>
        <a:tr>
          <a:tc><a:txBody><a:p><a:r><a:t>Protocolo</a:t></a:r></a:p></a:txBody></a:tc>
          <a:tc><a:txBody><a:p><a:r><a:t>Puerto</a:t></a:r></a:p></a:txBody></a:tc>
        </a:tr>
        <a:tr>
          <a:tc><a:txBody><a:p><a:r><a:t>SSH</a:t></a:r></a:p></a:txBody></a:tc>
          <a:tc><a:txBody><a:p><a:r><a:t>22</a:t></a:r></a:p></a:txBody></a:tc>
        </a:tr>
      </a:tbl></a:graphicData></a:graphic>
    </p:graphicFrame>
  </p:spTree></p:cSld>
</p:sld>`;

    const slide10Xml = `<?xml version="1.0" encoding="UTF-8"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld><p:spTree>
    <p:sp>
      <p:nvSpPr><p:cNvPr id="2" name="Empty"/></p:nvSpPr>
      <p:txBody><a:p></a:p></p:txBody>
    </p:sp>
  </p:spTree></p:cSld>
</p:sld>`;

    const notes2Xml = `<?xml version="1.0" encoding="UTF-8"?>
<p:notes xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld><p:spTree>
    <p:sp>
      <p:nvSpPr><p:cNvPr id="2" name="Notes"/><p:nvPr><p:ph type="body"/></p:nvPr></p:nvSpPr>
      <p:txBody><a:p><a:r><a:t>Recordar que HTTPS usa TLS sobre TCP.</a:t></a:r></a:p></p:txBody>
    </p:sp>
  </p:spTree></p:cSld>
</p:notes>`;

    zip.file('ppt/slides/slide1.xml', slide1Xml);
    zip.file('ppt/slides/slide2.xml', slide2Xml);
    zip.file('ppt/slides/slide10.xml', slide10Xml);
    zip.file('ppt/notesSlides/notesSlide2.xml', notes2Xml);

    const buffer = await zip.generateAsync({ type: 'arraybuffer' });
    const result = await service.parsePptxArrayBuffer(buffer, 'clase_tcp_ip.pptx');

    expect(result.format).toBe('pptx');
    expect(result.suggestedTitle).toBe('Arquitectura TCP/IP');
    expect(result.warnings.length).toBe(1);

    const nodeTypes = (result.contentJson.content ?? []).map((node) => node.type);
    expect(nodeTypes).toContain('heading');
    expect(nodeTypes).toContain('bulletList');
    expect(nodeTypes).toContain('table');
    expect(nodeTypes).toContain('blockquote');

    expect(result.plainText).toContain('Resumen de protocolos clave');
    expect(result.plainText).toContain('puerto 443');
    expect(result.plainText).toContain('SSH');
    expect(result.plainText).toContain('Recordar que HTTPS usa TLS sobre TCP.');
  });
});
