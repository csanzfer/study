import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { TaiBlockId } from '../../../core/models/study.models';
import { StudyStoreService } from '../../../core/services/study-store.service';

@Component({
  selector: 'app-campaign-map',
  imports: [RouterLink, MatButtonModule, MatIconModule],
  templateUrl: './campaign-map.html',
})
export class CampaignMap {
  protected readonly store = inject(StudyStoreService);
  protected readonly expandedBlocks = signal<Set<TaiBlockId>>(new Set(['B1', 'B2', 'B3', 'B4']));

  protected toggleBlock(blockId: TaiBlockId): void {
    this.expandedBlocks.update((set) => {
      const next = new Set(set);
      if (next.has(blockId)) next.delete(blockId);
      else next.add(blockId);
      return next;
    });
  }

  protected isExpanded(blockId: TaiBlockId): boolean {
    return this.expandedBlocks().has(blockId);
  }
}
