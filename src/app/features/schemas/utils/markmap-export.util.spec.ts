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
    const existingStyle = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    existingStyle.textContent = '.markmap-node > circle { fill: var(--markmap-circle-open-bg); }';
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    svg.appendChild(existingStyle);
    svg.appendChild(group);

    const light = buildStandaloneSvgString(svg, false);
    expect(light.svgString).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(light.svgString).toContain('fill="#ffffff"');
    expect(light.svgString).toContain('.markmap-foreign');
    expect(light.svgString).toContain('--markmap-text-color: #0f172a');
    expect(light.svgString.indexOf('--markmap-circle-open-bg: #ffffff')).toBeGreaterThan(
      light.svgString.indexOf('var(--markmap-circle-open-bg)'),
    );

    const dark = buildStandaloneSvgString(svg, true);
    expect(dark.svgString).toContain('fill="#0f172a"');
    expect(dark.svgString).toContain('--markmap-text-color: #e2e8f0');
  });
});
