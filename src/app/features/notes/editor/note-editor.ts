import {
  Component,
  DestroyRef,
  ElementRef,
  ViewEncapsulation,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Content, Editor, JSONContent } from '@tiptap/core';
import { Placeholder } from '@tiptap/extension-placeholder';
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table';
import { TaskItem } from '@tiptap/extension-task-item';
import { TaskList } from '@tiptap/extension-task-list';
import StarterKit from '@tiptap/starter-kit';
import { ExamCallout } from './extensions/exam-callout.extension';

export interface NoteEditorChange {
  contentJson: JSONContent;
  plainText: string;
}

@Component({
  selector: 'app-note-editor',
  imports: [MatIconModule, MatTooltipModule],
  templateUrl: './note-editor.html',
  styleUrl: './note-editor.scss',
  encapsulation: ViewEncapsulation.None,
})
export class NoteEditor {
  private readonly destroyRef = inject(DestroyRef);
  private readonly editorHost = viewChild.required<ElementRef<HTMLDivElement>>('editorHost');

  readonly topicId = input.required<string>();
  readonly initialContent = input<unknown>(null);
  readonly placeholder = input<string>(
    'Empieza a redactar tus apuntes... Usa # para títulos, - para listas, - [ ] para checklists o Ctrl+Shift+E para «Ojo examen».',
  );

  readonly contentChange = output<NoteEditorChange>();

  private editor: Editor | null = null;
  private loadedTopicId: string | null = null;
  private isApplyingExternalContent = false;

  protected readonly stateTick = signal(0);

  protected readonly isInTable = computed(() => {
    this.stateTick();
    return this.editor?.isActive('table') ?? false;
  });

  protected readonly canUndo = computed(() => {
    this.stateTick();
    return this.editor?.can().undo() ?? false;
  });

  protected readonly canRedo = computed(() => {
    this.stateTick();
    return this.editor?.can().redo() ?? false;
  });

  constructor() {
    afterNextRender(() => {
      this.initEditor();
    });

    effect(() => {
      const currentTopicId = this.topicId();
      const content = this.initialContent();
      if (this.editor && this.loadedTopicId !== currentTopicId) {
        this.loadedTopicId = currentTopicId;
        this.applyContentSilently(content);
      }
    });

    this.destroyRef.onDestroy(() => {
      this.editor?.destroy();
      this.editor = null;
    });
  }

  private initEditor(): void {
    const initial = this.normalizeContent(this.initialContent());
    this.loadedTopicId = this.topicId();

    this.editor = new Editor({
      element: this.editorHost().nativeElement,
      extensions: [
        StarterKit.configure({
          heading: {
            levels: [1, 2, 3, 4],
          },
        }),
        Placeholder.configure({
          placeholder: this.placeholder(),
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
      ],
      content: initial,
      editorProps: {
        attributes: {
          class: 'tiptap-content focus:outline-none',
          spellcheck: 'true',
        },
      },
      onTransaction: () => {
        this.stateTick.update((tick) => tick + 1);
      },
      onUpdate: ({ editor }) => {
        if (this.isApplyingExternalContent) {
          return;
        }
        this.contentChange.emit({
          contentJson: editor.getJSON(),
          plainText: editor.getText({ blockSeparator: '\n' }),
        });
      },
    });

    this.stateTick.update((tick) => tick + 1);
  }

  setExternalContent(content: Content): void {
    if (!this.editor) {
      return;
    }
    this.editor.commands.setContent(content, { emitUpdate: true });
  }

  private applyContentSilently(content: unknown): void {
    if (!this.editor) {
      return;
    }
    this.isApplyingExternalContent = true;
    try {
      this.editor.commands.setContent(this.normalizeContent(content), { emitUpdate: false });
      this.stateTick.update((tick) => tick + 1);
    } finally {
      this.isApplyingExternalContent = false;
    }
  }

  private normalizeContent(content: unknown): Content {
    if (content && typeof content === 'object' && 'type' in content) {
      return content as JSONContent;
    }
    if (typeof content === 'string') {
      return content;
    }
    return { type: 'doc', content: [{ type: 'paragraph' }] };
  }

  protected isActive(name: string, attributes?: Record<string, unknown>): boolean {
    this.stateTick();
    return this.editor?.isActive(name, attributes) ?? false;
  }

  protected toggleHeading(level: 1 | 2 | 3 | 4): void {
    this.editor?.chain().focus().toggleHeading({ level }).run();
  }

  protected toggleBold(): void {
    this.editor?.chain().focus().toggleBold().run();
  }

  protected toggleItalic(): void {
    this.editor?.chain().focus().toggleItalic().run();
  }

  protected toggleUnderline(): void {
    this.editor?.chain().focus().toggleUnderline().run();
  }

  protected toggleCode(): void {
    this.editor?.chain().focus().toggleCode().run();
  }

  protected toggleBulletList(): void {
    this.editor?.chain().focus().toggleBulletList().run();
  }

  protected toggleOrderedList(): void {
    this.editor?.chain().focus().toggleOrderedList().run();
  }

  protected toggleTaskList(): void {
    this.editor?.chain().focus().toggleTaskList().run();
  }

  protected toggleCodeBlock(): void {
    this.editor?.chain().focus().toggleCodeBlock().run();
  }

  protected toggleBlockquote(): void {
    this.editor?.chain().focus().toggleBlockquote().run();
  }

  protected toggleExamCallout(): void {
    this.editor?.chain().focus().toggleExamCallout().run();
  }

  protected insertTable(): void {
    this.editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }

  protected addRowAfter(): void {
    this.editor?.chain().focus().addRowAfter().run();
  }

  protected deleteRow(): void {
    this.editor?.chain().focus().deleteRow().run();
  }

  protected addColumnAfter(): void {
    this.editor?.chain().focus().addColumnAfter().run();
  }

  protected deleteColumn(): void {
    this.editor?.chain().focus().deleteColumn().run();
  }

  protected deleteTable(): void {
    this.editor?.chain().focus().deleteTable().run();
  }

  protected undo(): void {
    this.editor?.chain().focus().undo().run();
  }

  protected redo(): void {
    this.editor?.chain().focus().redo().run();
  }
}
