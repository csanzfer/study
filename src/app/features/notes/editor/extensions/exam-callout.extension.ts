import { Node, mergeAttributes } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    examCallout: {
      setExamCallout: () => ReturnType;
      toggleExamCallout: () => ReturnType;
      unsetExamCallout: () => ReturnType;
    };
  }
}

export const ExamCallout = Node.create({
  name: 'examCallout',
  group: 'block',
  content: 'block+',
  defining: true,

  parseHTML() {
    return [
      {
        tag: 'div[data-type="exam-callout"]',
      },
      {
        tag: 'blockquote[data-type="exam-callout"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'exam-callout',
        class: 'exam-callout',
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setExamCallout:
        () =>
        ({ commands }) =>
          commands.wrapIn(this.name),
      toggleExamCallout:
        () =>
        ({ commands }) =>
          commands.toggleWrap(this.name),
      unsetExamCallout:
        () =>
        ({ commands }) =>
          commands.lift(this.name),
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-e': () => this.editor.commands.toggleExamCallout(),
    };
  },
});
