import { DatePipe } from '@angular/common';
import { Component, computed, inject, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';
import { EXAM_MODE_LABELS, ExamAttempt } from '../../../core/models/study.models';
import { StudyStoreService } from '../../../core/services/study-store.service';
import {
  ConfirmDialog,
  ConfirmDialogData,
} from '../../../shared/components/confirm-dialog/confirm-dialog';
import {
  TopicPerformance,
  computeAttemptTrend,
  computeAverageScoreOn10,
  computeBlockPerformance,
  computeWeakestTopics,
} from '../utils/test-analytics.util';
import { formatDurationSec, formatPenaltyRatio } from '../utils/test-scoring.util';

interface ChartPoint {
  x: number;
  y: number;
  score: number;
  title: string;
  date: string;
}

@Component({
  selector: 'app-test-analytics',
  imports: [DatePipe, MatButtonModule, MatDialogModule, MatIconModule, MatTooltipModule],
  templateUrl: './test-analytics.html',
})
export class TestAnalytics {
  protected readonly store = inject(StudyStoreService);
  private readonly dialog = inject(MatDialog);

  readonly practiceTopic = output<TopicPerformance>();
  readonly launchMistakes = output<void>();

  protected readonly modeLabels = EXAM_MODE_LABELS;

  protected readonly blockPerformance = computed(() =>
    computeBlockPerformance(this.store.blocks(), this.store.questions()),
  );

  protected readonly weakestTopics = computed(() =>
    computeWeakestTopics(this.store.topics(), this.store.questions(), 10),
  );

  protected readonly trend = computed(() =>
    computeAttemptTrend(this.store.examAttempts(), 15),
  );

  protected readonly averageScore = computed(() =>
    computeAverageScoreOn10(this.store.examAttempts()),
  );

  protected readonly bestScore = computed(() => {
    const attempts = this.store.examAttempts();
    if (attempts.length === 0) return null;
    return Math.max(...attempts.map((a) => a.scoreOn10));
  });

  // SVG chart coordinates (viewBox 0 0 600 180)
  protected readonly chartPoints = computed<ChartPoint[]>(() => {
    const points = this.trend();
    if (points.length === 0) return [];
    const padX = 36;
    const padY = 20;
    const width = 600 - padX * 2;
    const height = 180 - padY * 2;

    return points.map((pt, idx) => {
      const x =
        points.length === 1
          ? padX + width / 2
          : padX + (idx / (points.length - 1)) * width;
      const clamped = Math.max(0, Math.min(10, pt.scoreOn10));
      const y = padY + height - (clamped / 10) * height;
      return {
        x: Math.round(x * 10) / 10,
        y: Math.round(y * 10) / 10,
        score: pt.scoreOn10,
        title: pt.title,
        date: pt.date,
      };
    });
  });

  protected readonly chartPolyline = computed(() =>
    this.chartPoints()
      .map((p) => `${p.x},${p.y}`)
      .join(' '),
  );

  protected formatDuration(sec: number): string {
    return formatDurationSec(sec);
  }

  protected formatPenalty(ratio: number): string {
    return formatPenaltyRatio(ratio);
  }

  protected async deleteAttempt(attempt: ExamAttempt): Promise<void> {
    const ref = this.dialog.open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, {
      width: '420px',
      data: {
        title: 'Eliminar intento del historial',
        message: `¿Eliminar "${attempt.title}" del historial de analítica?`,
        confirmLabel: 'Eliminar',
        cancelLabel: 'Cancelar',
        danger: true,
      },
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    await this.store.deleteExamAttempt(attempt.id);
  }
}
