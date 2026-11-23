import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CanDeactivateFn, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  EXAM_MODE_LABELS,
  Question,
  QuestionOptionIndex,
  TaiBlockId,
} from '../../../core/models/study.models';
import { StudyStoreService } from '../../../core/services/study-store.service';
import {
  ConfirmDialog,
  ConfirmDialogData,
} from '../../../shared/components/confirm-dialog/confirm-dialog';
import { TestRunnerService } from '../services/test-runner.service';
import {
  OPTION_LETTERS,
  formatDurationSec,
  formatPenaltyRatio,
} from '../utils/test-scoring.util';

type ReviewFilter = 'all' | 'wrong' | 'blank' | 'flagged';

@Component({
  selector: 'app-test-runner',
  imports: [RouterLink, MatButtonModule, MatDialogModule, MatIconModule, MatTooltipModule],
  host: {
    '(window:keydown)': 'onKeydown($event)',
  },
  templateUrl: './test-runner.html',
})
export class TestRunner {
  protected readonly runner = inject(TestRunnerService);
  protected readonly store = inject(StudyStoreService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);

  protected readonly letters = OPTION_LETTERS;
  protected readonly modeLabels = EXAM_MODE_LABELS;
  protected readonly reviewFilter = signal<ReviewFilter>('all');
  protected readonly statementCollapsedMobile = signal(false);

  protected readonly formattedTimer = computed(() => {
    const remaining = this.runner.remainingSec();
    if (remaining !== null) {
      return formatDurationSec(remaining);
    }
    return formatDurationSec(this.runner.elapsedSec());
  });

  protected readonly isLowTime = computed(() => {
    const remaining = this.runner.remainingSec();
    return remaining !== null && remaining <= 300;
  });

  protected readonly penaltyLabel = computed(() =>
    formatPenaltyRatio(this.runner.config()?.penaltyRatio ?? 0),
  );

  protected readonly reviewItems = computed(() => {
    const score = this.runner.lastScore();
    const questions = this.runner.questions();
    const filter = this.reviewFilter();
    if (!score) return [];

    const questionMap = new Map(questions.map((q) => [q.id, q]));
    return score.answers
      .map((answer, idx) => ({
        index: idx + 1,
        answer,
        question: questionMap.get(answer.questionId)!,
      }))
      .filter((entry) => {
        if (!entry.question) return false;
        if (filter === 'wrong') return entry.answer.selectedIndex !== null && !entry.answer.isCorrect;
        if (filter === 'blank') return entry.answer.selectedIndex === null;
        if (filter === 'flagged') return entry.question.flagged;
        return true;
      });
  });

  protected readonly blockBreakdownList = computed(() => {
    const score = this.runner.lastScore();
    if (!score) return [];
    return (['B1', 'B2', 'B3', 'B4'] as TaiBlockId[])
      .map((blockId) => ({
        blockId,
        block: this.store.getBlockById(blockId),
        stats: score.byBlock[blockId],
      }))
      .filter((item) => item.stats.total > 0);
  });

  protected onKeydown(event: KeyboardEvent): void {
    if (!this.runner.isRunning()) return;
    if (this.dialog.openDialogs.length > 0) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const tag = (event.target as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    const current = this.runner.currentQuestion();
    if (!current) return;

    const key = event.key.toLowerCase();
    if (key === 'arrowright') {
      event.preventDefault();
      this.runner.nextQuestion();
    } else if (key === 'arrowleft') {
      event.preventDefault();
      this.runner.previousQuestion();
    } else if (key === '1' || key === 'a') {
      this.runner.selectOption(current.id, 0);
    } else if (key === '2' || key === 'b') {
      this.runner.selectOption(current.id, 1);
    } else if (key === '3' || key === 'c') {
      this.runner.selectOption(current.id, 2);
    } else if (key === '4' || key === 'd') {
      this.runner.selectOption(current.id, 3);
    } else if (key === 'backspace' || key === 'escape') {
      this.runner.clearAnswer(current.id);
    }
  }

  protected selectOption(optionIdx: number): void {
    const current = this.runner.currentQuestion();
    if (!current) return;
    this.runner.selectOption(current.id, optionIdx as QuestionOptionIndex);
  }

  protected async requestFinish(): Promise<void> {
    const blank = this.runner.blankCount();
    const message =
      blank > 0
        ? `Tienes ${blank} ${blank === 1 ? 'pregunta sin contestar' : 'preguntas sin contestar'} (en blanco no penalizan). ¿Quieres finalizar y corregir ahora?`
        : 'Has respondido todas las preguntas. ¿Finalizar y corregir el test ahora?';

    const ref = this.dialog.open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, {
      width: '440px',
      data: {
        title: 'Finalizar test',
        message,
        confirmLabel: 'Finalizar y corregir',
        cancelLabel: 'Seguir revisando',
      },
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    await this.runner.finishSession();
  }

  protected retryMistakes(): void {
    const score = this.runner.lastScore();
    if (!score) return;
    const wrongIds = new Set(
      score.answers
        .filter((a) => a.selectedIndex !== null && !a.isCorrect)
        .map((a) => a.questionId),
    );
    const wrongQuestions = this.runner
      .questions()
      .filter((q) => wrongIds.has(q.id));
    if (wrongQuestions.length === 0) return;

    this.runner.startSession(wrongQuestions, {
      title: `Repaso de fallos (${wrongQuestions.length} preg.)`,
      mode: 'mistakes',
      penaltyRatio: 0,
      immediateFeedback: true,
      timeLimitSec: null,
      caseStudy: this.runner.config()?.caseStudy,
    });
  }

  protected exitToTests(): void {
    this.runner.reset();
    void this.router.navigate(['/tests']);
  }

  protected getQuestionNavClass(q: Question, idx: number): string {
    const isCurrent = this.runner.currentIndex() === idx;
    const selected = this.runner.selections().get(q.id) ?? null;
    const marked = this.runner.reviewMarks().has(q.id);

    if (isCurrent) {
      return 'border-blue-600 bg-blue-600 text-white shadow-xs';
    }
    if (marked) {
      return 'border-amber-400 bg-amber-50 text-amber-800 dark:border-amber-600 dark:bg-amber-950/60 dark:text-amber-300';
    }
    if (selected !== null) {
      if (this.runner.config()?.immediateFeedback) {
        return selected === q.correctIndex
          ? 'border-emerald-400 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
          : 'border-rose-400 bg-rose-50 text-rose-800 dark:border-rose-700 dark:bg-rose-950/50 dark:text-rose-300';
      }
      return 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300';
    }
    return 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300';
  }

  protected formatDuration(sec: number): string {
    return formatDurationSec(sec);
  }

  async canLeaveSession(): Promise<boolean> {
    if (!this.runner.isRunning()) {
      return true;
    }
    const ref = this.dialog.open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, {
      width: '440px',
      data: {
        title: '¿Abandonar el test en curso?',
        message: 'Si sales ahora se perderá el progreso de este intento sin guardarse.',
        confirmLabel: 'Salir sin guardar',
        cancelLabel: 'Continuar test',
        danger: true,
      },
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (confirmed) {
      this.runner.reset();
    }
    return Boolean(confirmed);
  }
}

export const testRunnerCanDeactivateGuard: CanDeactivateFn<TestRunner> = (component) =>
  component.canLeaveSession();
