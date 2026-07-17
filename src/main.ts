import { decodeMatch, type MatchPayload } from './engine/serialize';
import { CROSSFIRE_VALLEY } from './maps';
import { GameController } from './ui/controller';

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing #${id}`);
  return node as T;
}

async function boot(): Promise<void> {
  let payload: MatchPayload | undefined;
  const match = location.hash.match(/^#m=([A-Za-z0-9_-]+)$/);
  if (match) {
    try {
      payload = await decodeMatch(match[1]);
    } catch (err) {
      console.error('Could not read match link:', err);
      alert('This match link is invalid or from an incompatible version — starting a new game.');
      history.replaceState(null, '', location.pathname + location.search);
    }
  }

  new GameController(
    CROSSFIRE_VALLEY,
    {
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
      fogToggle: el<HTMLInputElement>('fog-toggle'),
      campaignBtn: el('campaign-btn'),
      campaignMenu: el('campaign-menu'),
      campaignContent: el('campaign-content'),
      shareMenu: el('share-menu'),
      shareTitle: el('share-title'),
      shareLink: el<HTMLInputElement>('share-link'),
      shareCopy: el('share-copy'),
      shareClose: el('share-close'),
      dayLabel: el('day-label'),
      turnChip: el('turn-chip'),
      fundsRed: el('funds-red'),
      fundsBlue: el('funds-blue'),
      tileInfo: el('tile-info'),
      unitInfo: el('unit-info'),
    },
    payload,
  );
}

void boot();
