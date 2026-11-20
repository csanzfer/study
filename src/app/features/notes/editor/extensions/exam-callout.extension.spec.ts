import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { ExamCallout } from './exam-callout.extension';

describe('ExamCallout TipTap Extension', () => {
  it('should wrap and unwrap content in an examCallout node', () => {
    const editor = new Editor({
      extensions: [StarterKit, ExamCallout],
      content: '<p>Plazo máximo de resolución: 3 meses (Ley 39/2015)</p>',
    });

    editor.commands.setTextSelection(2);
    editor.commands.toggleExamCallout();

    expect(editor.isActive('examCallout')).toBe(true);
    expect(editor.getHTML()).toContain('data-type="exam-callout"');
    expect(editor.getHTML()).toContain('class="exam-callout"');

    editor.commands.toggleExamCallout();
    expect(editor.isActive('examCallout')).toBe(false);

    editor.destroy();
  });

  it('should parse exam-callout HTML back into examCallout JSON node', () => {
    const editor = new Editor({
      extensions: [StarterKit, ExamCallout],
      content: '<div data-type="exam-callout"><p>Excepción típica de examen</p></div>',
    });

    const json = editor.getJSON();
    expect(json.content?.[0]?.type).toBe('examCallout');

    editor.destroy();
  });
});
