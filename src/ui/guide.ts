import { DAMAGE, MOUNTAIN_VISION_BONUS, REPAIR_PER_TURN, TERRAIN_DATA, UNIT_DATA } from '../engine/data';
import type { MoveClass, Terrain, UnitType } from '../engine/types';

const MOVE_LABEL: Record<MoveClass, string> = { foot: 'on foot', tires: 'wheels', treads: 'treads', air: 'flies' };

const NOTES: Record<UnitType, string> = {
  infantry: 'Cheap, captures buildings, climbs mountains. Your income army.',
  bazooka: 'Slow foot unit that wrecks tanks. Park it in a forest and let armor come to you.',
  recon: 'Fastest thing on the map and sees the farthest. Scouts, grabs distant towns, hunts infantry.',
  lightTank: 'The workhorse. Crushes infantry and recon; loses to bazookas and anything heavier.',
  heavyTank: 'Expensive and slow, shrugs off small arms. Soften it with artillery, finish with bazookas.',
  artillery: 'Fires 2-3 tiles away but never on the turn it moves, and cannot fight up close. Screen it.',
  antiAir: 'Shreds helicopters and infantry. Weak against tanks. Keep one wherever gunships roam.',
  helicopter: 'Ignores terrain and takes no cover from it. Fears anti-air; artillery cannot touch it.',
};

const TERRAIN_NOTES: Partial<Record<Terrain, string>> = {
  forest: 'Hides ground units under fog until an enemy is adjacent.',
  mountain: 'Foot units only (aircraft fly over). Foot units see farther from the top.',
  water: 'Aircraft only.',
  road: 'Fast for wheels; no cover.',
  city: `Pays $1000 a turn; units on it heal ${REPAIR_PER_TURN / 10} HP a turn.`,
  factory: 'Builds units; pays and heals like a city.',
  hq: 'Lose it and the war is over. Pays and heals like a city.',
};

const ORDER: UnitType[] = ['infantry', 'bazooka', 'recon', 'lightTank', 'heavyTank', 'artillery', 'antiAir', 'helicopter'];
const TERRAIN_ORDER: Terrain[] = ['plain', 'road', 'forest', 'mountain', 'water', 'city', 'factory', 'hq'];

function names(types: UnitType[]): string {
  return types.map((t) => UNIT_DATA[t].name).join(', ') || '—';
}

/** Fills the unit guide once; safe to call repeatedly. */
export function renderUnitGuide(list: HTMLElement): void {
  if (list.childElementCount > 0) return;

  for (const type of ORDER) {
    const d = UNIT_DATA[type];
    const strong = ORDER.filter((o) => DAMAGE[type][o] >= 55);
    const threatened = ORDER.filter((o) => DAMAGE[o][type] >= 55);
    const cannot = ORDER.filter((o) => DAMAGE[type][o] === 0);
    const range = d.minRange === d.maxRange ? `${d.maxRange}` : `${d.minRange}–${d.maxRange}`;
    const card = document.createElement('section');
    card.className = 'guide-card-unit';
    card.innerHTML = `
      <h3>${d.name} <span class="cost">$${d.cost}</span></h3>
      <div class="guide-stats">
        <span>Move ${d.move} · ${MOVE_LABEL[d.moveClass]}</span>
        <span>Range ${range}</span>
        <span>Sight ${d.vision}</span>
        ${d.canCapture ? '<span>Captures</span>' : ''}
      </div>
      <p><b>Strong against:</b> ${names(strong)}</p>
      <p><b>Threatened by:</b> ${names(threatened)}</p>
      ${cannot.length ? `<p><b>Cannot attack:</b> ${names(cannot)}</p>` : ''}
      <p class="guide-note">${NOTES[type]}</p>`;
    list.appendChild(card);
  }

  const terrain = document.createElement('section');
  terrain.className = 'guide-card-unit';
  const rows = TERRAIN_ORDER.map((t) => {
    const d = TERRAIN_DATA[t];
    const cost = (c: number | null) => (c === null ? '✕' : String(c));
    return `<tr><td>${d.name}</td><td>${'★'.repeat(d.defenseStars) || '—'}</td>
      <td>${cost(d.moveCost.foot)}</td><td>${cost(d.moveCost.tires)}</td><td>${cost(d.moveCost.treads)}</td></tr>`;
  }).join('');
  const notes = TERRAIN_ORDER.filter((t) => TERRAIN_NOTES[t])
    .map((t) => `<li><b>${TERRAIN_DATA[t].name}:</b> ${TERRAIN_NOTES[t]}</li>`)
    .join('');
  terrain.innerHTML = `
    <h3>Terrain</h3>
    <p class="guide-note">Each ★ cuts damage taken by 10% at full health. Movement cost per tile
      for foot / wheels / treads; ✕ is impassable. Aircraft cross everything at cost 1.
      Foot units on a mountain see ${MOUNTAIN_VISION_BONUS} tiles farther under fog.</p>
    <table class="guide-table">
      <thead><tr><th>Tile</th><th>Cover</th><th>Foot</th><th>Wheels</th><th>Treads</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <ul class="guide-notes">${notes}</ul>`;
  list.appendChild(terrain);
}
