import puppeteer from 'puppeteer-core';
import fs from 'fs';
import os from 'os';
import path from 'path';

const CHROME_PATH = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const TARGET_URL = process.env.TARGET_URL || 'http://localhost:3000';
const ARTIFACTS_DIR = process.env.ARTIFACTS_DIR || path.join(os.tmpdir(), 'radar-artifacts');

async function capture(page, name) {
  const localPath = path.resolve('assets/screenshots', `${name}.png`);
  await page.screenshot({ path: localPath });
  if (ARTIFACTS_DIR && fs.existsSync(ARTIFACTS_DIR)) {
    try {
      fs.copyFileSync(localPath, path.join(ARTIFACTS_DIR, `${name}.png`));
    } catch {}
  }
  console.log(`[Captured] ${name}.png`);
}

async function runVerification() {
  console.log('=== Verifying Detail Drawer Tabs & Single-Scroll Fix ===');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    defaultViewport: { width: 1380, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.goto(TARGET_URL, { waitUntil: 'networkidle0' });

  // 1. Check background scroll before opening drawer
  const initialBodyOverflow = await page.evaluate(() => document.body.style.overflow);
  console.log('Initial body overflow:', initialBodyOverflow || '(empty/default)');

  // 2. Open first card
  await page.waitForSelector('.card-grid .base-card');
  await page.click('.card-grid .base-card');
  await new Promise((r) => setTimeout(r, 600));

  // Verify body overflow is locked to hidden
  const drawerOpenBodyOverflow = await page.evaluate(() => document.body.style.overflow);
  console.log('Body overflow when drawer is open:', drawerOpenBodyOverflow);
  if (drawerOpenBodyOverflow !== 'hidden') {
    throw new Error(`Expected body overflow to be hidden, got ${drawerOpenBodyOverflow}`);
  }

  // 3. Measure tabs row in Summary tab
  const summaryNavDims = await page.evaluate(() => {
    const nav = document.querySelector('.drawer-tabs-nav');
    const firstBtn = nav ? nav.querySelector('button') : null;
    return {
      navHeight: nav ? nav.offsetHeight : 0,
      btnHeight: firstBtn ? firstBtn.offsetHeight : 0,
    };
  });
  console.log('Summary tab dimensions:', summaryNavDims);
  if (summaryNavDims.navHeight < 36 || summaryNavDims.btnHeight < 24) {
    throw new Error(`Tabs nav or button is squashed: ${JSON.stringify(summaryNavDims)}`);
  }
  await capture(page, '43-drawer-tabs-summary-dark');

  // 4. Switch to Evidence tab (lots of items)
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('.drawer-tabs-nav button'));
    const ev = btns.find((b) => b.textContent.includes('Evidence'));
    if (ev) ev.click();
  });
  await new Promise((r) => setTimeout(r, 400));

  const evidenceNavDims = await page.evaluate(() => {
    const nav = document.querySelector('.drawer-tabs-nav');
    const activeBtn = nav ? nav.querySelector('.btn-coral') : null;
    return {
      navHeight: nav ? nav.offsetHeight : 0,
      activeText: activeBtn ? activeBtn.textContent : null,
      activeHeight: activeBtn ? activeBtn.offsetHeight : 0,
    };
  });
  console.log('Evidence tab dimensions:', evidenceNavDims);
  if (evidenceNavDims.navHeight < 36 || evidenceNavDims.activeHeight < 24) {
    throw new Error(`Evidence tabs squashed: ${JSON.stringify(evidenceNavDims)}`);
  }
  await capture(page, '44-drawer-tabs-evidence-dark-top');

  // 5. Scroll drawer-body down 500px to test sticky tabs
  await page.evaluate(() => {
    const body = document.querySelector('.drawer-body');
    if (body) body.scrollTop = 500;
  });
  await new Promise((r) => setTimeout(r, 400));

  const scrolledNavPosition = await page.evaluate(() => {
    const nav = document.querySelector('.drawer-tabs-nav');
    const header = document.querySelector('.drawer-header');
    const navRect = nav ? nav.getBoundingClientRect() : null;
    const headerRect = header ? header.getBoundingClientRect() : null;
    return {
      navTop: navRect ? navRect.top : 0,
      headerBottom: headerRect ? headerRect.bottom : 0,
      navHeight: nav ? nav.offsetHeight : 0,
    };
  });
  console.log('Sticky tabs position when scrolled 500px:', scrolledNavPosition);
  await capture(page, '45-drawer-tabs-evidence-scrolled-sticky');

  // 6. Switch to Counter tab while scrolled down
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('.drawer-tabs-nav button'));
    const counter = btns.find((b) => b.textContent.includes('Counter'));
    if (counter) counter.click();
  });
  await new Promise((r) => setTimeout(r, 400));
  await capture(page, '46-drawer-tabs-counter-switched');

  // 7. Test in Light mode
  await page.evaluate(() => {
    const btn = document.getElementById('btn-theme-toggle');
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 400));
  await capture(page, '47-drawer-tabs-counter-light');

  // 8. Close drawer and verify body overflow restored
  await page.click('[data-testid="btn-close-drawer"]');
  await new Promise((r) => setTimeout(r, 500));
  const restoredBodyOverflow = await page.evaluate(() => document.body.style.overflow);
  console.log('Body overflow after drawer closed:', restoredBodyOverflow || '(restored to normal)');
  if (restoredBodyOverflow === 'hidden') {
    throw new Error('Body overflow should not remain hidden after closing drawer');
  }

  await browser.close();
  console.log('=== All visual and functional drawer checks passed! ===');
}

runVerification().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
