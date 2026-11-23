import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';
import {
  CreateQuestionInput,
  Question,
  TaiBlockId,
} from '../../../core/models/study.models';
import { StudyStoreService } from '../../../core/services/study-store.service';
import {
  ConfirmDialog,
  ConfirmDialogData,
} from '../../../shared/components/confirm-dialog/confirm-dialog';
import {
  QuestionEditorDialog,
  QuestionEditorDialogData,
} from '../question-editor-dialog/question-editor-dialog';
import {
  QuestionImportDialog,
  QuestionImportDialogData,
} from '../question-import-dialog/question-import-dialog';
import { isQuestionFailed } from '../utils/test-generator.util';
import { OPTION_LETTERS } from '../utils/test-scoring.util';

type BankStatusFilter = 'all' | 'failed' | 'flagged' | 'unanswered';

@Component({
  selector: 'app-question-bank',
  imports: [
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatSnackBarModule,
    MatTooltipModule,
  ],
  templateUrl: './question-bank.html',
})
export class QuestionBank {
  protected readonly store = inject(StudyStoreService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly letters = OPTION_LETTERS;
  protected readonly blockFilter = signal<TaiBlockId | 'ALL'>('ALL');
  protected readonly topicFilter = signal<string>('ALL');
  protected readonly statusFilter = signal<BankStatusFilter>('all');
  protected readonly searchText = signal('');
  protected readonly expandedId = signal<string | null>(null);

  protected readonly availableTopics = computed(() => {
    const block = this.blockFilter();
    return block === 'ALL' ? this.store.topics() : this.store.getTopicsForBlock(block);
  });

  protected readonly filteredQuestions = computed(() => {
    const block = this.blockFilter();
    const topic = this.topicFilter();
    const status = this.statusFilter();
    const q = this.searchText().trim().toLowerCase();

    return this.store.questions().filter((item) => {
      if (block !== 'ALL' && item.blockId !== block) return false;
      if (topic !== 'ALL' && item.topicId !== topic) return false;
      if (status === 'failed' && !isQuestionFailed(item)) return false;
      if (status === 'flagged' && !item.flagged) return false;
      if (status === 'unanswered' && item.stats.attempts > 0) return false;

      if (q) {
        const matchPrompt = item.prompt.toLowerCase().includes(q);
        const matchOptions = item.options.some((opt) => opt.toLowerCase().includes(q));
        const matchRef = (item.reference ?? '').toLowerCase().includes(q);
        const matchTags = item.tags.some((t) => t.toLowerCase().includes(q));
        if (!matchPrompt && !matchOptions && !matchRef && !matchTags) return false;
      }

      return true;
    });
  });

  protected onBlockFilterChange(next: TaiBlockId | 'ALL'): void {
    this.blockFilter.set(next);
    this.topicFilter.set('ALL');
  }

  protected toggleExpanded(id: string): void {
    this.expandedId.update((curr) => (curr === id ? null : id));
  }

  protected getTopicTitle(topicId?: string): string | null {
    if (!topicId) return null;
    return this.store.getTopicById(topicId)?.title ?? null;
  }

  protected getCaseStudyTitle(caseStudyId?: string): string | null {
    if (!caseStudyId) return null;
    return this.store.getCaseStudyById(caseStudyId)?.title ?? null;
  }

  protected getBlockColor(blockId: TaiBlockId): string {
    return this.store.getBlockById(blockId)?.color ?? '#2563eb';
  }

  protected async openCreateDialog(): Promise<void> {
    const data: QuestionEditorDialogData = {
      defaultBlockId: this.blockFilter() === 'ALL' ? 'B1' : (this.blockFilter() as TaiBlockId),
      defaultTopicId: this.topicFilter() === 'ALL' ? undefined : this.topicFilter(),
    };
    const ref = this.dialog.open<
      QuestionEditorDialog,
      QuestionEditorDialogData,
      CreateQuestionInput
    >(QuestionEditorDialog, {
      width: '720px',
      maxWidth: '95vw',
      data,
    });
    const result = await firstValueFrom(ref.afterClosed());
    if (!result) return;

    await this.store.createQuestion(result);
    this.snackBar.open('Pregunta añadida al banco.', 'Cerrar', { duration: 2500 });
  }

  protected async openEditDialog(question: Question): Promise<void> {
    const ref = this.dialog.open<
      QuestionEditorDialog,
      QuestionEditorDialogData,
      CreateQuestionInput
    >(QuestionEditorDialog, {
      width: '720px',
      maxWidth: '95vw',
      data: { question },
    });
    const result = await firstValueFrom(ref.afterClosed());
    if (!result) return;

    await this.store.updateQuestion(question.id, result);
    this.snackBar.open('Pregunta actualizada.', 'Cerrar', { duration: 2500 });
  }

  protected async openImportDialog(): Promise<void> {
    const data: QuestionImportDialogData = {
      defaultBlockId: this.blockFilter() === 'ALL' ? 'B1' : (this.blockFilter() as TaiBlockId),
      defaultTopicId: this.topicFilter() === 'ALL' ? undefined : this.topicFilter(),
    };
    const ref = this.dialog.open<
      QuestionImportDialog,
      QuestionImportDialogData,
      CreateQuestionInput[]
    >(QuestionImportDialog, {
      width: '820px',
      maxWidth: '96vw',
      data,
    });
    const imported = await firstValueFrom(ref.afterClosed());
    if (!imported || imported.length === 0) return;

    await this.store.bulkCreateQuestions(imported);
    this.snackBar.open(`${imported.length} preguntas importadas al banco.`, 'Cerrar', {
      duration: 3500,
    });
  }

  protected async toggleFlag(question: Question): Promise<void> {
    await this.store.toggleQuestionFlag(question.id);
  }

  protected async deleteQuestion(question: Question): Promise<void> {
    const ref = this.dialog.open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, {
      width: '420px',
      data: {
        title: 'Eliminar pregunta',
        message: '¿Seguro que deseas eliminar esta pregunta del banco? Esta acción no se puede deshacer.',
        confirmLabel: 'Eliminar',
        cancelLabel: 'Cancelar',
        danger: true,
      },
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    await this.store.deleteQuestion(question.id);
    this.snackBar.open('Pregunta eliminada.', 'Cerrar', { duration: 2500 });
  }

  protected accuracyFor(q: Question): number | null {
    if (q.stats.attempts === 0) return null;
    return Math.round((q.stats.correct / q.stats.attempts) * 100);
  }
}
