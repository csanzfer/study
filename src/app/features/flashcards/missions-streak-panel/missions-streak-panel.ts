import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { StudyStoreService } from '../../../core/services/study-store.service';
import { DailyMission } from '../utils/daily-missions.util';

@Component({
  selector: 'app-missions-streak-panel',
  imports: [RouterLink, MatButtonModule, MatIconModule, MatTooltipModule],
  templateUrl: './missions-streak-panel.html',
})
export class MissionsStreakPanel {
  protected readonly store = inject(StudyStoreService);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly weekDayChoices = [
    { day: 1, label: 'L' },
    { day: 2, label: 'M' },
    { day: 3, label: 'X' },
    { day: 4, label: 'J' },
    { day: 5, label: 'V' },
    { day: 6, label: 'S' },
    { day: 0, label: 'D' },
  ];

  protected isRestDay(day: number): boolean {
    return this.store.gamificationProfile().weeklyRestDays.includes(day);
  }

  protected async toggleRestDay(day: number): Promise<void> {
    const current = this.store.gamificationProfile().weeklyRestDays;
    const next = current.includes(day)
      ? current.filter((d) => d !== day)
      : [...current, day];
    await this.store.updateWeeklyRestDays(next);
  }

  protected async claimMission(mission: DailyMission): Promise<void> {
    const claimed = await this.store.claimMissionReward(mission.id);
    if (claimed) {
      this.snackBar.open(`¡Misión completada! +${mission.xpReward} XP`, 'Cerrar', {
        duration: 2800,
      });
    }
  }

  protected getMissionPercent(mission: DailyMission): number {
    if (mission.target <= 0) return 0;
    return Math.min(100, Math.round((mission.current / mission.target) * 100));
  }
}
