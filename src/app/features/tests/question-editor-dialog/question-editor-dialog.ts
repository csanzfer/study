import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import {
  CreateQuestionInput,
  Question,
  QuestionOptionIndex,
  TaiBlockId,
} from '../../../core/models/study.models';
import { StudyStoreService } from '../../../core/services/study-store.service';
import { OPTION_LETTERS } from '../utils/test-scoring.util';

export interface QuestionEditorDialogData {
  question?: Question;
  defaultBlockId?: TaiBlockId;
  defaultTopicId?: string;
  defaultCaseStudyId?: string;
}

@Component({
  selector: 'app-question-editor-dialog',
  imports: [FormsModule, MatButtonModule, MatDialogModule, MatIconModule],
  templateUrl: './question-editor-dialog.html',
})
export class QuestionEditorDialog {
  private readonly dialogRef = inject(MatDialogRef<QuestionEditorDialog, CreateQuestionInput>);
  protected readonly data = inject<QuestionEditorDialogData>(MAT_DIALOG_DATA, { optional: true }) ?? {};
  protected readonly store = inject(StudyStoreService);
  protected readonly letters = OPTION_LETTERS;

  protected readonly isEdit = Boolean(this.data.question);

  protected readonly blockId = signal<TaiBlockId>(
    this.data.question?.blockId ?? this.data.defaultBlockId ?? 'B1',
  );
  protected readonly topicId = signal<string>(
    this.data.question?.topicId ?? this.data.defaultTopicId ?? '',
  );
  protected readonly caseStudyId = signal<string>(
    this.data.question?.caseStudyId ?? this.data.defaultCaseStudyId ?? '',
  );
  protected readonly prompt = signal(this.data.question?.prompt ?? '');
  protected readonly optionA = signal(this.data.question?.options[0] ?? '');
  protected readonly optionB = signal(this.data.question?.options[1] ?? '');
  protected readonly optionC = signal(this.data.question?.options[2] ?? '');
  protected readonly optionD = signal(this.data.question?.options[3] ?? '');
  protected readonly correctIndex = signal<QuestionOptionIndex>(
    this.data.question?.correctIndex ?? 0,
  );
  protected readonly explanation = signal(this.data.question?.explanation ?? '');
  protected readonly reference = signal(this.data.question?.reference ?? '');
  protected readonly source = signal(this.data.question?.source ?? '');
  protected readonly tagsText = signal((this.data.question?.tags ?? []).join(', '));
  protected readonly flagged = signal(this.data.question?.flagged ?? false);

  protected readonly topicsForSelectedBlock = computed(() =>
    this.store.getTopicsForBlock(this.blockId()),
  );

  protected readonly canSave = computed(
    () =>
      this.prompt().trim().length > 0 &&
      this.optionA().trim().length > 0 &&
      this.optionB().trim().length > 0 &&
      this.optionC().trim().length > 0 &&
      this.optionD().trim().length > 0,
  );

  protected onBlockChange(nextBlock: TaiBlockId): void {
    this.blockId.set(nextBlock);
    const currentTopic = this.store.getTopicById(this.topicId());
    if (currentTopic && currentTopic.blockId !== nextBlock) {
      this.topicId.set('');
    }
  }

  protected save(): void {
    if (!this.canSave()) {
      return;
    }

    const tags = this.tagsText()
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const payload: CreateQuestionInput = {
      blockId: this.blockId(),
      topicId: this.topicId() || undefined,
      caseStudyId: this.caseStudyId() || undefined,
      prompt: this.prompt().trim(),
      options: [
        this.optionA().trim(),
        this.optionB().trim(),
        this.optionC().trim(),
        this.optionD().trim(),
      ],
      correctIndex: this.correctIndex(),
      explanation: this.explanation().trim() || undefined,
      reference: this.reference().trim() || undefined,
      source: this.source().trim() || undefined,
      tags,
      flagged: this.flagged(),
    };

    this.dialogRef.close(payload);
  }
}
