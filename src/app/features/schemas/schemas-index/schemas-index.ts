import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import {
  TOPIC_STATUS_LABELS,
  StudyBlockId,
  Topic,
} from '../../../core/models/study.models';
import { StudyStoreService } from '../../../core/services/study-store.service';
import {
  OutlineDepth,
  OutlineResult,
  tiptapJsonToOutlineMarkdown,
} from '../../../shared/utils/tiptap-outline.util';
import { MarkmapViewer } from '../components/markmap-viewer/markmap-viewer';

interface SchemaTopicItem {
  topic: Topic;
  blockCode: string;
  blockColor: string;
  outline: OutlineResult;
  markdown: string;
  hasSchema: boolean;
  isCustom: boolean;
}

@Component({
  selector: 'app-schemas-index',
  imports: [
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MarkmapViewer,
  ],
  templateUrl: './schemas-index.html',
})
export class SchemasIndex {
  protected readonly store = inject(StudyStoreService);

  protected readonly statusLabels = TOPIC_STATUS_LABELS;
  protected readonly selectedBlockId = signal<StudyBlockId | 'ALL'>('ALL');
  protected readonly filterText = signal('');
  protected readonly selectedTopicId = signal<string | null>(null);
  protected readonly outlineDepth = signal<OutlineDepth>('full');

  protected readonly blockLookup = computed(() => {
    const map = new Map<StudyBlockId, { code: string; color: string }>();
    for (const block of this.store.blocks()) {
      map.set(block.id, { code: block.code, color: block.color });
    }
    return map;
  });

  protected readonly filteredItems = computed<SchemaTopicItem[]>(() => {
    const blockFilter = this.selectedBlockId();
    const query = this.filterText().trim().toLowerCase();
    const blocks = this.blockLookup();
    const depth = this.outlineDepth();

    return this.store
      .topics()
      .filter((topic) => {
        if (blockFilter !== 'ALL' && topic.blockId !== blockFilter) {
          return false;
        }
        if (!query) {
          return true;
        }
        return (
          topic.title.toLowerCase().includes(query) ||
          topic.tags.some((tag) => tag.toLowerCase().includes(query))
        );
      })
      .sort((a, b) => {
        if (a.blockId !== b.blockId) {
          return a.blockId.localeCompare(b.blockId);
        }
        return a.order - b.order;
      })
      .map((topic) => {
        const block = blocks.get(topic.blockId);
        const customMd = topic.customOutlineMd?.trim() ?? '';
        const isCustom = customMd.length > 0;
        const outline = tiptapJsonToOutlineMarkdown(topic.contentJson, {
          depth,
          rootTitle: topic.title,
        });
        const markdown = isCustom ? customMd : outline.markdown;
        return {
          topic,
          blockCode: block?.code ?? topic.blockId,
          blockColor: block?.color ?? '#0891b2',
          outline,
          markdown,
          hasSchema: markdown.trim().length > 0,
          isCustom,
        };
      });
  });

  protected readonly structuredCount = computed(
    () => this.filteredItems().filter((item) => item.hasSchema).length,
  );

  protected readonly activeItem = computed<SchemaTopicItem | null>(() => {
    const items = this.filteredItems();
    if (items.length === 0) {
      return null;
    }

    const currentId = this.selectedTopicId();
    if (currentId) {
      const match = items.find((item) => item.topic.id === currentId);
      if (match) {
        return match;
      }
    }

    return items.find((item) => item.hasSchema) ?? items[0];
  });

  constructor() {
    effect(() => {
      const active = this.activeItem();
      if (active && this.selectedTopicId() !== active.topic.id) {
        this.selectedTopicId.set(active.topic.id);
      }
    });
  }

  protected selectBlock(blockId: StudyBlockId | 'ALL'): void {
    this.selectedBlockId.set(blockId);
  }

  protected selectTopic(topicId: string): void {
    this.selectedTopicId.set(topicId);
  }
}
