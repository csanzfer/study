import {
  ApplicationConfig,
  inject,
  isDevMode,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { routes } from './app.routes';
import { STUDY_REPOSITORY } from './core/repositories/study.repository';
import { SyncingStudyRepository } from './core/repositories/syncing-study.repository';
import { StudyStoreService } from './core/services/study-store.service';
import { SupabaseAuthService } from './core/services/supabase-auth.service';
import { SupabaseSyncService } from './core/services/supabase-sync.service';
import { ThemeService } from './core/services/theme.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    {
      provide: STUDY_REPOSITORY,
      useExisting: SyncingStudyRepository,
    },
    provideAppInitializer(async () => {
      inject(ThemeService);
      const store = inject(StudyStoreService);
      const auth = inject(SupabaseAuthService);
      const sync = inject(SupabaseSyncService);
      await store.initialize();
      await auth.initialize();
      void sync.initialize();
    }),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
