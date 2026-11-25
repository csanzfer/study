import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChildren,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { GUIDE_SECTIONS, GuideSection, QUICK_START_STEPS } from './guide-sections.data';

@Component({
  selector: 'app-guide-page',
  imports: [RouterLink, MatButtonModule, MatIconModule],
  templateUrl: './guide-page.html',
})
export class GuidePage implements AfterViewInit {
  private readonly route = inject(ActivatedRoute);
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly quickStartSteps = QUICK_START_STEPS;
  protected readonly allSections = GUIDE_SECTIONS;
  protected readonly searchQuery = signal('');
  protected readonly activeSectionId = signal<string>(GUIDE_SECTIONS[0]?.id ?? '');

  private readonly sectionArticles = viewChildren<ElementRef<HTMLElement>>('sectionArticle');
  private readonly fragment = toSignal(this.route.fragment, { initialValue: null });

  private scrollContainer: HTMLElement | Window | null = null;
  private rafId: number | null = null;
  private ignoreScrollUntil = 0;

  protected readonly filteredSections = computed<GuideSection[]>(() => {
    const query = this.normalize(this.searchQuery());
    if (!query) {
      return this.allSections;
    }

    return this.allSections.filter((section) => {
      const searchable = [
        section.title,
        section.shortTitle,
        section.summary,
        section.tip ?? '',
        ...section.keywords,
        ...section.items.flatMap((item) => [item.title, item.description]),
      ]
        .map((text) => this.normalize(text))
        .join(' ');

      return searchable.includes(query);
    });
  });

  constructor() {
    effect(() => {
      const sections = this.filteredSections();
      if (sections.length === 0) {
        return;
      }

      const currentId = this.activeSectionId();
      if (!sections.some((section) => section.id === currentId)) {
        this.activeSectionId.set(sections[0].id);
      }
    });

    effect(() => {
      const targetId = this.fragment();
      if (!targetId) {
        return;
      }

      const exists = this.allSections.some((section) => section.id === targetId);
      if (exists) {
        this.activeSectionId.set(targetId);
        this.scrollToSection(targetId);
      }
    });
  }

  ngAfterViewInit(): void {
    this.setupScrollSpy();
  }

  protected onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchQuery.set(value);
  }

  protected clearSearch(): void {
    this.searchQuery.set('');
  }

  protected scrollToSection(sectionId: string): void {
    this.activeSectionId.set(sectionId);
    if (typeof document === 'undefined') {
      return;
    }

    this.ignoreScrollUntil = Date.now() + 650;

    requestAnimationFrame(() => {
      const element = document.getElementById(sectionId);
      element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  protected updateActiveSectionFromScroll(): void {
    if (Date.now() < this.ignoreScrollUntil) {
      return;
    }

    const articles = this.sectionArticles();
    if (articles.length === 0) {
      return;
    }

    const container = this.scrollContainer;
    const isElementContainer = container instanceof HTMLElement;
    const containerTop = isElementContainer ? container.getBoundingClientRect().top : 0;

    const isAtBottom = isElementContainer
      ? container.scrollTop > 0 &&
        container.scrollTop + container.clientHeight >= container.scrollHeight - 24
      : typeof window !== 'undefined' &&
        window.scrollY > 0 &&
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 24;

    if (isAtBottom) {
      const lastId = articles[articles.length - 1].nativeElement.id;
      if (lastId) {
        this.activeSectionId.set(lastId);
      }
      return;
    }

    const activationOffset = 140;
    let currentId = articles[0].nativeElement.id;

    for (const articleRef of articles) {
      const el = articleRef.nativeElement;
      const topRelativeToContainer = el.getBoundingClientRect().top - containerTop;
      if (topRelativeToContainer <= activationOffset) {
        currentId = el.id;
      } else {
        break;
      }
    }

    if (currentId && currentId !== this.activeSectionId()) {
      this.activeSectionId.set(currentId);
    }
  }

  private setupScrollSpy(): void {
    if (typeof window === 'undefined') {
      return;
    }

    const container = this.findScrollContainer(this.elementRef.nativeElement);
    this.scrollContainer = container;

    const onScroll = () => {
      if (this.rafId !== null) {
        return;
      }
      this.rafId = requestAnimationFrame(() => {
        this.rafId = null;
        this.updateActiveSectionFromScroll();
      });
    };

    container.addEventListener('scroll', onScroll, { passive: true });
    this.destroyRef.onDestroy(() => {
      container.removeEventListener('scroll', onScroll);
      if (this.rafId !== null) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
    });
  }

  private findScrollContainer(startEl: HTMLElement): HTMLElement | Window {
    let parent = startEl.parentElement;
    while (parent) {
      const style = window.getComputedStyle(parent);
      if (/(auto|scroll)/.test(style.overflowY)) {
        return parent;
      }
      parent = parent.parentElement;
    }
    return window;
  }

  private normalize(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }
}
