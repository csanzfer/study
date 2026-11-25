import { Component, computed, inject, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { TOPIC_STATUS_LABELS, StudyBlock, Topic } from '../../../core/models/study.models';
import { StudyStoreService } from '../../../core/services/study-store.service';
import {
  TOPIC_HEALTH_LABELS,
  TOPIC_HEALTH_LEVELS,
  TopicHealthInfo,
  TopicHealthLevel,
  getTopicHealth,
} from '../../../shared/utils/topic-health.util';
import { getIsoDayOfWeek, getWeekStartDate } from '../../../shared/utils/week-date.util';

interface TopicWithHealth {
  topic: Topic;
  health: TopicHealthInfo;
}

interface BlockHealthSummary {
  block: StudyBlock;
  items: TopicWithHealth[];
  counts: Record<TopicHealthLevel, number>;
}

@Component({
  selector: 'app-health-heatmap',
  imports: [RouterLink, MatButtonModule, MatIconModule, MatSnackBarModule, MatTooltipModule],
  templateUrl: './health-heatmap.html',
})
export class HealthHeatmap {
  protected readonly store = inject(StudyStoreService);
  private readonly snackBar = inject(MatSnackBar);

  readonly navigateToWeekly = output<void>();

  protected readonly healthLevels = TOPIC_HEALTH_LEVELS;
  protected readonly healthLabels = TOPIC_HEALTH_LABELS;
  protected readonly statusLabels = TOPIC_STATUS_LABELS;

  protected readonly activeLevelFilter = signal<TopicHealthLevel | null>(null);

  protected readonly globalCounts = computed(() => {
    const counts: Record<TopicHealthLevel, number> = {
      fresh: 0,
      attention: 0,
      rusty: 0,
      critical: 0,
      unstarted: 0,
    };
    const now = new Date();
    for (const topic of this.store.topics()) {
      const level = getTopicHealth(topic, now).level;
      counts[level]++;
    }
    return counts;
  });

  protected readonly blockSummaries = computed<BlockHealthSummary[]>(() => {
    const now = new Date();
    return this.store.blocks().map((block) => {
      const blockTopics = this.store.getTopicsForBlock(block.id);
      const counts: Record<TopicHealthLevel, number> = {
        fresh: 0,
        attention: 0,
        rusty: 0,
        critical: 0,
        unstarted: 0,
      };
      const items = blockTopics.map((topic) => {
        const health = getTopicHealth(topic, now);
        counts[health.level]++;
        return { topic, health };
      });
      return { block, items, counts };
    });
  });

  protected readonly urgentTopics = computed(() => {
    const now = new Date();
    return this.store.rustyTopics().slice(0, 8).map((topic) => ({
      topic,
      health: getTopicHealth(topic, now),
      block: this.store.getBlockById(topic.blockId),
    }));
  });

  protected toggleLevelFilter(level: TopicHealthLevel): void {
    this.activeLevelFilter.update((current) => (current === level ? null : level));
  }

  protected getCellClass(level: TopicHealthLevel): string {
    switch (level) {
      case 'fresh':
        return 'bg-emerald-500 text-white hover:bg-emerald-600';
      case 'attention':
        return 'bg-amber-400 text-amber-950 hover:bg-amber-500';
      case 'rusty':
        return 'bg-orange-500 text-white hover:bg-orange-600';
      case 'critical':
        return 'bg-rose-500 text-white hover:bg-rose-600';
      case 'unstarted':
      default:
        return 'bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700';
    }
  }

  protected getLegendDotClass(level: TopicHealthLevel): string {
    switch (level) {
      case 'fresh':
        return 'bg-emerald-500';
      case 'attention':
        return 'bg-amber-400';
      case 'rusty':
        return 'bg-orange-500';
      case 'critical':
        return 'bg-rose-500';
      case 'unstarted':
      default:
        return 'bg-slate-300 dark:bg-slate-700';
    }
  }

  protected buildTooltip(item: TopicWithHealth): string {
    const status = this.statusLabels[item.topic.status];
    return `#${item.topic.order} ${item.topic.title} · ${status} · ${item.topic.roundCount} vueltas · ${item.health.shortAgeLabel}`;
  }

  protected async markReviewedToday(topic: Topic): Promise<void> {
    const updated = await this.store.logTopicReview(topic.id, false);
    if (updated) {
      this.snackBar.open(`"${topic.title}" marcado como repasado hoy.`, 'Cerrar', {
        duration: 2500,
      });
    }
  }

  protected async addToTodayPlan(topic: Topic): Promise<void> {
    const today = new Date();
    await this.store.addWeeklyPlanItem({
      weekStartDate: getWeekStartDate(today),
      dayOfWeek: getIsoDayOfWeek(today),
      topicId: topic.id,
      blockId: topic.blockId,
    });
    this.snackBar.open(`"${topic.title}" añadido al plan de hoy.`, 'Ver semana', {
      duration: 3200,
    }).onAction().subscribe(() => {
      this.navigateToWeekly.emit();
    });
  }
}
