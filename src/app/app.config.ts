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
import {
  IndexedDbStudyRepository,
  STUDY_REPOSITORY,
} from './core/repositories/study.repository';
import { StudyStoreService } from './core/services/study-store.service';
import { ThemeService } from './core/services/theme.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    {
  provide: STUDY_REPOSITORY,
    useExisting: IndexedDbStudyRepository,
    },
provideAppInitializer(() => {
  inject(ThemeService);
  return inject(StudyStoreService).initialize();
}),
  provideServiceWorker('ngsw-worker.js', {
    enabled: !isDevMode(),
    registrationStrategy: 'registerWhenStable:30000',
  }),
  ],
};
