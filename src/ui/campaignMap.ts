import { ACTS, MISSIONS } from '../campaign/missions';

export type NodeStatus = 'done' | 'next' | 'locked';

export interface MapNode {
  index: number;
  status: NodeStatus;
  /** Best star rating (done missions only). */
  stars: number;
  /** Beaten on Hard. */
  hard: boolean;
  /** Needs the full-game unlock. */
  paid: boolean;
}

const SVG = 'http://www.w3.org/2000/svg';
const W = 360;
const TOP = 86;
const STEP = 100;
const R = 21;

/** Act regions: ground tint, and the terrain glyph scattered over it. */
const REGIONS = [
  { fill: '#2f4a33', edge: '#3c5c40', glyph: 'tree' },
  { fill: '#4a4232', edge: '#5d533e', glyph: 'hill' },
  { fill: '#353c4a', edge: '#454e5f', glyph: 'peak' },
] as const;

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

/** Node centre: a trail winding down the page, start at the top. */
function nodePos(i: number): { x: number; y: number } {
  return { x: W / 2 + Math.sin(i * 0.95) * 108, y: TOP + i * STEP };
}

/** Deterministic pseudo-random numbers, so the scenery never shuffles. */
function rng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/** Smooth path through points (Catmull-Rom converted to cubic Béziers). */
function trail(points: { x: number; y: number }[]): string {
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

function glyph(kind: (typeof REGIONS)[number]['glyph'], x: number, y: number, s: number): SVGElement {
  const g = el('g', { transform: `translate(${x} ${y}) scale(${s})`, class: 'map-decor' });
  if (kind === 'tree') {
    g.append(
      el('rect', { x: -1.2, y: 2, width: 2.4, height: 5, fill: '#4a3a28' }),
      el('path', { d: 'M0 -10 L7 3 L-7 3 Z', fill: '#24402a' }),
      el('path', { d: 'M0 -14 L5 -3 L-5 -3 Z', fill: '#2d5234' }),
    );
  } else if (kind === 'hill') {
    g.append(
      el('path', { d: 'M-14 6 Q0 -12 14 6 Z', fill: '#5f5440' }),
      el('path', { d: 'M-14 6 Q-4 -6 0 -3 Q2 2 -2 6 Z', fill: '#6e6249' }),
    );
  } else {
    g.append(
      el('path', { d: 'M-13 7 L0 -13 L13 7 Z', fill: '#4d5566' }),
      el('path', { d: 'M0 -13 L5 -5 L2 -6 L0 -3 L-2 -6 L-5 -5 Z', fill: '#c9d2df' }),
    );
  }
  return g;
}

/**
 * Draws Book I as a trail of mission nodes across three act regions.
 * Tapping (or Enter on) an unlocked node calls onPick.
 */
export function renderCampaignMap(host: HTMLElement, nodes: MapNode[], onPick: (index: number) => void): void {
  host.innerHTML = '';
  const height = TOP + (MISSIONS.length - 1) * STEP + 90;
  const svg = el('svg', { viewBox: `0 0 ${W} ${height}`, class: 'campaign-svg', role: 'list' });
  svg.setAttribute('aria-label', 'Campaign map');

  // Act regions, each spanning its missions.
  ACTS.forEach((act, a) => {
    const first = act.start;
    const last = (ACTS[a + 1]?.start ?? MISSIONS.length) - 1;
    const y0 = a === 0 ? 0 : nodePos(first).y - STEP / 2;
    const y1 = a === ACTS.length - 1 ? height : nodePos(last).y + STEP / 2;
    const region = REGIONS[a % REGIONS.length];
    svg.append(el('rect', { x: 0, y: y0, width: W, height: y1 - y0, fill: region.fill }));
    if (a > 0) svg.append(el('path', { d: `M0 ${y0} Q ${W / 2} ${y0 - 14} ${W} ${y0}`, stroke: region.edge, 'stroke-width': 3, fill: 'none' }));

    // Scenery away from the trail.
    const rand = rng(a * 977 + 13);
    for (let i = 0; i < (last - first + 1) * 3; i++) {
      const y = y0 + 18 + rand() * (y1 - y0 - 36);
      const onLeft = rand() < 0.5;
      const trailX = W / 2 + Math.sin(((y - TOP) / STEP) * 0.95) * 108;
      const x = onLeft ? 14 + rand() * Math.max(0, trailX - 60) : trailX + 46 + rand() * Math.max(0, W - trailX - 60);
      if (x < 10 || x > W - 10) continue;
      svg.append(glyph(region.glyph, x, y, 1.2 + rand() * 0.7));
    }

    const label = el('text', { x: 14, y: y0 + 17, class: 'map-act' });
    label.textContent = act.title.toUpperCase() + (nodes[first]?.paid ? '  ·  FULL GAME' : '');
    svg.append(label);
  });

  // The trail: dashed where still locked, solid up to the next mission.
  const points = MISSIONS.map((_, i) => nodePos(i));
  svg.append(el('path', { d: trail(points), class: 'map-trail' }));
  const reached = nodes.findIndex((n) => n.status !== 'done');
  const upTo = reached === -1 ? points.length : reached + 1;
  if (upTo > 1) svg.append(el('path', { d: trail(points.slice(0, upTo)), class: 'map-trail done' }));

  for (const node of nodes) {
    const { x, y } = nodePos(node.index);
    const mission = MISSIONS[node.index];
    const g = el('g', {
      class: `map-node ${node.status}`,
      'data-state': node.status,
      'data-index': node.index,
      transform: `translate(${x} ${y})`,
      role: 'listitem',
    });
    g.setAttribute('aria-label', `Mission ${node.index + 1}: ${mission.name}${node.status === 'locked' ? ' (locked)' : ''}`);
    // The pulse sits outside the node so the tappable shape keeps still.
    if (node.status === 'next') svg.append(el('circle', { cx: x, cy: y, r: R + 7, class: 'map-pulse' }));
    g.append(el('circle', { r: R, class: 'map-disc' }));
    const num = el('text', { y: 6, 'text-anchor': 'middle', class: 'map-num' });
    num.textContent = node.status === 'locked' ? '🔒' : String(node.index + 1);
    g.append(num);

    // Name on the outer side of the bend so it never crosses the trail.
    const right = x < W / 2;
    // Invisible hit area over the disc and its label: an easy thumb target.
    const labelW = mission.name.length * 7.5 + 12;
    g.append(
      el('rect', {
        x: right ? -R - 4 : -(R + 10 + labelW),
        y: -R - 4,
        width: R * 2 + 14 + labelW,
        height: R * 2 + 8,
        class: 'map-hit',
      }),
    );
    const name = el('text', {
      x: right ? R + 10 : -(R + 10),
      y: node.status === 'done' ? -2 : 5,
      'text-anchor': right ? 'start' : 'end',
      class: 'map-name',
    });
    name.textContent = mission.name;
    g.append(name);
    if (node.paid && node.status !== 'locked') {
      const tag = el('text', { x: right ? R + 10 : -(R + 10), y: 20, 'text-anchor': right ? 'start' : 'end', class: 'map-stars map-paid' });
      tag.textContent = 'Full game';
      g.append(tag);
    } else if (node.status === 'done') {
      const stars = el('text', { x: right ? R + 10 : -(R + 10), y: 15, 'text-anchor': right ? 'start' : 'end', class: 'map-stars' });
      stars.textContent = '★'.repeat(node.stars) + '☆'.repeat(Math.max(0, 3 - node.stars)) + (node.hard ? '  HARD' : '');
      g.append(stars);
    }

    if (node.status !== 'locked') {
      g.setAttribute('tabindex', '0');
      g.addEventListener('click', () => onPick(node.index));
      g.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onPick(node.index);
        }
      });
    }
    svg.append(g);
  }

  host.append(svg);
}
