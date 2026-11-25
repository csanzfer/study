import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { StudyBlockId } from '../../../core/models/study.models';
import { StudyStoreService } from '../../../core/services/study-store.service';

@Component({
  selector: 'app-campaign-map',
  imports: [RouterLink, MatButtonModule, MatIconModule],
  templateUrl: './campaign-map.html',
})
export class CampaignMap {
  protected readonly store = inject(StudyStoreService);
  protected readonly collapsedBlocks = signal<Set<StudyBlockId>>(new Set());

  protected toggleBlock(blockId: StudyBlockId): void {
    this.collapsedBlocks.update((set) => {
      const next = new Set(set);
      if (next.has(blockId)) next.delete(blockId);
      else next.add(blockId);
      return next;
    });
  }

  protected isExpanded(blockId: StudyBlockId): boolean {
    return !this.collapsedBlocks().has(blockId);
  }
}
