import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = 'http://localhost:5173';
const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: 'msedge' });

const phone = { viewport: { width: 430, height: 932 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true };
const phoneLand = { viewport: { width: 932, height: 430 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true };
const tablet = { viewport: { width: 1024, height: 1366 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

async function shot(name, ctxOpts, drive) {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  page.on('dialog', (d) => d.dismiss());
  await page.goto(`${BASE}/?shot=${name}`);
  await page.evaluate(() => {
    localStorage.setItem('tactics-clash-campaign', '13');
    localStorage.setItem(
      'crossfire-valley-medals',
      JSON.stringify({ 0: 3, 1: 3, 2: 2, 3: 3, 4: 2, 5: 3, 6: 1, 7: 2, 8: 3, 9: 2, 10: 2, 11: 3, 12: 2 }),
    );
    localStorage.setItem('crossfire-valley-tutorial', '1');
    localStorage.setItem('crossfire-valley-muted', '1');
    localStorage.removeItem('crossfire-valley-save');
  });
  await page.reload();
  await page.waitForTimeout(600);
  await drive(page);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log('wrote', name);
  await ctx.close();
}

const click = (page, id) => page.click(`#${id}`);

async function startMission(page, index) {
  await click(page, 'menu-campaign');
  await page.waitForTimeout(250);
  await page.locator('#campaign-list button').nth(index).click();
  await page.waitForTimeout(250);
  await click(page, 'briefing-start');
  await page.waitForTimeout(2600); // let the turn banner fade
}

async function tile(page, x, y) {
  const bb = await page.locator('#board').boundingBox();
  const [w, h] = await page.evaluate(() => [window.__tcState.width, window.__tcState.height]);
  await page.mouse.click(bb.x + ((x + 0.5) * bb.width) / w, bb.y + ((y + 0.5) * bb.height) / h);
  await page.waitForTimeout(350);
}

// 1. Campaign list with acts and medals
await shot('01-campaign', phone, async (p) => {
  await click(p, 'menu-campaign');
  await p.waitForTimeout(300);
});

// 2. A mid-campaign briefing (River Crossing)
await shot('02-briefing', phone, async (p) => {
  await click(p, 'menu-campaign');
  await p.waitForTimeout(250);
  await p.locator('#campaign-list button').nth(8).click();
  await p.waitForTimeout(300);
});

// 3. Mid-battle with the action bar open (Iron Tide: tank to the center city)
await shot('03-battle', phone, async (p) => {
  await startMission(p, 6);
  await tile(p, 4, 3);
  await tile(p, 6, 3);
});

// 4. Fog + objective HUD (The Citadel Holds)
await shot('04-fog-objective', phone, async (p) => {
  await startMission(p, 13);
  await tile(p, 6, 2);
});

// 5. Landscape phone (River Crossing, unit selected)
await shot('05-landscape', phoneLand, async (p) => {
  await startMission(p, 8);
  await tile(p, 4, 2);
});

// 6. Tablet (Skyfall, anti-air selected)
await shot('06-tablet', tablet, async (p) => {
  await startMission(p, 5);
  await tile(p, 3, 3);
});

// 7. Main menu
await shot('07-menu', phone, async () => {});

// Play feature graphic 1024x500
{
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.setContent(`
    <style>
      body { margin: 0; width: 1024px; height: 500px; background: #1b2430; display: flex; align-items: center;
             justify-content: center; gap: 56px; font-family: 'Segoe UI', system-ui, sans-serif; color: #e8eef5; }
      img { width: 300px; height: 300px; border-radius: 64px; box-shadow: 0 20px 60px rgba(0,0,0,.6); }
      h1 { margin: 0; font-size: 84px; letter-spacing: 6px; text-transform: uppercase; line-height: 1;
           background: linear-gradient(#ffb3a6, #d8442e); -webkit-background-clip: text; color: transparent; }
      p { margin: 14px 0 0; font-size: 30px; color: #9fb0c3; letter-spacing: 2px; }
    </style>
    <img src="${BASE}/icons/icon-512.png" />
    <div><h1>Crossfire<br>Valley</h1><p>Turn-based tank tactics</p></div>
  `);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/feature-graphic-1024x500.png` });
  console.log('wrote feature graphic');
  await ctx.close();
}

await browser.close();

