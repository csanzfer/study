import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, RouterLink } from '@angular/router';

interface ComingSoonData {
  title?: string;
  phase?: string;
  description?: string;
  icon?: string;
}

@Component({
  selector: 'app-coming-soon',
  imports: [RouterLink, MatButtonModule, MatIconModule],
  template: `
    <section class="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xs dark:border-slate-800 dark:bg-slate-900">
      <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/70 dark:text-blue-400">
        <mat-icon class="!h-7 !w-7 !text-[28px]">{{ data().icon ?? 'construction' }}</mat-icon>
      </div>
      <span class="mt-4 inline-block rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
        Planificado para {{ data().phase ?? 'próxima fase' }}
      </span>
      <h1 class="mt-3 text-xl font-bold text-slate-900 dark:text-white">
        {{ data().title ?? 'Módulo en preparación' }}
      </h1>
      <p class="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
        {{ data().description }}
      </p>
      <div class="mt-6">
        <a routerLink="/dashboard" mat-flat-button>
          <mat-icon>arrow_back</mat-icon>
          Volver al panel principal
        </a>
      </div>
    </section>
  `,
})
export class ComingSoon {
  private readonly route = inject(ActivatedRoute);
  protected readonly data = toSignal(this.route.data, { initialValue: {} as ComingSoonData });
}
