import {
  CdkDrag,
  CdkDragDrop,
  CdkDragPlaceholder,
  CdkDropList,
  CdkDropListGroup,
} from '@angular/cdk/drag-drop';
import { Component, computed, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import {
  TOPIC_STATUS_LABELS,
  TOPIC_STATUS_LIST,
  StudyBlock,
  StudyBlockId,
  Topic,
  TopicStatus,
} from '../../../core/models/study.models';
import { PomodoroService } from '../../../core/services/pomodoro.service';
import { StudyStoreService } from '../../../core/services/study-store.service';
import { TopicHealthInfo, getTopicHealth } from '../../../shared/utils/topic-health.util';

interface KanbanColumnMeta {
  status: TopicStatus;
  label: string;
  accentClass: string;
  dotClass: string;
}

const KANBAN_COLUMNS: KanbanColumnMeta[] = [
  {
    status: 'pending',
    label: TOPIC_STATUS_LABELS.pending,
    accentClass: 'border-slate-200 dark:border-slate-800',
    dotClass: 'bg-slate-400',
  },
  {
    status: 'first_round',
    label: TOPIC_STATUS_LABELS.first_round,
    accentClass: 'border-blue-200/80 dark:border-blue-900/60',
    dotClass: 'bg-blue-500',
  },
  {
    status: 'outlined',
    label: TOPIC_STATUS_LABELS.outlined,
    accentClass: 'border-violet-200/80 dark:border-violet-900/60',
    dotClass: 'bg-violet-500',
  },
  {
    status: 'memorizing',
    label: TOPIC_STATUS_LABELS.memorizing,
    accentClass: 'border-amber-200/80 dark:border-amber-900/60',
    dotClass: 'bg-amber-500',
  },
  {
    status: 'mastered',
    label: TOPIC_STATUS_LABELS.mastered,
    accentClass: 'border-emerald-200/80 dark:border-emerald-900/60',
    dotClass: 'bg-emerald-500',
  },
];

@Component({
  selector: 'app-kanban-board',
  imports: [
    FormsModule,
    RouterLink,
    CdkDropListGroup,
    CdkDropList,
    CdkDrag,
    CdkDragPlaceholder,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatSnackBarModule,
    MatTooltipModule,
  ],
  templateUrl: './kanban-board.html',
})
export class KanbanBoard {
  protected readonly store = inject(StudyStoreService);
  private readonly pomodoro = inject(PomodoroService);
  private readonly snackBar = inject(MatSnackBar);

  readonly startPomodoroForTopic = output<string>();

  protected readonly columns = KANBAN_COLUMNS;
  protected readonly statusList = TOPIC_STATUS_LIST;
  protected readonly statusLabels = TOPIC_STATUS_LABELS;

  protected readonly selectedBlock = signal<StudyBlockId | 'ALL'>('ALL');
  protected readonly filterQuery = signal('');
  protected readonly onlyRusty = signal(false);

  protected readonly blockMap = computed(() => {
    const map = new Map<StudyBlockId, StudyBlock>();
    for (const block of this.store.blocks()) {
      map.set(block.id, block);
    }
    return map;
  });

  protected readonly filteredTopics = computed(() => {
    const blockFilter = this.selectedBlock();
    const query = this.filterQuery().trim().toLowerCase();
    const rustyOnly = this.onlyRusty();
    const now = new Date();

    return this.store.topics().filter((topic) => {
      if (blockFilter !== 'ALL' && topic.blockId !== blockFilter) {
        return false;
      }
      if (rustyOnly && !getTopicHealth(topic, now).needsReview) {
        return false;
      }
      if (query) {
        const matchesTitle = topic.title.toLowerCase().includes(query);
        const matchesTag = topic.tags.some((t) => t.toLowerCase().includes(query));
        if (!matchesTitle && !matchesTag) {
          return false;
        }
      }
      return true;
    });
  });

  protected readonly topicsByStatus = computed(() => {
    const grouped: Record<TopicStatus, Topic[]> = {
      pending: [],
      first_round: [],
      outlined: [],
      memorizing: [],
      mastered: [],
    };
    for (const topic of this.filteredTopics()) {
      grouped[topic.status].push(topic);
    }
    return grouped;
  });

  protected getBlockColor(blockId: StudyBlockId): string {
    return this.blockMap().get(blockId)?.color ?? '#64748b';
  }

  protected getBlockCode(blockId: StudyBlockId): string {
    return this.blockMap().get(blockId)?.id ?? blockId;
  }

  protected getHealth(topic: Topic): TopicHealthInfo {
    return getTopicHealth(topic);
  }

  protected getHealthBadgeClass(level: TopicHealthInfo['level']): string {
    switch (level) {
      case 'fresh':
        return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300';
      case 'attention':
        return 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300';
      case 'rusty':
        return 'bg-orange-50 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300';
      case 'critical':
        return 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300';
      case 'unstarted':
      default:
        return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
    }
  }

  protected async onDrop(event: CdkDragDrop<Topic[]>, targetStatus: TopicStatus): Promise<void> {
    const topic = event.item.data as Topic | undefined;
    if (!topic || topic.status === targetStatus) {
      return;
    }

    await this.changeTopicStatus(topic, targetStatus);
  }

  protected async changeTopicStatus(topic: Topic, targetStatus: TopicStatus): Promise<void> {
    if (topic.status === targetStatus) {
      return;
    }

    const result = await this.store.moveTopicStatus(topic.id, targetStatus);
    if (!result) {
      return;
    }

    if (result.roundIncremented) {
      this.snackBar.open(
        `"${topic.title}" dominado · Vuelta #${result.topic.roundCount} registrada.`,
        'Cerrar',
        { duration: 3500 },
      );
    } else {
      this.snackBar.open(
        `"${topic.title}" movido a ${this.statusLabels[targetStatus]}.`,
        'Cerrar',
        { duration: 2200 },
      );
    }
  }

  protected async logExtraRound(topic: Topic): Promise<void> {
    const updated = await this.store.logTopicReview(topic.id, true);
    if (updated) {
      this.snackBar.open(
        `Repaso registrado en "${topic.title}" (Vuelta #${updated.roundCount}).`,
        'Cerrar',
        { duration: 2800 },
      );
    }
  }

  protected launchPomodoro(topic: Topic): void {
    this.pomodoro.selectTopic(topic.id);
    this.startPomodoroForTopic.emit(topic.id);
  }
}
