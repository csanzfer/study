import { BreakpointObserver } from '@angular/cdk/layout';
import { DatePipe } from '@angular/common';
import { Component, ElementRef, computed, effect, inject, viewChild } from '@angular/core';
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
import { firstValueFrom, map } from 'rxjs';
import { CreateBlockInput, InitialSyncStrategy } from '../../../core/models/study.models';
import { BackupService } from '../../../core/services/backup.service';
import { PomodoroService } from '../../../core/services/pomodoro.service';
import { SearchService } from '../../../core/services/search.service';
import { StudyStoreService } from '../../../core/services/study-store.service';
import { SupabaseAuthService } from '../../../core/services/supabase-auth.service';
import { SupabaseSyncService } from '../../../core/services/supabase-sync.service';
import { ThemeService } from '../../../core/services/theme.service';
import {
  BlockEditorDialog,
  BlockEditorDialogData,
} from '../block-editor-dialog/block-editor-dialog';
import { GlobalSearchDialog } from '../global-search-dialog/global-search-dialog';
import {
  AuthDialog,
  AuthDialogData,
  AuthDialogResult,
} from '../sync-dialogs/auth-dialog';
import {
  InitialSyncDialog,
  InitialSyncDialogData,
} from '../sync-dialogs/initial-sync-dialog';
import { LogoutDialog, LogoutDialogResult } from '../sync-dialogs/logout-dialog';

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
  protected readonly auth = inject(SupabaseAuthService);
  protected readonly sync = inject(SupabaseSyncService);
  private readonly searchService = inject(SearchService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly breakpointObserver = inject(BreakpointObserver);

  private activeSearchDialogRef: MatDialogRef<GlobalSearchDialog> | null = null;
  private passwordSetupDialogOpen = false;

  protected readonly syncStatusLabel = computed(() => {
    if (!this.auth.isAuthenticated()) {
      return 'Local-First · Offline';
    }
    switch (this.sync.status()) {
      case 'syncing':
        return 'Sincronizando...';
      case 'offline_pending':
        return this.sync.pendingCount() > 0
          ? `Offline · ${this.sync.pendingCount()} pend.`
          : 'Sin conexión · Offline';
      case 'error':
        return 'Error de sincronización';
      default:
        return 'Sincronizado en la nube';
    }
  });

  constructor() {
    effect(() => {
      if (this.auth.needsPasswordSetup() && !this.passwordSetupDialogOpen) {
        this.passwordSetupDialogOpen = true;
        void this.openPasswordSetupDialog();
      }
    });
  }
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

  protected async openCreateBlockDialog(): Promise<void> {
    const dialogRef = this.dialog.open<
      BlockEditorDialog,
      BlockEditorDialogData,
      CreateBlockInput
    >(BlockEditorDialog, {
      width: '560px',
      maxWidth: '95vw',
      data: {},
    });

    const result = await firstValueFrom(dialogRef.afterClosed());
    if (!result) {
      return;
    }

    const created = await this.store.createBlock(result);
    this.closeDrawerOnMobile();
    this.snackBar.open(`Asignatura "${created.title}" creada.`, 'Cerrar', { duration: 3000 });
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

  protected async openLoginDialog(): Promise<void> {
    const dialogRef = this.dialog.open<AuthDialog, AuthDialogData, AuthDialogResult>(AuthDialog, {
      width: '440px',
      maxWidth: '94vw',
      data: { initialMode: 'login' },
    });

    const result = await firstValueFrom(dialogRef.afterClosed());
    if (result?.authenticated) {
      await this.runPostLoginSync();
    }
  }

  protected async openPasswordSetupDialog(): Promise<void> {
    try {
      const dialogRef = this.dialog.open<AuthDialog, AuthDialogData, AuthDialogResult>(AuthDialog, {
        width: '440px',
        maxWidth: '94vw',
        data: { initialMode: 'set_password' },
      });

      const result = await firstValueFrom(dialogRef.afterClosed());
      if (result?.passwordUpdated) {
        this.snackBar.open('Contraseña actualizada correctamente.', 'Cerrar', { duration: 3500 });
        if (this.auth.isAuthenticated()) {
          await this.runPostLoginSync();
        }
      }
    } finally {
      this.passwordSetupDialogOpen = false;
    }
  }

  protected async triggerManualSync(): Promise<void> {
    const ok = await this.sync.syncNow();
    if (ok) {
      this.snackBar.open('Datos sincronizados correctamente.', 'Cerrar', { duration: 2500 });
    } else if (this.sync.lastError()) {
      this.snackBar.open(`Error al sincronizar: ${this.sync.lastError()}`, 'Cerrar', {
        duration: 4500,
      });
    } else if (!this.sync.isOnline()) {
      this.snackBar.open('Sin conexión. Tus cambios se subirán al volver a estar online.', 'Cerrar', {
        duration: 3500,
      });
    }
  }

  protected async openLogoutDialog(): Promise<void> {
    const dialogRef = this.dialog.open<LogoutDialog, unknown, LogoutDialogResult>(LogoutDialog, {
      width: '460px',
      maxWidth: '94vw',
    });

    const choice = await firstValueFrom(dialogRef.afterClosed());
    if (!choice) {
      return;
    }

    await this.sync.signOutAndCleanup(choice === 'clear_local');
    this.snackBar.open(
      choice === 'clear_local'
        ? 'Sesión cerrada y datos locales borrados.'
        : 'Sesión cerrada. Conservas tus datos en modo local.',
      'Cerrar',
      { duration: 3500 },
    );
  }

  private async runPostLoginSync(): Promise<void> {
    const userId = this.auth.userId();
    const userEmail = this.auth.userEmail() ?? '';
    if (!userId) {
      return;
    }

    try {
      const assessment = await this.sync.assessInitialSync(userId);
      let strategy: InitialSyncStrategy | undefined;

      if (assessment.isDifferentUser || (assessment.hasLocalData && assessment.hasCloudData)) {
        const dialogRef = this.dialog.open<
          InitialSyncDialog,
          InitialSyncDialogData,
          InitialSyncStrategy | undefined
        >(InitialSyncDialog, {
          width: '500px',
          maxWidth: '94vw',
          disableClose: true,
          data: { assessment, userEmail },
        });
        strategy = await firstValueFrom(dialogRef.afterClosed());
      } else if (assessment.hasCloudData && !assessment.hasLocalData) {
        strategy = 'use_cloud';
      } else if (assessment.hasLocalData && !assessment.hasCloudData) {
        strategy = 'upload_local';
      } else {
        strategy = 'merge';
      }

      if (!strategy) {
        return;
      }

      const ok = await this.sync.executeInitialSync(strategy);
      if (ok) {
        this.snackBar.open('Sincronización completada con tu cuenta.', 'Cerrar', { duration: 3000 });
      } else {
        this.snackBar.open(
          this.sync.lastError() ?? 'No se pudo completar la sincronización inicial.',
          'Cerrar',
          { duration: 4500 },
        );
      }
    } catch {
      this.snackBar.open('Error al comprobar el estado de sincronización.', 'Cerrar', {
        duration: 4500,
      });
    }
  }
}
