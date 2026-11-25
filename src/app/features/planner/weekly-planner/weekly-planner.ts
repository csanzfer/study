import {
  CdkDrag,
  CdkDragDrop,
  CdkDragPlaceholder,
  CdkDropList,
  CdkDropListGroup,
  moveItemInArray,
  transferArrayItem,
} from '@angular/cdk/drag-drop';
import { Component, computed, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import {
  IsoDayOfWeek,
  StudyBlock,
  StudyBlockId,
  Topic,
  WeeklyPlanItem,
} from '../../../core/models/study.models';
import { PomodoroService } from '../../../core/services/pomodoro.service';
import { StudyStoreService } from '../../../core/services/study-store.service';
import {
  formatWeekRangeLabel,
  getWeekDays,
  getWeekStartDate,
  shiftWeekStartDate,
} from '../../../shared/utils/week-date.util';

@Component({
  selector: 'app-weekly-planner',
  imports: [
    FormsModule,
    RouterLink,
    CdkDropListGroup,
    CdkDropList,
    CdkDrag,
    CdkDragPlaceholder,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    MatTooltipModule,
  ],
  templateUrl: './weekly-planner.html',
})
export class WeeklyPlanner {
  protected readonly store = inject(StudyStoreService);
  private readonly pomodoro = inject(PomodoroService);
  private readonly snackBar = inject(MatSnackBar);

  readonly startPomodoroForTopic = output<string>();

  protected readonly currentWeekStart = signal(getWeekStartDate());
  protected readonly addingToDay = signal<IsoDayOfWeek | null>(null);
  protected readonly pickerBlockFilter = signal<StudyBlockId | 'ALL'>('ALL');
  protected readonly pickerTopicId = signal('');
  protected readonly pickerTargetPomodoros = signal(2);

  protected readonly isCurrentWeek = computed(
    () => this.currentWeekStart() === getWeekStartDate(),
  );

  protected readonly weekRangeLabel = computed(() =>
    formatWeekRangeLabel(this.currentWeekStart()),
  );

  protected readonly weekDays = computed(() => getWeekDays(this.currentWeekStart()));

  protected readonly weekItems = computed(() =>
    this.store.getWeeklyPlanForWeek(this.currentWeekStart()),
  );

  protected readonly itemsByDay = computed(() => {
    const map: Record<IsoDayOfWeek, WeeklyPlanItem[]> = {
      1: [],
      2: [],
      3: [],
      4: [],
      5: [],
      6: [],
      7: [],
    };
    for (const item of this.weekItems()) {
      map[item.dayOfWeek].push(item);
    }
    return map;
  });

  protected readonly weeklyStats = computed(() => {
    const items = this.weekItems();
    const total = items.length;
    const completed = items.filter((i) => i.completed).length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, percent };
  });

  protected readonly blockMap = computed(() => {
    const map = new Map<StudyBlockId, StudyBlock>();
    for (const b of this.store.blocks()) {
      map.set(b.id, b);
    }
    return map;
  });

  protected readonly topicMap = computed(() => {
    const map = new Map<string, Topic>();
    for (const t of this.store.topics()) {
      map.set(t.id, t);
    }
    return map;
  });

  protected readonly pickerTopics = computed(() => {
    const filter = this.pickerBlockFilter();
    const list = this.store.topics();
    return filter === 'ALL' ? list : list.filter((t) => t.blockId === filter);
  });

  protected prevWeek(): void {
    this.currentWeekStart.update((w) => shiftWeekStartDate(w, -1));
    this.addingToDay.set(null);
  }

  protected nextWeek(): void {
    this.currentWeekStart.update((w) => shiftWeekStartDate(w, 1));
    this.addingToDay.set(null);
  }

  protected goToCurrentWeek(): void {
    this.currentWeekStart.set(getWeekStartDate());
    this.addingToDay.set(null);
  }

  protected openAddForm(day: IsoDayOfWeek): void {
    if (this.addingToDay() === day) {
      this.addingToDay.set(null);
      return;
    }
    this.addingToDay.set(day);
    const available = this.pickerTopics();
    if (available.length > 0 && !available.some((t) => t.id === this.pickerTopicId())) {
      this.pickerTopicId.set(available[0].id);
    }
  }

  protected onPickerBlockChange(block: StudyBlockId | 'ALL'): void {
    this.pickerBlockFilter.set(block);
    const available = this.pickerTopics();
    this.pickerTopicId.set(available[0]?.id ?? '');
  }

  protected async addTopicToDay(day: IsoDayOfWeek): Promise<void> {
    const topicId = this.pickerTopicId();
    const topic = this.topicMap().get(topicId);
    if (!topic) {
      return;
    }

    await this.store.addWeeklyPlanItem({
      weekStartDate: this.currentWeekStart(),
      dayOfWeek: day,
      topicId: topic.id,
      blockId: topic.blockId,
      targetPomodoros: Math.max(1, Math.min(12, Number(this.pickerTargetPomodoros()) || 1)),
    });

    this.addingToDay.set(null);
  }

  protected async toggleItem(item: WeeklyPlanItem): Promise<void> {
    const updated = await this.store.toggleWeeklyPlanItem(item.id);
    if (updated?.completed) {
      const title = this.getTopicTitle(item);
      this.snackBar.open(`Objetivo completado: "${title}" (repaso registrado).`, 'Cerrar', {
        duration: 2400,
      });
    }
  }

  protected async removeItem(item: WeeklyPlanItem): Promise<void> {
    await this.store.deleteWeeklyPlanItem(item.id);
  }

  protected launchPomodoro(item: WeeklyPlanItem): void {
    this.pomodoro.selectTopic(item.topicId);
    this.startPomodoroForTopic.emit(item.topicId);
  }

  protected async onDrop(
    event: CdkDragDrop<WeeklyPlanItem[]>,
    targetDay: IsoDayOfWeek,
  ): Promise<void> {
    const draggedItem = event.item.data as WeeklyPlanItem | undefined;
    if (!draggedItem) {
      return;
    }

    if (event.previousContainer === event.container) {
      if (event.previousIndex === event.currentIndex) {
        return;
      }
      const nextList = [...event.container.data];
      moveItemInArray(nextList, event.previousIndex, event.currentIndex);
      await this.store.moveWeeklyPlanItem(
        draggedItem.id,
        targetDay,
        nextList.map((i) => i.id),
      );
      return;
    }

    const sourceList = [...event.previousContainer.data];
    const targetList = [...event.container.data];
    transferArrayItem(sourceList, targetList, event.previousIndex, event.currentIndex);

    await this.store.moveWeeklyPlanItem(
      draggedItem.id,
      targetDay,
      targetList.map((i) => i.id),
    );
  }

  protected getTopicTitle(item: WeeklyPlanItem): string {
    return this.topicMap().get(item.topicId)?.title ?? 'Tema eliminado';
  }

  protected getBlockColor(blockId: StudyBlockId): string {
    return this.blockMap().get(blockId)?.color ?? '#64748b';
  }
}
