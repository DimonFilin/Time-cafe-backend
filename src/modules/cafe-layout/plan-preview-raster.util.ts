// Nest compiles to CJS — default import breaks at runtime (sharp_1.default is not a function).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const sharp = require('sharp') as typeof import('sharp');

import type {
  PlanPreviewFurniture,
  PlanPreviewPayload,
} from './plan-preview.util';
import { PLAN_PX_PER_M } from './plan-preview.util';

const MAX_OUTPUT_W = 1400;
const JPEG_QUALITY = 92;
const RASTER_DENSITY = 144;

function esc(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function furnitureRect(f: PlanPreviewFurniture) {
  const w = f.widthM * PLAN_PX_PER_M;
  const h = f.heightM * PLAN_PX_PER_M;
  const x = f.x - w / 2;
  const y = f.y - h / 2;
  const rot = f.rotationDeg
    ? ` transform="rotate(${f.rotationDeg} ${f.x} ${f.y})"`
    : '';
  const label = f.name ? esc(f.name) : '';
  let fill = '#f3f4f6';
  let stroke = '#6b7280';
  if (f.kind === 'table') {
    fill = 'rgba(217,119,6,0.35)';
    stroke = '#b45309';
  } else if (f.kind === 'chair') {
    fill = 'rgba(87,83,78,0.4)';
    stroke = '#57534e';
  } else if (f.kind === 'stair') {
    fill = 'rgba(148,163,184,0.35)';
    stroke = '#475569';
  }
  const shape =
    f.kind === 'table' && f.shape === 'oval'
      ? `<ellipse cx="${f.x}" cy="${f.y}" rx="${w / 2}" ry="${h / 2}" fill="${fill}" stroke="${stroke}" stroke-width="2.5"/>`
      : `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${fill}" stroke="${stroke}" stroke-width="2.5"/>`;
  const text = label
    ? `<text x="${f.x}" y="${f.y + 12}" text-anchor="middle" font-size="40" font-weight="600" fill="#1f2937" font-family="Arial,sans-serif">${label}</text>`
    : '';
  return `<g${rot}>${shape}${text}</g>`;
}

export function buildPlanPreviewSvg(preview: PlanPreviewPayload): string {
  const b = preview.bounds;
  const w = Math.ceil(b.width);
  const h = Math.ceil(b.height);
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${b.minX} ${b.minY} ${w} ${h}" width="${w}" height="${h}">`,
    `<rect x="${b.minX}" y="${b.minY}" width="${w}" height="${h}" fill="#f8fafc"/>`,
  ];
  for (const wall of preview.walls) {
    parts.push(
      `<line x1="${wall.x1}" y1="${wall.y1}" x2="${wall.x2}" y2="${wall.y2}" stroke="#1e293b" stroke-width="14" stroke-linecap="round"/>`,
    );
  }
  for (const o of preview.openings) {
    parts.push(
      `<line x1="${o.x1}" y1="${o.y1}" x2="${o.x2}" y2="${o.y2}" stroke="#64748b" stroke-width="7" stroke-linecap="round"/>`,
    );
  }
  for (const f of preview.furniture) {
    parts.push(furnitureRect(f));
  }
  parts.push('</svg>');
  return parts.join('');
}

export async function buildPlanRasterImage(
  preview: PlanPreviewPayload,
): Promise<{ dataUrl: string; width: number; height: number } | null> {
  const b = preview.bounds;
  if (!b.width || !b.height) return null;
  const svg = buildPlanPreviewSvg(preview);
  const outW = Math.min(MAX_OUTPUT_W, Math.max(400, Math.round(b.width)));
  const outH = Math.max(1, Math.round((outW * b.height) / b.width));
  const jpeg = await sharp(Buffer.from(svg), { density: RASTER_DENSITY })
    .resize(outW, outH, {
      fit: 'inside',
      withoutEnlargement: false,
      kernel: sharp.kernel.lanczos3,
    })
    .sharpen({ sigma: 0.6, m1: 0.5, m2: 0.35 })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true, chromaSubsampling: '4:4:4' })
    .toBuffer();
  return {
    dataUrl: `data:image/jpeg;base64,${jpeg.toString('base64')}`,
    width: outW,
    height: outH,
  };
}
