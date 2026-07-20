import { decodeMapDef, decodeMatch, type MatchPayload } from './engine/serialize';
import type { MapDef } from './engine/types';
import { CROSSFIRE_VALLEY } from './maps';
import { GameController } from './ui/controller';
import { MapEditor } from './ui/editor';

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing #${id}`);
  return node as T;
}

async function boot(): Promise<void> {
  let payload: MatchPayload | undefined;
  let map: MapDef = CROSSFIRE_VALLEY;

  const matchLink = location.hash.match(/^#m=([A-Za-z0-9_-]+)$/);
  const mapLink = location.hash.match(/^#map=([A-Za-z0-9_-]+)$/);
  if (matchLink) {
    try {
      payload = await decodeMatch(matchLink[1]);
    } catch (err) {
      console.error('Could not read match link:', err);
      alert('This match link is invalid or from an incompatible version — starting a new game.');
      history.replaceState(null, '', location.pathname + location.search);
    }
  } else if (mapLink) {
    try {
      map = await decodeMapDef(mapLink[1]);
    } catch (err) {
      console.error('Could not read map link:', err);
      alert('This map link is invalid — loading the default map.');
      history.replaceState(null, '', location.pathname + location.search);
    }
  }

  const controller = new GameController(
    map,
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
      undoBtn: el<HTMLButtonElement>('undo-btn'),
      muteBtn: el('mute-btn'),
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

  const editor = new MapEditor((customMap) => controller.playCustomMap(customMap));
  el('editor-btn').addEventListener('click', () => editor.open());
  // A shared map link also seeds the editor, so recipients can remix it.
  if (map !== CROSSFIRE_VALLEY) editor.loadMap(map);
}

void boot();

// PWA: cache the game for instant, offline play (production builds only —
// a service worker would fight the dev server's module reloading).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('./sw.js').catch((err) => {
      console.warn('Service worker registration failed:', err);
    });
  });
}
