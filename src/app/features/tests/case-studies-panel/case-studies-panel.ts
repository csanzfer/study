import { Component, inject, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';
import {
  CaseStudy,
  CreateCaseStudyInput,
  CreateQuestionInput,
  TaiBlockId,
} from '../../../core/models/study.models';
import { StudyStoreService } from '../../../core/services/study-store.service';
import {
  ConfirmDialog,
  ConfirmDialogData,
} from '../../../shared/components/confirm-dialog/confirm-dialog';
import {
  CaseStudyDialog,
  CaseStudyDialogData,
} from '../case-study-dialog/case-study-dialog';
import {
  QuestionEditorDialog,
  QuestionEditorDialogData,
} from '../question-editor-dialog/question-editor-dialog';
import {
  QuestionImportDialog,
  QuestionImportDialogData,
} from '../question-import-dialog/question-import-dialog';

@Component({
  selector: 'app-case-studies-panel',
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatSnackBarModule,
    MatTooltipModule,
  ],
  templateUrl: './case-studies-panel.html',
})
export class CaseStudiesPanel {
  protected readonly store = inject(StudyStoreService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly launchCaseStudy = output<CaseStudy>();

  protected getBlockColor(blockId: TaiBlockId): string {
    return this.store.getBlockById(blockId)?.color ?? '#7c3aed';
  }

  protected questionCount(caseStudyId: string): number {
    return this.store.getQuestionsForCaseStudy(caseStudyId).length;
  }

  protected async createCaseStudy(): Promise<void> {
    const ref = this.dialog.open<
      CaseStudyDialog,
      CaseStudyDialogData,
      CreateCaseStudyInput
    >(CaseStudyDialog, {
      width: '720px',
      maxWidth: '95vw',
    });
    const result = await firstValueFrom(ref.afterClosed());
    if (!result) return;

    await this.store.createCaseStudy(result);
    this.snackBar.open('Supuesto práctico creado.', 'Cerrar', { duration: 2500 });
  }

  protected async editCaseStudy(cs: CaseStudy): Promise<void> {
    const ref = this.dialog.open<
      CaseStudyDialog,
      CaseStudyDialogData,
      CreateCaseStudyInput
    >(CaseStudyDialog, {
      width: '720px',
      maxWidth: '95vw',
      data: { caseStudy: cs },
    });
    const result = await firstValueFrom(ref.afterClosed());
    if (!result) return;

    await this.store.updateCaseStudy(cs.id, result);
    this.snackBar.open('Supuesto práctico actualizado.', 'Cerrar', { duration: 2500 });
  }

  protected async addQuestionToCaseStudy(cs: CaseStudy): Promise<void> {
    const ref = this.dialog.open<
      QuestionEditorDialog,
      QuestionEditorDialogData,
      CreateQuestionInput
    >(QuestionEditorDialog, {
      width: '720px',
      maxWidth: '95vw',
      data: {
        defaultBlockId: cs.blockId,
        defaultCaseStudyId: cs.id,
      },
    });
    const result = await firstValueFrom(ref.afterClosed());
    if (!result) return;

    await this.store.createQuestion(result);
    this.snackBar.open('Pregunta vinculada al supuesto práctico.', 'Cerrar', {
      duration: 2500,
    });
  }

  protected async importQuestionsForCaseStudy(cs: CaseStudy): Promise<void> {
    const ref = this.dialog.open<
      QuestionImportDialog,
      QuestionImportDialogData,
      CreateQuestionInput[]
    >(QuestionImportDialog, {
      width: '820px',
      maxWidth: '96vw',
      data: {
        defaultBlockId: cs.blockId,
        defaultCaseStudyId: cs.id,
      },
    });
    const imported = await firstValueFrom(ref.afterClosed());
    if (!imported || imported.length === 0) return;

    await this.store.bulkCreateQuestions(imported);
    this.snackBar.open(
      `${imported.length} preguntas vinculadas a "${cs.title}".`,
      'Cerrar',
      { duration: 3000 },
    );
  }

  protected async deleteCaseStudy(cs: CaseStudy): Promise<void> {
    const ref = this.dialog.open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, {
      width: '440px',
      data: {
        title: 'Eliminar supuesto práctico',
        message: `¿Eliminar "${cs.title}"? Sus preguntas asociadas se conservarán en el banco como preguntas independientes.`,
        confirmLabel: 'Eliminar',
        cancelLabel: 'Cancelar',
        danger: true,
      },
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    await this.store.deleteCaseStudy(cs.id);
    this.snackBar.open('Supuesto eliminado (preguntas conservadas en el banco).', 'Cerrar', {
      duration: 3000,
    });
  }
}
