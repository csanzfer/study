import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { JSONContent } from '@tiptap/core';
import {
  ImportFileFormat,
  ImportedNoteResult,
  NoteImportService,
} from '../services/note-import.service';

export interface NoteImportDialogData {
  mode: 'create-topics' | 'insert-into-topic';
  blockLabel?: string;
  topicTitle?: string;
}

export interface NoteImportTopicItem {
  title: string;
  tags: string[];
  contentJson: JSONContent;
  plainText: string;
}

export type NoteImportDialogResult =
  | {
      mode: 'create-topics';
      items: NoteImportTopicItem[];
    }
  | {
      mode: 'insert-into-topic';
      insertMode: 'append' | 'replace';
      item: NoteImportTopicItem;
    };

interface EditableImportEntry {
  id: string;
  fileName: string;
  format: ImportFileFormat;
  title: string;
  tagsText: string;
  contentJson: JSONContent;
  plainText: string;
  wordCount: number;
  warnings: string[];
}

@Component({
  selector: 'app-note-import-dialog',
  imports: [FormsModule, MatButtonModule, MatDialogModule, MatIconModule],
  templateUrl: './note-import-dialog.html',
})
export class NoteImportDialog {
  private readonly importService = inject(NoteImportService);
  protected readonly dialogRef = inject(MatDialogRef<NoteImportDialog, NoteImportDialogResult>);
  protected readonly data = inject<NoteImportDialogData>(MAT_DIALOG_DATA);

  protected readonly entries = signal<EditableImportEntry[]>([]);
  protected readonly insertMode = signal<'append' | 'replace'>('append');
  protected readonly isDragging = signal(false);
  protected readonly parsing = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly allowMultiple = computed(() => this.data.mode === 'create-topics');
  protected readonly canConfirm = computed(() => {
    const list = this.entries();
    if (list.length === 0 || this.parsing()) {
      return false;
    }
    if (this.data.mode === 'create-topics') {
      return list.every((entry) => entry.title.trim().length > 0);
    }
    return true;
  });

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(true);
  }

  protected onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
  }

  protected async onDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);

    if (this.parsing()) {
      return;
    }

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      await this.processFiles(Array.from(files));
    }
  }

  protected async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (this.parsing()) {
      input.value = '';
      return;
    }

    const files = input.files;
    if (files && files.length > 0) {
      await this.processFiles(Array.from(files));
    }
    input.value = '';
  }

  protected updateEntryTitle(id: string, title: string): void {
    this.entries.update((list) =>
      list.map((item) => (item.id === id ? { ...item, title } : item)),
    );
  }

  protected updateEntryTags(id: string, tagsText: string): void {
    this.entries.update((list) =>
      list.map((item) => (item.id === id ? { ...item, tagsText } : item)),
    );
  }

  protected removeEntry(id: string): void {
    this.entries.update((list) => list.filter((item) => item.id !== id));
  }

  protected confirm(): void {
    const list = this.entries();
    if (list.length === 0) {
      return;
    }

    if (this.data.mode === 'create-topics') {
      const items: NoteImportTopicItem[] = list.map((entry) => ({
        title: entry.title.trim(),
        tags: this.parseTags(entry.tagsText),
        contentJson: entry.contentJson,
        plainText: entry.plainText,
      }));
      this.dialogRef.close({ mode: 'create-topics', items });
      return;
    }

    const first = list[0];
    this.dialogRef.close({
      mode: 'insert-into-topic',
      insertMode: this.insertMode(),
      item: {
        title: first.title.trim(),
        tags: this.parseTags(first.tagsText),
        contentJson: first.contentJson,
        plainText: first.plainText,
      },
    });
  }

  private async processFiles(files: File[]): Promise<void> {
    this.errorMessage.set(null);
    this.parsing.set(true);

    const targetFiles = this.allowMultiple() ? files : files.slice(0, 1);
    const parsedEntries: EditableImportEntry[] = [];
    const errors: string[] = [];

    try {
      for (const file of targetFiles) {
        try {
          const parsed = await this.importService.parseFile(file);
          parsedEntries.push(this.toEditableEntry(parsed));
        } catch (err) {
          errors.push(
            err instanceof Error ? err.message : `No se pudo leer "${file.name}".`,
          );
        }
      }

      if (parsedEntries.length > 0) {
        if (this.allowMultiple()) {
          this.entries.update((existing) => [...existing, ...parsedEntries]);
        } else {
          this.entries.set(parsedEntries);
        }
      }

      if (errors.length > 0) {
        this.errorMessage.set(errors.join(' '));
      }
    } finally {
      this.parsing.set(false);
    }
  }

  private toEditableEntry(parsed: ImportedNoteResult): EditableImportEntry {
    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      fileName: parsed.fileName,
      format: parsed.format,
      title: parsed.suggestedTitle,
      tagsText: parsed.suggestedTags.join(', '),
      contentJson: parsed.contentJson,
      plainText: parsed.plainText,
      wordCount: parsed.wordCount,
      warnings: parsed.warnings,
    };
  }

  private parseTags(raw: string): string[] {
    return Array.from(
      new Set(
        raw
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
      ),
    );
  }
}
