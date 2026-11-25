import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import {
  STUDY_SESSION_TYPE_LABELS,
  StudySession,
  StudySessionType,
  StudyBlock,
  StudyBlockId,
  Topic,
} from '../../../core/models/study.models';
import { PomodoroPhase, PomodoroService } from '../../../core/services/pomodoro.service';
import { StudyStoreService } from '../../../core/services/study-store.service';
import {
  formatLocalDateKey,
  formatMinutesAsHours,
  getWeekDays,
  getWeekStartDate,
} from '../../../shared/utils/week-date.util';

@Component({
  selector: 'app-pomodoro-panel',
  imports: [
    DatePipe,
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    MatTooltipModule,
  ],
  templateUrl: './pomodoro-panel.html',
})
export class PomodoroPanel {
  protected readonly store = inject(StudyStoreService);
  protected readonly pomodoro = inject(PomodoroService);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly sessionTypeEntries = Object.entries(STUDY_SESSION_TYPE_LABELS) as [
    StudySessionType,
    string,
  ][];
  protected readonly sessionTypeLabels = STUDY_SESSION_TYPE_LABELS;

  protected readonly showSettings = signal(false);
  protected readonly showManualLog = signal(false);
  protected readonly manualTopicId = signal('');
  protected readonly manualDuration = signal(30);
  protected readonly manualType = signal<StudySessionType>('reading');

  protected readonly blockMap = computed(() => {
    const map = new Map<StudyBlockId, StudyBlock>();
    for (const block of this.store.blocks()) {
      map.set(block.id, block);
    }
    return map;
  });

  protected readonly topicMap = computed(() => {
    const map = new Map<string, Topic>();
    for (const topic of this.store.topics()) {
      map.set(topic.id, topic);
    }
    return map;
  });

  protected readonly totalMinutesAllTime = computed(() =>
    this.store.studySessions().reduce((sum, s) => sum + s.durationMinutes, 0),
  );

  protected readonly blockMetrics = computed(() => {
    const weekMap = this.store.studyMinutesByBlockThisWeek();
    const totalMap = this.store.studyMinutesByBlockTotal();
    const maxWeek = Math.max(1, ...Object.values(weekMap));

    return this.store.blocks().map((block) => {
      const weekMinutes = weekMap[block.id] ?? 0;
      const weekPercent = Math.round((weekMinutes / maxWeek) * 100);
      return {
        block,
        weekMinutes,
        totalMinutes: totalMap[block.id] ?? 0,
        barWidthPercent: weekMinutes > 0 ? Math.max(4, weekPercent) : 0,
      };
    });
  });

  protected readonly weeklyDailyBars = computed(() => {
    const weekStart = getWeekStartDate();
    const days = getWeekDays(weekStart);
    const minutesByDateKey = new Map<string, number>();

    for (const session of this.store.studySessions()) {
      const date = new Date(session.startedAt);
      if (!Number.isNaN(date.getTime())) {
        const key = formatLocalDateKey(date);
        minutesByDateKey.set(key, (minutesByDateKey.get(key) ?? 0) + session.durationMinutes);
      }
    }

    const raw = days.map((day) => ({
      ...day,
      minutes: minutesByDateKey.get(day.dateKey) ?? 0,
    }));
    const maxMinutes = Math.max(30, ...raw.map((d) => d.minutes));

    return raw.map((d) => ({
      ...d,
      heightPercent: d.minutes > 0 ? Math.max(10, Math.round((d.minutes / maxMinutes) * 100)) : 4,
    }));
  });

  protected readonly recentSessions = computed(() => this.store.studySessions().slice(0, 12));

  protected formatDuration(minutes: number): string {
    return formatMinutesAsHours(minutes);
  }

  protected setPhase(phase: PomodoroPhase): void {
    this.pomodoro.setPhase(phase);
  }

  protected onTopicSelected(topicId: string): void {
    this.pomodoro.selectTopic(topicId || null);
  }

  protected onSessionTypeSelected(type: StudySessionType): void {
    this.pomodoro.setSessionType(type);
  }

  protected updateFocusMinutes(value: number): void {
    this.pomodoro.updateSettings({ focusMinutes: value });
  }

  protected updateShortBreakMinutes(value: number): void {
    this.pomodoro.updateSettings({ shortBreakMinutes: value });
  }

  protected updateLongBreakMinutes(value: number): void {
    this.pomodoro.updateSettings({ longBreakMinutes: value });
  }

  protected toggleSound(): void {
    this.pomodoro.updateSettings({ soundEnabled: !this.pomodoro.settings().soundEnabled });
  }

  protected async finishEarly(): Promise<void> {
    const saved = await this.pomodoro.finishAndLogEarly();
    if (saved) {
      this.snackBar.open(
        `Sesión registrada (+${saved.durationMinutes} min).`,
        'Cerrar',
        { duration: 3000 },
      );
    }
  }

  protected toggleManualLog(): void {
    this.showManualLog.update((v) => !v);
    if (this.showManualLog() && !this.manualTopicId()) {
      const firstTopic = this.pomodoro.selectedTopicId() ?? this.store.topics()[0]?.id ?? '';
      this.manualTopicId.set(firstTopic);
    }
  }

  protected async submitManualSession(): Promise<void> {
    const topic = this.topicMap().get(this.manualTopicId());
    const rawDuration = Number(this.manualDuration());
    if (!topic || !Number.isFinite(rawDuration) || rawDuration < 1) {
      return;
    }

    const duration = Math.min(600, Math.round(rawDuration));

    await this.store.addStudySession({
      topicId: topic.id,
      blockId: topic.blockId,
      durationMinutes: duration,
      type: this.manualType(),
    });

    this.showManualLog.set(false);
    this.snackBar.open(
      `Sesión manual registrada: ${this.formatDuration(duration)} en "${topic.title}".`,
      'Cerrar',
      { duration: 3000 },
    );
  }

  protected async deleteSession(session: StudySession): Promise<void> {
    await this.store.deleteStudySession(session.id);
    this.snackBar.open('Sesión eliminada del historial.', 'Cerrar', { duration: 2200 });
  }

  protected getTopicTitle(topicId: string): string {
    return this.topicMap().get(topicId)?.title ?? 'Tema eliminado';
  }

  protected getBlockColor(blockId: StudyBlockId): string {
    return this.blockMap().get(blockId)?.color ?? '#64748b';
  }
}
