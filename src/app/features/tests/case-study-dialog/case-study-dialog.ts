import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import {
  CaseStudy,
  CreateCaseStudyInput,
  StudyBlockId,
} from '../../../core/models/study.models';
import { StudyStoreService } from '../../../core/services/study-store.service';

export interface CaseStudyDialogData {
  caseStudy?: CaseStudy;
}

@Component({
  selector: 'app-case-study-dialog',
  imports: [FormsModule, MatButtonModule, MatDialogModule, MatIconModule],
  templateUrl: './case-study-dialog.html',
})
export class CaseStudyDialog {
  private readonly dialogRef = inject(
    MatDialogRef<CaseStudyDialog, CreateCaseStudyInput>,
  );
  protected readonly data =
    inject<CaseStudyDialogData>(MAT_DIALOG_DATA, { optional: true }) ?? {};
  protected readonly store = inject(StudyStoreService);

  protected readonly isEdit = Boolean(this.data.caseStudy);

  protected readonly blockId = signal<StudyBlockId>(
    this.data.caseStudy?.blockId ?? this.store.defaultBlockId(),
  );
  protected readonly title = signal(this.data.caseStudy?.title ?? '');
  protected readonly statement = signal(this.data.caseStudy?.statement ?? '');
  protected readonly source = signal(this.data.caseStudy?.source ?? '');
  protected readonly tagsText = signal((this.data.caseStudy?.tags ?? []).join(', '));

  protected readonly canSave = computed(
    () =>
      this.blockId().length > 0 &&
      this.title().trim().length > 0 &&
      this.statement().trim().length > 0,
  );

  protected save(): void {
    if (!this.canSave()) return;
    this.dialogRef.close({
      blockId: this.blockId(),
      title: this.title().trim(),
      statement: this.statement().trim(),
      source: this.source().trim() || undefined,
      tags: this.tagsText()
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    });
  }
}
