import { GameController } from './ui/controller';
import { CROSSFIRE_VALLEY } from './maps';

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing #${id}`);
  return node as T;
}

new GameController(CROSSFIRE_VALLEY, {
  canvas: el<HTMLCanvasElement>('board'),
  stage: el('stage'),
  actionMenu: el('action-menu'),
  banner: el('banner'),
  buildMenu: el('build-menu'),
  buildOptions: el('build-options'),
  buildCancel: el('build-cancel'),
  endTurnBtn: el<HTMLButtonElement>('end-turn-btn'),
  restartBtn: el('restart-btn'),
  modeSelect: el<HTMLSelectElement>('mode-select'),
  dayLabel: el('day-label'),
  turnChip: el('turn-chip'),
  fundsRed: el('funds-red'),
  fundsBlue: el('funds-blue'),
  tileInfo: el('tile-info'),
  unitInfo: el('unit-info'),
});
