import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { CreateQuestionInput, StudyBlockId } from '../../../core/models/study.models';
import { StudyStoreService } from '../../../core/services/study-store.service';
import {
  IMPORT_SAMPLE_TEMPLATES,
  QuestionImportFormat,
  parseQuestions,
} from '../utils/question-import.util';
import { OPTION_LETTERS } from '../utils/test-scoring.util';

export interface QuestionImportDialogData {
  defaultBlockId?: StudyBlockId;
  defaultTopicId?: string;
  defaultCaseStudyId?: string;
}

@Component({
  selector: 'app-question-import-dialog',
  imports: [FormsModule, MatButtonModule, MatDialogModule, MatIconModule],
  templateUrl: './question-import-dialog.html',
})
export class QuestionImportDialog {
  private readonly dialogRef = inject(
    MatDialogRef<QuestionImportDialog, CreateQuestionInput[]>,
  );
  protected readonly data =
    inject<QuestionImportDialogData>(MAT_DIALOG_DATA, { optional: true }) ?? {};
  protected readonly store = inject(StudyStoreService);

  protected readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');
  protected readonly letters = OPTION_LETTERS;

  protected readonly format = signal<QuestionImportFormat>('text');
  protected readonly defaultBlockId = signal<StudyBlockId>(
    this.data.defaultBlockId ?? this.store.defaultBlockId(),
  );
  protected readonly defaultTopicId = signal<string>(this.data.defaultTopicId ?? '');
  protected readonly defaultCaseStudyId = signal<string>(this.data.defaultCaseStudyId ?? '');
  protected readonly defaultSource = signal('');
  protected readonly rawText = signal('');

  protected readonly topicsForBlock = computed(() =>
    this.store.getTopicsForBlock(this.defaultBlockId()),
  );

  protected readonly parseResult = computed(() => {
    const content = this.rawText().trim();
    if (!content) {
      return { valid: [], errors: [] };
    }
    return parseQuestions(this.format(), content, {
      defaultBlockId: this.defaultBlockId(),
      defaultTopicId: this.defaultTopicId() || undefined,
      defaultCaseStudyId: this.defaultCaseStudyId() || undefined,
      defaultSource: this.defaultSource().trim() || undefined,
      blocks: this.store.blocks(),
      topics: this.store.topics(),
    });
  });

  protected setFormat(next: QuestionImportFormat): void {
    this.format.set(next);
  }

  protected onBlockChange(next: StudyBlockId): void {
    this.defaultBlockId.set(next);
    const current = this.store.getTopicById(this.defaultTopicId());
    if (current && current.blockId !== next) {
      this.defaultTopicId.set('');
    }
  }

  protected loadSample(): void {
    this.rawText.set(IMPORT_SAMPLE_TEMPLATES[this.format()]);
  }

  protected triggerFileSelect(): void {
    this.fileInput()?.nativeElement.click();
  }

  protected async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    const name = file.name.toLowerCase();
    if (name.endsWith('.json')) {
      this.format.set('json');
    } else if (name.endsWith('.csv')) {
      this.format.set('csv');
    } else {
      this.format.set('text');
    }

    const text = await file.text();
    this.rawText.set(text);
  }

  protected confirmImport(): void {
    const valid = this.parseResult().valid;
    if (valid.length === 0) return;
    this.dialogRef.close(valid);
  }
}
