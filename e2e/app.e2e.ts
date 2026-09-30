/**
 * Browser end-to-end tests: the game as a player meets it. Starts a Vite
 * dev server, drives it with Playwright, and checks the flows the unit
 * tests can't see — menus, the tutorial, a full win through taps, an AI
 * turn, the results dialog, autosave, and layout invariants.
 *
 *   npm run e2e                       # bundled Chromium (CI)
 *   E2E_BROWSER=msedge npm run e2e    # system Edge (Windows, sandboxes)
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { encodeMapDef } from '../src/engine/serialize';
import type { GameState, MapDef } from '../src/engine/types';

const PORT = 4173;
const BASE = `http://localhost:${PORT}`;

const PHONE = { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true };
const LANDSCAPE = { viewport: { width: 812, height: 375 }, isMobile: true, hasTouch: true };
const TABLET = { viewport: { width: 1024, height: 768 } };

let server: ChildProcess;
let browser: Browser;

async function waitForServer(): Promise<void> {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(BASE);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('dev server did not start');
}

beforeAll(async () => {
  server = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', '--port', String(PORT), '--strictPort'], {
    stdio: 'ignore',
    shell: process.platform === 'win32',
  });
  await waitForServer();
  browser = await chromium.launch(process.env.E2E_BROWSER ? { channel: process.env.E2E_BROWSER } : {});
});

afterAll(async () => {
  await browser?.close();
  server?.kill();
});

async function open(ctxOpts: object, hash = ''): Promise<{ ctx: BrowserContext; page: Page; errors: string[] }> {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => {
    // Confirms are expected (reset progress); alerts mean something broke.
    if (d.type() === 'alert') errors.push(`alert: ${d.message()}`);
    void d.accept();
  });
  await page.goto(`${BASE}/${hash}`);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('crossfire-valley-muted', '1');
  });
  await page.reload();
  // The App constructor stamps the version synchronously; a deep link may
  // then land on a screen other than the menu.
  await page.waitForFunction(() => (document.getElementById('menu-version')?.textContent ?? '') !== '');
  return { ctx, page, errors };
}

const state = (page: Page) => page.evaluate(() => (window as unknown as { __tcState: GameState }).__tcState);

async function tile(page: Page, x: number, y: number): Promise<void> {
  const bb = (await page.locator('#board').boundingBox())!;
  const s = await state(page);
  await page.mouse.click(bb.x + ((x + 0.5) * bb.width) / s.width, bb.y + ((y + 0.5) * bb.height) / s.height);
  await page.waitForTimeout(350);
}

async function waitForRedTurn(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const s = (window as unknown as { __tcState: GameState }).__tcState;
      return s.winner !== null || s.current === 'red';
    },
    null,
    { timeout: 30_000 },
  );
  await page.waitForTimeout(1600); // let the turn banner fade
}

describe('menus and settings', () => {
  it('boots to the main menu without errors and reaches every screen', async () => {
    const { ctx, page, errors } = await open(PHONE);
    expect(await page.locator('#menu-continue').isHidden()).toBe(true);
    await page.click('#menu-campaign');
    await expect.poll(() => page.locator('#screen-campaign.active').count()).toBe(1);
    expect(await page.locator('#campaign-map .map-node').count()).toBe(24);
    expect(await page.locator('#campaign-map .map-node:not(.locked)').count()).toBe(1);
    // The list view is still one tap away.
    await page.click('#campaign-view-toggle');
    expect(await page.locator('#campaign-list button').count()).toBe(24);
    expect(await page.locator('#campaign-list button:not([disabled])').count()).toBe(1);
    expect(await page.locator('#campaign-map').isHidden()).toBe(true);
    await page.click('#campaign-view-toggle');
    await page.click('#campaign-map .map-node[data-state="next"]');
    await expect.poll(() => page.locator('#briefing-difficulty .active').textContent()).toBe('Easy');
    await page.click('#briefing-back');
    await page.click('#campaign-back');
    await page.click('#menu-skirmish');
    expect(await page.locator('#skirmish-map option').count()).toBeGreaterThanOrEqual(5);
    await page.click('#skirmish-back');
    await page.click('#menu-units');
    expect(await page.locator('#units-list .guide-card-unit').count()).toBe(9);
    await page.click('#units-close');
    await page.click('#menu-settings');
    await expect.poll(() => page.locator('#screen-settings.active').count()).toBe(1);
    expect(errors).toEqual([]);
    await ctx.close();
  });
});

describe('tutorial', () => {
  it('guides the first mission and advances on real taps', async () => {
    const { ctx, page, errors } = await open(PHONE);
    await page.click('#menu-campaign');
    await page.click('#campaign-map .map-node[data-index="0"]');
    await expect.poll(() => page.locator('#briefing-title').textContent()).toContain('First Steps');
    await page.click('#briefing-start');
    await page.waitForSelector('#screen-game.active');
    await page.waitForTimeout(1800);
    await expect.poll(() => page.locator('#tutorial').isVisible()).toBe(true);
    expect(await page.locator('#tutorial-text').textContent()).toContain('Light Tank');

    await tile(page, 3, 3); // the tank
    expect(await page.locator('#tutorial-text').textContent()).toContain('blue tiles');
    await tile(page, 5, 3); // a reachable tile
    await expect.poll(() => page.locator('#action-menu').isVisible()).toBe(true);
    await page.click('#action-menu button:has-text("Done")');
    await page.waitForTimeout(500);
    const s = await state(page);
    expect(s.units.find((u) => u.type === 'lightTank')).toMatchObject({ x: 5, y: 3, acted: true });
    expect(await page.locator('#tutorial-text').textContent()).toContain('Infantry');

    await page.click('#tutorial-skip');
    expect(await page.locator('#tutorial').isHidden()).toBe(true);
    expect(await page.evaluate(() => localStorage.getItem('crossfire-valley-tutorial'))).toBe('1');
    expect(errors).toEqual([]);
    await ctx.close();
  });
});

describe('full-game unlock', () => {
  it('free players reach Act II at the unlock screen; the dev switch opens it', async () => {
    const { ctx, page, errors } = await open(PHONE);
    await page.evaluate(() => localStorage.setItem('tactics-clash-campaign', '12'));
    await page.reload();
    await page.click('#menu-campaign');
    expect(await page.locator('#campaign-map .map-paid').count()).toBe(1); // mission 13, now next
    await page.click('#campaign-map .map-node[data-index="12"]');
    await expect.poll(() => page.locator('#screen-unlock.active').count()).toBe(1);
    await expect.poll(() => page.locator('#unlock-buy').textContent()).toBe('Not available yet');
    expect(await page.locator('#unlock-status').textContent()).toContain('iPhone and Android apps');
    await page.click('#unlock-back');
    await expect.poll(() => page.locator('#screen-campaign.active').count()).toBe(1);

    // Skirmish: other maps vs the computer are paid; local 2P is free.
    await page.click('#campaign-back');
    await page.click('#menu-skirmish');
    await page.click('#opponent-group button[data-opponent="ai"]');
    await page.selectOption('#skirmish-map', { index: 1 });
    await page.click('#skirmish-start');
    await expect.poll(() => page.locator('#screen-unlock.active').count()).toBe(1);
    await page.click('#unlock-back');
    await page.click('#opponent-group button[data-opponent="hotseat"]');
    await page.click('#skirmish-start');
    await page.waitForSelector('#screen-game.active');
    await page.click('#menu-btn');
    await page.click('#pause-quit');

    // The developer switch (dev builds only) unlocks everything.
    await page.click('#menu-settings');
    expect(await page.locator('#settings-dev-row').isVisible()).toBe(true);
    await page.check('#settings-dev-unlock');
    expect(await page.locator('#settings-unlock-sub').textContent()).toContain('Unlocked');
    await page.click('#settings-back');
    await page.click('#menu-campaign');
    expect(await page.locator('#campaign-map .map-paid').count()).toBe(0);
    await page.click('#campaign-map .map-node[data-index="12"]');
    await expect.poll(() => page.locator('#briefing-title').textContent()).toContain('Mission 13');
    expect(errors).toEqual([]);
    await ctx.close();
  });
});

describe('boot camp', () => {
  it('is suggested on first launch and runs a lesson with its hints', async () => {
    const { ctx, page, errors } = await open(PHONE);
    expect(await page.locator('#menu-bootcamp.nudge').count()).toBe(1);
    await page.click('#menu-bootcamp');
    await expect.poll(() => page.locator('#screen-bootcamp.active').count()).toBe(1);
    expect(await page.locator('#bootcamp-list button').count()).toBe(7);
    await page.click('#bootcamp-list button[data-lesson="0"]');
    await page.waitForSelector('#screen-game.active');
    await page.waitForTimeout(1800);
    await expect.poll(() => page.locator('#tutorial').isVisible()).toBe(true);
    expect(await page.locator('#tutorial-text').textContent()).toContain('Light Tank');
    expect(await page.locator('#hud-title').textContent()).toContain('Boot Camp 1');

    // Lessons don't take over the autosave slot.
    await page.click('#menu-btn');
    await page.click('#pause-quit');
    await expect.poll(() => page.locator('#screen-menu.active').count()).toBe(1);
    expect(await page.locator('#menu-continue').isHidden()).toBe(true);
    expect(errors).toEqual([]);
    await ctx.close();
  });
});

describe('a whole game through the UI', () => {
  // Red infantry next to Blue's HQ; Blue has one far-away soldier so the
  // map validates (minimum size 5x5). Capturing an HQ takes two turns.
  const MAP: MapDef = {
    name: 'E2E',
    grid: ['H...cH', '......', 'ff..ff', '......', '......'],
    properties: [
      { x: 0, y: 0, owner: 'red' },
      { x: 5, y: 0, owner: 'blue' },
    ],
    units: [
      { type: 'infantry', owner: 'red', x: 4, y: 1 },
      { type: 'infantry', owner: 'blue', x: 0, y: 2 },
    ],
    startingFunds: 0,
  };

  it('captures the enemy HQ, survives an AI turn, and shows the result', async () => {
    const code = await encodeMapDef(MAP);
    const { ctx, page, errors } = await open(PHONE, `#map=${code}`);
    // A map link lands on the skirmish screen with the custom map selected.
    await expect.poll(() => page.locator('#screen-skirmish.active').count(), { timeout: 5000 }).toBe(1);
    await page.evaluate(() => localStorage.setItem('crossfire-valley-dev-unlock', '1'));
    expect(errors).toEqual([]);
    expect(await page.locator('#skirmish-map').inputValue()).toBe('__custom');
    await page.click('#opponent-group button[data-opponent="ai"]');
    await page.click('#difficulty-group button[data-difficulty="easy"]');
    await page.click('#skirmish-start');
    await page.waitForSelector('#screen-game.active');
    await page.waitForTimeout(1800);

    await tile(page, 4, 1); // select infantry
    await tile(page, 5, 0); // onto the HQ
    await page.click('#action-menu button:has-text("Capture")');
    await page.waitForTimeout(400);
    let s = await state(page);
    expect(s.tiles[5].capturePoints).toBe(10);
    expect(await page.locator('#end-turn-btn').isEnabled()).toBe(true);

    await page.click('#end-turn-btn');
    await waitForRedTurn(page);
    s = await state(page);
    expect(s.day).toBe(2);
    expect(s.current).toBe('red');

    await tile(page, 5, 0); // reselect (it stayed on the HQ)
    await tile(page, 5, 0); // "move" in place
    await page.click('#action-menu button:has-text("Capture")');
    await page.waitForTimeout(400);
    s = await state(page);
    expect(s.winner).toBe('red');

    await expect.poll(() => page.locator('#results-menu').isVisible(), { timeout: 5000 }).toBe(true);
    expect(await page.locator('#results-content h2').textContent()).toContain('Victory');
    // A finished game is not offered for resume.
    await page.click('#results-content button:has-text("Main menu")');
    await expect.poll(() => page.locator('#screen-menu.active').count()).toBe(1);
    expect(await page.locator('#menu-continue').isHidden()).toBe(true);
    expect(errors).toEqual([]);
    await ctx.close();
  });
});

describe('attack forecast', () => {
  // Red tank three tiles from a Blue soldier; the forest beside the soldier
  // is the best tile to attack from.
  const MAP: MapDef = {
    name: 'Forecast',
    grid: ['H.......', '....f...', '........', '........', '.......H'],
    properties: [
      { x: 0, y: 0, owner: 'red' },
      { x: 7, y: 4, owner: 'blue' },
    ],
    units: [
      { type: 'lightTank', owner: 'red', x: 1, y: 2 },
      { type: 'infantry', owner: 'blue', x: 4, y: 2 },
      { type: 'infantry', owner: 'blue', x: 7, y: 3 },
    ],
    startingFunds: 0,
  };

  it('tapping an enemy with a unit selected previews the hit, and a second tap fires', async () => {
    const code = await encodeMapDef(MAP);
    const { ctx, page, errors } = await open(PHONE, `#map=${code}`);
    await expect.poll(() => page.locator('#screen-skirmish.active').count(), { timeout: 5000 }).toBe(1);
    await page.click('#opponent-group button[data-opponent="hotseat"]');
    await page.click('#skirmish-start');
    await page.waitForSelector('#screen-game.active');
    await page.waitForTimeout(1800);

    await tile(page, 1, 2); // the tank
    await tile(page, 4, 2); // the soldier
    await expect.poll(() => page.locator('#action-menu').isVisible()).toBe(true);
    const bar = (await page.locator('#action-menu').innerText()).replace(/\s+/g, ' ');
    expect(bar).toMatch(/Infantry: −\d+ HP · (counter −\d HP|counter: a scratch)/);
    expect(bar).toContain('Fire');
    if (process.env.E2E_SHOTS) await page.screenshot({ path: `${process.env.E2E_SHOTS}/forecast-phone.png` });

    await tile(page, 4, 2); // same target again: fire
    await page.waitForTimeout(600);
    const s = await state(page);
    const tank = s.units.find((u) => u.type === 'lightTank')!;
    expect(tank).toMatchObject({ x: 4, y: 1, acted: true }); // attacked from the forest
    expect(s.units.find((u) => u.owner === 'blue' && u.x === 4 && u.y === 2)!.hp).toBeLessThan(100);
    expect(errors).toEqual([]);
    await ctx.close();
  });
});

describe('local two-player', () => {
  it('covers the board between turns until the next player is ready', async () => {
    const { ctx, page, errors } = await open(PHONE);
    await page.click('#menu-skirmish');
    await page.click('#opponent-group button[data-opponent="hotseat"]');
    await page.click('#skirmish-start');
    await page.waitForSelector('#screen-game.active');
    await page.waitForTimeout(1800);
    expect(await page.locator('#handoff').isHidden()).toBe(true);

    await page.click('#end-turn-btn');
    await page.click('#endturn-confirm');
    await expect.poll(() => page.locator('#handoff').isVisible()).toBe(true);
    expect(await page.locator('#handoff-title').textContent()).toBe("BLUE'S TURN");
    expect((await state(page)).current).toBe('blue');
    await page.click('#handoff-ready');
    expect(await page.locator('#handoff').isHidden()).toBe(true);

    // Resuming a local game asks for the device to be handed over again.
    await page.reload();
    await page.waitForFunction(() => (document.getElementById('menu-version')?.textContent ?? '') !== '');
    await page.click('#menu-continue');
    await expect.poll(() => page.locator('#handoff').isVisible()).toBe(true);
    expect(errors).toEqual([]);
    await ctx.close();
  });
});

describe('end turn confirmation', () => {
  it('asks before ending a turn with units left, and can jump to one instead', async () => {
    const { ctx, page, errors } = await open(PHONE);
    await page.click('#menu-skirmish');
    await page.click('#skirmish-start');
    await page.waitForSelector('#screen-game.active');
    await page.waitForTimeout(1800);

    await page.click('#end-turn-btn');
    await expect.poll(() => page.locator('#endturn-menu').isVisible()).toBe(true);
    expect(await page.locator('#endturn-text').textContent()).toMatch(/units? hasn't|units haven't/);
    expect((await state(page)).current).toBe('red');

    await page.click('#endturn-next');
    expect(await page.locator('#endturn-menu').isHidden()).toBe(true);

    await page.click('#end-turn-btn');
    await page.click('#endturn-confirm');
    await expect.poll(async () => (await state(page)).current, { timeout: 5000 }).toBe('blue');
    await waitForRedTurn(page);

    // Turning the setting off skips the question.
    await page.click('#menu-btn');
    await page.click('#pause-quit');
    await page.click('#menu-settings');
    await page.uncheck('#settings-confirm-end');
    await page.click('#settings-back');
    await page.click('#menu-continue');
    await page.waitForSelector('#screen-game.active');
    await page.waitForTimeout(1800);
    await page.click('#end-turn-btn');
    await expect.poll(async () => (await state(page)).current, { timeout: 5000 }).toBe('blue');
    expect(await page.locator('#endturn-menu').isHidden()).toBe(true);
    expect(errors).toEqual([]);
    await ctx.close();
  });
});

describe('autosave', () => {
  it('resumes a skirmish after quitting and after a reload', async () => {
    const { ctx, page, errors } = await open(PHONE);
    await page.click('#menu-skirmish');
    await page.click('#skirmish-start');
    await page.waitForSelector('#screen-game.active');
    await page.waitForTimeout(1800);
    await tile(page, 4, 3); // red light tank on the default map
    await tile(page, 6, 3);
    await page.click('#action-menu button:has-text("Done")');
    await page.waitForTimeout(500);

    await page.click('#menu-btn');
    await page.click('#pause-quit');
    await expect.poll(() => page.locator('#menu-continue').isVisible()).toBe(true);
    expect(await page.locator('#menu-continue-sub').textContent()).toContain('vs Computer');

    await page.reload();
    await page.waitForSelector('#screen-menu.active');
    await page.click('#menu-continue');
    await page.waitForSelector('#screen-game.active');
    const s = await state(page);
    expect(s.units.find((u) => u.type === 'lightTank' && u.owner === 'red')).toMatchObject({ x: 6, y: 3 });
    expect(errors).toEqual([]);
    await ctx.close();
  });
});

describe('layout invariants', () => {
  for (const [name, opts] of Object.entries({ phone: PHONE, landscape: LANDSCAPE, tablet: TABLET })) {
    it(`${name}: nothing overflows and the action bar stays inside the board area`, async () => {
      const { ctx, page, errors } = await open(opts);
      await page.evaluate(() => {
        localStorage.setItem('tactics-clash-campaign', '13');
        localStorage.setItem('crossfire-valley-dev-unlock', '1');
      });
      await page.reload();
      await page.click('#menu-campaign');
      await page.click('#campaign-map .map-node[data-index="13"]'); // long title + objective
      await page.click('#briefing-start');
      await page.waitForSelector('#screen-game.active');
      await page.waitForTimeout(1800);

      const m = await page.evaluate(() => {
        const r = (id: string) => document.getElementById(id)!.getBoundingClientRect();
        return {
          docOverflow: document.documentElement.scrollWidth > window.innerWidth,
          hudOverflow: document.getElementById('hud')!.scrollWidth > document.getElementById('hud')!.clientWidth + 1,
          endTurn: r('end-turn-btn'),
          goal: document.getElementById('hud-goal')!.textContent,
          vw: window.innerWidth,
          vh: window.innerHeight,
        };
      });
      expect(m.docOverflow).toBe(false);
      expect(m.hudOverflow).toBe(false);
      expect(m.endTurn.right).toBeLessThanOrEqual(m.vw + 1);
      expect(m.endTurn.bottom).toBeLessThanOrEqual(m.vh + 1);
      expect(m.goal).toContain('hold out');

      await tile(page, 6, 2); // bazooka in the north gap
      await tile(page, 6, 1); // step out
      await expect.poll(() => page.locator('#action-menu').isVisible()).toBe(true);
      const inside = await page.evaluate(() => {
        const a = document.getElementById('action-menu')!.getBoundingClientRect();
        const v = document.getElementById('viewport')!.getBoundingClientRect();
        return a.top >= v.top - 1 && a.bottom <= v.bottom + 1 && a.left >= v.left - 1 && a.right <= v.right + 1;
      });
      expect(inside).toBe(true);
      expect(errors).toEqual([]);
      await ctx.close();
    });
  }
});
