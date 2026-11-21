import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  ViewEncapsulation,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { Transformer } from 'markmap-lib';
import { Markmap, deriveOptions } from 'markmap-view';
import { ThemeService } from '../../../../core/services/theme.service';

const LIGHT_BRANCH_COLORS = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#e11d48', '#0891b2'];
const DARK_BRANCH_COLORS = ['#60a5fa', '#34d399', '#fbbf24', '#a78bfa', '#fb7185', '#22d3ee'];

@Component({
  selector: 'app-markmap-viewer',
  imports: [MatIconModule],
  templateUrl: './markmap-viewer.html',
  styleUrl: './markmap-viewer.scss',
  encapsulation: ViewEncapsulation.None,
})
export class MarkmapViewer implements AfterViewInit {
  private readonly themeService = inject(ThemeService);
  private readonly destroyRef = inject(DestroyRef);

  readonly markdown = input<string>('');
  readonly minHeight = input<string>('520px');
  readonly emptyTitle = input<string>('Todavía no hay estructura para generar el mapa mental');
  readonly emptyHint = input<string>(
    'Añade encabezados (H1–H4), listas o bloques "Ojo examen" en el editor para visualizar el esquema automáticamente.',
  );

  private readonly containerRef = viewChild<ElementRef<HTMLDivElement>>('container');
  private readonly svgRef = viewChild<ElementRef<SVGSVGElement>>('svgEl');

  protected readonly hasContent = computed(() => this.markdown().trim().length > 0);
  protected readonly isDark = computed(() => this.themeService.mode() === 'dark');

  private readonly viewReady = signal(false);
  private readonly transformer = new Transformer();
  private markmap: Markmap | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private resizeRafId: number | null = null;

  constructor() {
    effect(() => {
      const ready = this.viewReady();
      const md = this.markdown().trim();
      const dark = this.isDark();

      if (!ready) {
        return;
      }

      if (!md) {
        this.destroyMarkmap();
        return;
      }

      this.renderMarkdown(md, dark);
    });

    this.destroyRef.onDestroy(() => {
      if (this.resizeRafId !== null && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(this.resizeRafId);
        this.resizeRafId = null;
      }
      this.resizeObserver?.disconnect();
      this.resizeObserver = null;
      this.destroyMarkmap();
    });
  }

  ngAfterViewInit(): void {
    this.viewReady.set(true);

    const container = this.containerRef()?.nativeElement;
    if (container && typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver((entries) => {
        const rect = entries[0]?.contentRect;
        if (!rect || rect.width === 0 || rect.height === 0 || !this.markmap) {
          return;
        }
        if (this.resizeRafId !== null && typeof cancelAnimationFrame === 'function') {
          cancelAnimationFrame(this.resizeRafId);
        }
        if (typeof requestAnimationFrame === 'function') {
          this.resizeRafId = requestAnimationFrame(() => {
            this.resizeRafId = null;
            void this.markmap?.fit();
          });
        } else {
          void this.markmap?.fit();
        }
      });
      this.resizeObserver.observe(container);
    }
  }

  fit(): void {
    void this.markmap?.fit();
  }

  zoomIn(): void {
    void this.markmap?.rescale(1.25);
  }

  zoomOut(): void {
    void this.markmap?.rescale(0.8);
  }

  getSvgElement(): SVGSVGElement | null {
    return this.svgRef()?.nativeElement ?? null;
  }

  private renderMarkdown(md: string, dark: boolean): void {
    const svg = this.svgRef()?.nativeElement;
    if (!svg) {
      return;
    }

    const { root } = this.transformer.transform(md);
    const options = deriveOptions({
      color: dark ? DARK_BRANCH_COLORS : LIGHT_BRANCH_COLORS,
      colorFreezeLevel: 2,
      duration: 240,
      maxWidth: 280,
      paddingX: 14,
      spacingVertical: 6,
      spacingHorizontal: 72,
      fitRatio: 0.92,
    });

    if (!this.markmap) {
      this.markmap = Markmap.create(svg, options, root);
    } else {
      this.markmap.setOptions(options);
      this.markmap.setData(root);
    }

    // Fit on next frame so SVG dimensions are settled after layout/tab switches.
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => {
        void this.markmap?.fit();
      });
    } else {
      void this.markmap.fit();
    }
  }

  private destroyMarkmap(): void {
    if (this.markmap) {
      this.markmap.destroy();
      this.markmap = null;
    }
    const svg = this.svgRef()?.nativeElement;
    if (svg) {
      svg.innerHTML = '';
    }
  }
}
