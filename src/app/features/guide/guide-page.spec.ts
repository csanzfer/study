import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { GuidePage } from './guide-page';
import { GUIDE_SECTIONS } from './guide-sections.data';

describe('GuidePage', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GuidePage],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should render all user manual sections by default', () => {
    const fixture = TestBed.createComponent(GuidePage);
    fixture.detectChanges();

    const articles = fixture.nativeElement.querySelectorAll('article');
    expect(articles.length).toBe(GUIDE_SECTIONS.length);
  });

  it('should filter sections by keyword including accent-insensitive matches', () => {
    const fixture = TestBed.createComponent(GuidePage);
    fixture.detectChanges();

    const input: HTMLInputElement = fixture.nativeElement.querySelector('input[type="search"]');
    input.value = 'penalizacion';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const articles = fixture.nativeElement.querySelectorAll('article');
    expect(articles.length).toBe(1);
    expect(articles[0].id).toBe('tests');
  });

  it('should show empty state when no section matches and allow clearing the search', () => {
    const fixture = TestBed.createComponent(GuidePage);
    fixture.detectChanges();

    const input: HTMLInputElement = fixture.nativeElement.querySelector('input[type="search"]');
    input.value = 'termino-inexistente-xyz';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('article').length).toBe(0);
    expect(fixture.nativeElement.textContent).toContain('No se encontraron apartados');

    const resetBtn: HTMLButtonElement = fixture.nativeElement.querySelector('button[mat-stroked-button]');
    resetBtn.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('article').length).toBe(GUIDE_SECTIONS.length);
  });

  it('should update activeSectionId based on article positions during scroll', () => {
    const fixture = TestBed.createComponent(GuidePage);
    fixture.detectChanges();

    const articles: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('article'));
    articles.forEach((article, index) => {
      const top = index <= 3 ? -300 + index * 100 : 400 + index * 200;
      vi.spyOn(article, 'getBoundingClientRect').mockReturnValue({
        top,
        bottom: top + 200,
        left: 0,
        right: 500,
        width: 500,
        height: 200,
        x: 0,
        y: top,
        toJSON: () => ({}),
      });
    });

    (fixture.componentInstance as unknown as { updateActiveSectionFromScroll: () => void }).updateActiveSectionFromScroll();
    fixture.detectChanges();

    expect(
      (fixture.componentInstance as unknown as { activeSectionId: () => string }).activeSectionId(),
    ).toBe(GUIDE_SECTIONS[3].id);
  });
});
