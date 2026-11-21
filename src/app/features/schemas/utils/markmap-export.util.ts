const EXPORT_PADDING = 32;

export function slugifyExportFilename(title: string, fallback = 'esquema-tai'): string {
  const slug = title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);

  return slug || fallback;
}

export function buildStandaloneSvgString(
  svgElement: SVGSVGElement,
  isDark: boolean,
): { svgString: string; width: number; height: number } {
  const clone = svgElement.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  clone.removeAttribute('class');

  const rect = svgElement.getBoundingClientRect();
  let width = Math.max(Math.round(rect.width), 960);
  let height = Math.max(Math.round(rect.height), 540);
  let viewBox = `0 0 ${width} ${height}`;

  const contentGroup = svgElement.querySelector('g');
  if (contentGroup && typeof contentGroup.getBBox === 'function') {
    try {
      const bbox = contentGroup.getBBox();
      if (bbox.width > 0 && bbox.height > 0) {
        const clonedGroup = clone.querySelector('g');
        if (clonedGroup) {
          clonedGroup.removeAttribute('transform');
        }
        const vbX = Math.floor(bbox.x - EXPORT_PADDING);
        const vbY = Math.floor(bbox.y - EXPORT_PADDING);
        width = Math.ceil(bbox.width + EXPORT_PADDING * 2);
        height = Math.ceil(bbox.height + EXPORT_PADDING * 2);
        viewBox = `${vbX} ${vbY} ${width} ${height}`;
      }
    } catch {
      // Fallback to SVG bounding rect when getBBox is unavailable.
    }
  }

  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));
  clone.setAttribute('viewBox', viewBox);

  const bgColor = isDark ? '#0f172a' : '#ffffff';
  const textColor = isDark ? '#e2e8f0' : '#0f172a';
  const codeBg = isDark ? '#1e293b' : '#e2e8f0';
  const codeColor = isDark ? '#f8fafc' : '#0f172a';
  const circleBg = isDark ? '#0f172a' : '#ffffff';

  const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  styleEl.textContent = `
    svg {
      background: ${bgColor};
      color: ${textColor};
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, sans-serif;
    }
    .markmap-foreign {
      color: ${textColor};
      font: 500 14px / 1.45 Inter, ui-sans-serif, system-ui, -apple-system, sans-serif;
    }
    .markmap-foreign strong {
      font-weight: 700;
    }
    .markmap-foreign code {
      background-color: ${codeBg};
      color: ${codeColor};
      border-radius: 4px;
      padding: 0.08rem 0.3rem;
      font-size: 0.85em;
    }
    .markmap-node > circle {
      fill: ${circleBg};
      stroke-width: 2;
    }
  `;

  const [vbX, vbY] = viewBox.split(' ').map((part) => Number(part) || 0);
  const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bgRect.setAttribute('x', String(vbX));
  bgRect.setAttribute('y', String(vbY));
  bgRect.setAttribute('width', String(width));
  bgRect.setAttribute('height', String(height));
  bgRect.setAttribute('fill', bgColor);

  clone.insertBefore(bgRect, clone.firstChild);
  clone.insertBefore(styleEl, clone.firstChild);

  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(clone);

  return { svgString, width, height };
}

export function exportMarkmapToSvg(
  svgElement: SVGSVGElement,
  title: string,
  isDark: boolean,
): void {
  const { svgString } = buildStandaloneSvgString(svgElement, isDark);
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const filename = `${slugifyExportFilename(title)}.svg`;
  triggerBlobDownload(blob, filename);
}

export async function exportMarkmapToPng(
  svgElement: SVGSVGElement,
  title: string,
  isDark: boolean,
  scale = 2,
): Promise<void> {
  const { svgString, width, height } = buildStandaloneSvgString(svgElement, isDark);
  const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;

  const image = await loadImage(dataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('No se pudo inicializar el contexto Canvas 2D para exportar PNG.');
  }

  ctx.fillStyle = isDark ? '#0f172a' : '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.scale(scale, scale);
  ctx.drawImage(image, 0, 0, width, height);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) {
        resolve(result);
      } else {
        reject(new Error('No se pudo generar la imagen PNG.'));
      }
    }, 'image/png');
  });

  const filename = `${slugifyExportFilename(title)}.png`;
  triggerBlobDownload(blob, filename);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Error al renderizar el SVG en imagen PNG.'));
    img.src = src;
  });
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
