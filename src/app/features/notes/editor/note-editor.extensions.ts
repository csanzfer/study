import { Extensions } from '@tiptap/core';
import { Placeholder } from '@tiptap/extension-placeholder';
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table';
import { TaskItem } from '@tiptap/extension-task-item';
import { TaskList } from '@tiptap/extension-task-list';
import StarterKit from '@tiptap/starter-kit';
import { ExamCallout } from './extensions/exam-callout.extension';

export function createNoteEditorExtensions(placeholder?: string): Extensions {
  const extensions: Extensions = [
    StarterKit.configure({
      heading: {
        levels: [1, 2, 3, 4],
      },
    }),
    Table.configure({
      resizable: false,
    }),
    TableRow,
    TableHeader,
    TableCell,
    TaskList,
    TaskItem.configure({
      nested: true,
    }),
    ExamCallout,
  ];

  if (placeholder !== undefined) {
    extensions.push(
      Placeholder.configure({
        placeholder,
      }),
    );
  }

  return extensions;
}
