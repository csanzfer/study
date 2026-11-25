import { DOCUMENT } from '@angular/common';
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
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Transformer } from 'markmap-lib';
import { Markmap, deriveOptions } from 'markmap-view';
import { ThemeService } from '../../../../core/services/theme.service';
import { OutlineDepth } from '../../../../shared/utils/tiptap-outline.util';
import { exportMarkmapToPng, exportMarkmapToSvg } from '../../utils/markmap-export.util';
import { ActiveRecallFoldMode, applyFoldMode } from '../../utils/markmap-fold.util';

const LIGHT_BRANCH_COLORS = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#e11d48', '#0891b2'];
const DARK_BRANCH_COLORS = ['#60a5fa', '#34d399', '#fbbf24', '#a78bfa', '#fb7185', '#22d3ee'];

type MarkmapRootNode = ReturnType<Transformer['transform']>['root'];

export const OUTLINE_DEPTH_OPTIONS: { value: OutlineDepth; label: string }[] = [
  { value: 'headings-h2', label: 'Solo títulos (H1–H2)' },
  { value: 'headings-h3', label: 'Hasta H3' },
  { value: 'headings-all', label: 'Todos los títulos (H1–H4)' },
  { value: 'full', label: 'Completo con viñetas' },
];

@Component({
  selector: 'app-markmap-viewer',
  imports: [
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    MatTooltipModule,
  ],
  templateUrl: './markmap-viewer.html',
  styleUrl: './markmap-viewer.scss',
  encapsulation: ViewEncapsulation.None,
})
export class MarkmapViewer implements AfterViewInit {
  private readonly document = inject(DOCUMENT);
  private readonly themeService = inject(ThemeService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly markdown = input<string>('');
  readonly minHeight = input<string>('520px');
  readonly exportTitle = input<string>('esquema');
  readonly showToolbar = input<boolean>(true);
  readonly showDepthSelector = input<boolean>(false);
  readonly depth = input<OutlineDepth>('full');
  readonly emptyTitle = input<string>('Todavía no hay estructura para generar el mapa mental');
  readonly emptyHint = input<string>(
    'Añade encabezados (H1–H4), listas o bloques "Ojo examen" en el editor para visualizar el esquema automáticamente.',
  );

  readonly depthChange = output<OutlineDepth>();

  private readonly shellRef = viewChild<ElementRef<HTMLDivElement>>('shellEl');
  private readonly containerRef = viewChild<ElementRef<HTMLDivElement>>('container');
  private readonly svgRef = viewChild<ElementRef<SVGSVGElement>>('svgEl');

  protected readonly depthOptions = OUTLINE_DEPTH_OPTIONS;
  protected readonly hasContent = computed(() => this.markdown().trim().length > 0);
  protected readonly isDark = computed(() => this.themeService.mode() === 'dark');
  protected readonly activeFoldMode = signal<ActiveRecallFoldMode>('expand-all');
  protected readonly isFullscreen = signal(false);
  protected readonly isExportingPng = signal(false);

  private readonly viewReady = signal(false);
  private readonly transformer = new Transformer();
  private markmap: Markmap | null = null;
  private currentRoot: MarkmapRootNode | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private resizeRafId: number | null = null;

  private readonly onFullscreenChange = () => {
    const shell = this.shellRef()?.nativeElement;
    const active = Boolean(shell && this.document.fullscreenElement === shell);
    this.isFullscreen.set(active);
    if (this.markmap) {
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => void this.markmap?.fit());
      } else {
        void this.markmap.fit();
      }
    }
  };

  constructor() {
    effect(() => {
      const ready = this.viewReady();
      const md = this.markdown().trim();
      const dark = this.isDark();

      if (!ready) {
        return;
      }

      if (!md) {
        this.currentRoot = null;
        this.destroyMarkmap();
        return;
      }

      this.renderMarkdown(md, dark);
    });

    this.document.addEventListener('fullscreenchange', this.onFullscreenChange);

    this.destroyRef.onDestroy(() => {
      this.document.removeEventListener('fullscreenchange', this.onFullscreenChange);
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

  setFoldMode(mode: ActiveRecallFoldMode): void {
    this.activeFoldMode.set(mode);
    if (!this.markmap || !this.currentRoot) {
      return;
    }

    applyFoldMode(this.currentRoot, mode);
    this.markmap.setData(this.currentRoot);
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => void this.markmap?.fit());
    } else {
      void this.markmap.fit();
    }
  }

  async toggleFullscreen(): Promise<void> {
    const shell = this.shellRef()?.nativeElement;
    if (!shell) {
      return;
    }

    try {
      if (this.document.fullscreenElement === shell) {
        await this.document.exitFullscreen();
      } else if (typeof shell.requestFullscreen === 'function') {
        await shell.requestFullscreen();
      }
    } catch {
      this.snackBar.open('No se pudo cambiar a pantalla completa.', 'Cerrar', { duration: 2200 });
    }
  }

  exportSvg(): void {
    const svg = this.svgRef()?.nativeElement;
    if (!svg || !this.hasContent()) {
      return;
    }

    try {
      exportMarkmapToSvg(svg, this.exportTitle(), this.isDark());
      this.snackBar.open('Esquema exportado en formato SVG.', 'Cerrar', { duration: 2000 });
    } catch {
      this.snackBar.open('Error al exportar el esquema a SVG.', 'Cerrar', { duration: 2500 });
    }
  }

  async exportPng(): Promise<void> {
    const svg = this.svgRef()?.nativeElement;
    if (!svg || !this.hasContent() || this.isExportingPng()) {
      return;
    }

    this.isExportingPng.set(true);
    try {
      await exportMarkmapToPng(svg, this.exportTitle(), this.isDark(), 2);
      this.snackBar.open('Esquema exportado en formato PNG (2x).', 'Cerrar', { duration: 2000 });
    } catch {
      this.snackBar.open('Error al exportar el esquema a PNG.', 'Cerrar', { duration: 2500 });
    } finally {
      this.isExportingPng.set(false);
    }
  }

  getSvgElement(): SVGSVGElement | null {
    return this.svgRef()?.nativeElement ?? null;
  }

  protected onDepthSelect(value: OutlineDepth): void {
    this.depthChange.emit(value);
  }

  private renderMarkdown(md: string, dark: boolean): void {
    const svg = this.svgRef()?.nativeElement;
    if (!svg) {
      return;
    }

    const { root } = this.transformer.transform(md);
    applyFoldMode(root, this.activeFoldMode());
    this.currentRoot = root;

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
