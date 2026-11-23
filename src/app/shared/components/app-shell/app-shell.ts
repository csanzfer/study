import { BreakpointObserver } from '@angular/cdk/layout';
import { DatePipe } from '@angular/common';
import { Component, ElementRef, computed, inject, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { map } from 'rxjs';
import { BackupService } from '../../../core/services/backup.service';
import { PomodoroService } from '../../../core/services/pomodoro.service';
import { SearchService } from '../../../core/services/search.service';
import { StudyStoreService } from '../../../core/services/study-store.service';
import { ThemeService } from '../../../core/services/theme.service';
import { GlobalSearchDialog } from '../global-search-dialog/global-search-dialog';

interface ToolNavItem {
  label: string;
  route: string;
  icon: string;
  phaseBadge?: string;
}

@Component({
  selector: 'app-shell',
  imports: [
    DatePipe,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    MatButtonModule,
    MatDialogModule,
    MatDividerModule,
    MatIconModule,
    MatMenuModule,
    MatSidenavModule,
    MatSnackBarModule,
    MatToolbarModule,
    MatTooltipModule,
  ],
  host: {
    '(window:keydown)': 'onGlobalKeydown($event)',
  },
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.scss',
})
export class AppShell {
  protected readonly store = inject(StudyStoreService);
  protected readonly theme = inject(ThemeService);
  protected readonly backup = inject(BackupService);
  protected readonly pomodoro = inject(PomodoroService);
  private readonly searchService = inject(SearchService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly breakpointObserver = inject(BreakpointObserver);

  private activeSearchDialogRef: MatDialogRef<GlobalSearchDialog> | null = null;
  protected readonly shortcutHint =
    typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent)
      ? '⌘K'
      : 'Ctrl K';

  protected readonly drawer = viewChild<MatSidenav>('drawer');
  protected readonly backupFileInput = viewChild<ElementRef<HTMLInputElement>>('backupFileInput');

  protected readonly isHandset = toSignal(
    this.breakpointObserver
      .observe('(max-width: 1023px)')
      .pipe(map((result) => result.matches)),
    { initialValue: false },
  );

  protected readonly isDark = computed(() => this.theme.mode() === 'dark');

  protected readonly upcomingTools: ToolNavItem[] = [
    { label: 'Esquemas', route: '/schemas', icon: 'account_tree' },
    { label: 'Planificador', route: '/planner', icon: 'view_kanban' },
    { label: 'Tests y Simulacros', route: '/tests', icon: 'quiz' },
    { label: 'Flashcards y Siglas', route: '/flashcards', icon: 'style' },
  ];

  protected closeDrawerOnMobile(): void {
    if (this.isHandset()) {
      void this.drawer()?.close();
    }
  }

  protected onGlobalKeydown(event: KeyboardEvent): void {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      if (this.activeSearchDialogRef) {
        this.activeSearchDialogRef.close();
      } else {
        this.openGlobalSearch();
      }
    }
  }

  protected openGlobalSearch(): void {
    if (this.activeSearchDialogRef) {
      return;
    }

    // Ensure search service is active before opening.
    void this.searchService.indexVersion();

    const ref = this.dialog.open(GlobalSearchDialog, {
      width: '640px',
      maxWidth: '94vw',
      autoFocus: false,
      position: { top: '8vh' },
    });

    this.activeSearchDialogRef = ref;
    ref.afterClosed().subscribe(() => {
      if (this.activeSearchDialogRef === ref) {
        this.activeSearchDialogRef = null;
      }
    });
  }

  protected async exportBackup(): Promise<void> {
    try {
      const payload = await this.backup.downloadBackup();
      this.snackBar.open(
        `Backup exportado (${payload.topics.length} temas).`,
        'Cerrar',
        { duration: 3500 },
      );
    } catch {
      this.snackBar.open('No se pudo exportar la copia de seguridad.', 'Cerrar', {
        duration: 4000,
      });
    }
  }

  protected triggerImportBackup(): void {
    this.backupFileInput()?.nativeElement.click();
  }

  protected async onBackupFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';

    if (!file) {
      return;
    }

    try {
      const result = await this.backup.importBackupFile(file);
      await this.store.refresh();
      this.snackBar.open(
        `Backup restaurado: ${result.blocksCount} bloques, ${result.topicsCount} temas y ${result.questionsCount} preguntas.`,
        'Cerrar',
        { duration: 4000 },
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error al importar el archivo de backup.';
      this.snackBar.open(message, 'Cerrar', { duration: 5000 });
    }
  }
}
