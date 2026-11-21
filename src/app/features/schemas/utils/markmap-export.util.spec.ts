import { describe, expect, it } from 'vitest';
import { buildStandaloneSvgString, slugifyExportFilename } from './markmap-export.util';

describe('markmap-export.util', () => {
  it('slugifies Spanish titles into clean filenames', () => {
    expect(slugifyExportFilename('Tema 1: Constitución Española (1978)')).toBe(
      'tema-1-constitucion-espanola-1978',
    );
    expect(slugifyExportFilename('   ')).toBe('esquema-tai');
  });

  it('builds a standalone SVG string with embedded style and themed background rect', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    svg.appendChild(group);

    const light = buildStandaloneSvgString(svg, false);
    expect(light.svgString).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(light.svgString).toContain('fill="#ffffff"');
    expect(light.svgString).toContain('.markmap-foreign');

    const dark = buildStandaloneSvgString(svg, true);
    expect(dark.svgString).toContain('fill="#0f172a"');
  });
});
