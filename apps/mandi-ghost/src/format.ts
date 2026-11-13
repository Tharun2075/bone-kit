import { t, type Lang } from '@bone-kit/skeleton';
import { ageHours, bannerKey, type Point } from './snapshot.js';

export function lastSeenText(lastSeen: number | null, now: number, lang: Lang): string {
  if (lastSeen === null) return `${t('app.lastSeen', lang)}: ${t('app.never', lang)}`;
  const h = ageHours(lastSeen, now);
  return h === 0 ? t('app.lastSeenNow', lang) : t('app.lastSeenAgo', lang).replace('{h}', String(h));
}

/** Text of the banner shown on every price screen; '' when live data needs none. */
export function bannerText(snapshot: { synthetic: boolean } | null, lang: Lang): string {
  const k = bannerKey(snapshot);
  return k ? t(k, lang) : '';
}

const SVG = 'http://www.w3.org/2000/svg';

/** Inline-SVG polyline of modal prices. Colours come from CSS classes (var(--bk-*)), never inline. */
export function trendSvg(points: Point[], title: string, desc: string): SVGSVGElement {
  const W = 280;
  const H = 90;
  const pad = 8;
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('class', 'trend');
  const ti = document.createElementNS(SVG, 'title');
  ti.textContent = title;
  const de = document.createElementNS(SVG, 'desc');
  de.textContent = desc;
  svg.append(ti, de);
  if (points.length === 0) return svg;
  const vals = points.map((p) => p.modal);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const span = hi - lo || 1;
  const xy = points.map((p, i) => {
    const x = points.length === 1 ? W / 2 : pad + (i * (W - 2 * pad)) / (points.length - 1);
    const y = H - pad - ((p.modal - lo) / span) * (H - 2 * pad);
    return [x, y] as const;
  });
  const line = document.createElementNS(SVG, 'polyline');
  line.setAttribute('class', 'trend-line');
  line.setAttribute('points', xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' '));
  svg.append(line);
  xy.forEach(([x, y]) => {
    const c = document.createElementNS(SVG, 'circle');
    c.setAttribute('class', 'trend-dot');
    c.setAttribute('cx', x.toFixed(1));
    c.setAttribute('cy', y.toFixed(1));
    c.setAttribute('r', '3');
    svg.append(c);
  });
  return svg;
}
