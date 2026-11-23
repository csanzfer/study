import { Component, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { PomodoroService } from '../../../core/services/pomodoro.service';
import { StudyStoreService } from '../../../core/services/study-store.service';
import { formatMinutesAsHours } from '../../../shared/utils/week-date.util';
import { HealthHeatmap } from '../health-heatmap/health-heatmap';
import { KanbanBoard } from '../kanban-board/kanban-board';
import { PomodoroPanel } from '../pomodoro-panel/pomodoro-panel';
import { WeeklyPlanner } from '../weekly-planner/weekly-planner';

export type PlannerTab = 'kanban' | 'heatmap' | 'weekly' | 'pomodoro';

const VALID_TABS = new Set<PlannerTab>(['kanban', 'heatmap', 'weekly', 'pomodoro']);

interface PlannerTabMeta {
  id: PlannerTab;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-planner-page',
  imports: [MatIconModule, KanbanBoard, HealthHeatmap, WeeklyPlanner, PomodoroPanel],
  templateUrl: './planner-page.html',
})
export class PlannerPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly store = inject(StudyStoreService);
  protected readonly pomodoro = inject(PomodoroService);

  protected readonly tabs: PlannerTabMeta[] = [
    { id: 'kanban', label: 'Kanban de vueltas', icon: 'view_kanban' },
    { id: 'heatmap', label: 'Mapa de salud', icon: 'grid_view' },
    { id: 'weekly', label: 'Plan semanal', icon: 'calendar_month' },
    { id: 'pomodoro', label: 'Pomodoro y métricas', icon: 'timer' },
  ];

  private readonly tabQueryParam = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('tab'))),
    { initialValue: null },
  );

  protected readonly activeTab = signal<PlannerTab>('kanban');

  constructor() {
    effect(() => {
      const requested = this.tabQueryParam();
      if (requested && VALID_TABS.has(requested as PlannerTab)) {
        this.activeTab.set(requested as PlannerTab);
      }
    });
  }

  protected selectTab(tab: PlannerTab): void {
    this.activeTab.set(tab);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected onStartPomodoroForTopic(topicId: string): void {
    this.pomodoro.selectTopic(topicId);
    this.selectTab('pomodoro');
  }

  protected formatDuration(minutes: number): string {
    return formatMinutesAsHours(minutes);
  }
}
