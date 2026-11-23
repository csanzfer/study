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
import { createNoteEditorExtensions } from './note-editor.extensions';

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
  readonly createFlashcardRequest = output<string>();

  private editor: Editor | null = null;
  private loadedTopicId: string | null = null;
  private isApplyingExternalContent = false;

  protected readonly stateTick = signal(0);

  protected readonly selectedText = computed(() => {
    this.stateTick();
    if (!this.editor) {
      return '';
    }
    const { from, to } = this.editor.state.selection;
    if (from === to) {
      return '';
    }
    return this.editor.state.doc.textBetween(from, to, ' ').trim();
  });

  protected readonly hasSelection = computed(() => this.selectedText().length > 0);

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
      extensions: createNoteEditorExtensions(this.placeholder()),
      content: initial,
      editorProps: {
        attributes: {
          class: 'tiptap-content focus:outline-none',
          spellcheck: 'true',
        },
        handleKeyDown: (_view, event) => {
          if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'f') {
            event.preventDefault();
            this.requestCreateFlashcard();
            return true;
          }
          return false;
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

  setExternalContent(content: Content, emitUpdate = false): void {
    if (!this.editor) {
      return;
    }
    this.isApplyingExternalContent = !emitUpdate;
    try {
      this.editor.commands.setContent(content, { emitUpdate });
      this.stateTick.update((tick) => tick + 1);
    } finally {
      this.isApplyingExternalContent = false;
    }
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

  protected requestCreateFlashcard(): void {
    this.createFlashcardRequest.emit(this.selectedText());
  }
}
