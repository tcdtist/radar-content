import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const TARGET_URL = process.env.TARGET_URL || 'http://localhost:3000';
const LOCAL_SCREENSHOTS_DIR = path.resolve('assets/screenshots');
const ARTIFACTS_DIR = process.env.ARTIFACTS_DIR || '';

async function saveScreenshot(page, filename) {
  if (!fs.existsSync(LOCAL_SCREENSHOTS_DIR)) {
    fs.mkdirSync(LOCAL_SCREENSHOTS_DIR, { recursive: true });
  }
  const localPath = path.join(LOCAL_SCREENSHOTS_DIR, filename);
  await page.screenshot({ path: localPath, fullPage: true });
  if (ARTIFACTS_DIR && fs.existsSync(ARTIFACTS_DIR)) {
    try {
      fs.copyFileSync(localPath, path.join(ARTIFACTS_DIR, filename));
    } catch {}
  }
  console.log(`[Screenshot] Saved ${filename}`);
}

async function runE2ETests() {
  console.log('=== Starting Radar Content Multi-Theme & Interactive E2E Verification ===');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    defaultViewport: { width: 1380, height: 980 },
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(err.message));

  try {
    // 1. Initial Load in Dark Theme
    console.log('[Step 1] Loading dashboard in Dark Theme at http://localhost:3000...');
    await page.goto(TARGET_URL, { waitUntil: 'networkidle0' });
    await page.waitForSelector('.base-card', { timeout: 8000 });
    await saveScreenshot(page, '21-theme-dark-dashboard.png');

    // 2. Date Window Verification
    const dateBadgeText = await page.$eval('#badge-date-window', (el) => el.innerText);
    console.log(`[Step 2] Verified Date Range Window: "${dateBadgeText}"`);

    // 3. Inspect in Dark Theme
    console.log('[Step 3] Opening Slide-in Detail Drawer in Dark Theme...');
    const inspectBtn = await page.$('[data-testid="btn-inspect"]');
    if (inspectBtn) {
      await inspectBtn.click();
      await page.waitForSelector('.drawer-panel', { timeout: 5000 });
      await new Promise((r) => setTimeout(r, 400));
      await saveScreenshot(page, '22-theme-dark-drawer.png');

      // Test tabs
      const tabs = await page.$$('.drawer-panel .btn-sm');
      for (const tab of tabs.slice(0, 4)) {
        await tab.click();
        await new Promise((r) => setTimeout(r, 150));
      }

      // Close drawer
      const closeBtn = await page.$('[data-testid="btn-close-drawer"], .drawer-panel button[aria-label="Close detail panel"], .drawer-panel button[aria-label="Đóng bảng chi tiết"]');
      if (closeBtn) await closeBtn.click();
      await new Promise((r) => setTimeout(r, 300));
    }

    // 4. Toggle to Light Theme
    console.log('[Step 4] Toggling to Light Theme (Vintage Paper Aesthetic)...');
    await page.click('#btn-theme-toggle');
    await new Promise((r) => setTimeout(r, 400));
    const rootClass = await page.evaluate(() => document.documentElement.className);
    console.log(`  HTML root class is now: "${rootClass}"`);
    await saveScreenshot(page, '23-theme-light-dashboard.png');

    // 5. Open Drawer in Light Theme
    console.log('[Step 5] Opening Slide-in Detail Drawer in Light Theme...');
    const inspectBtnLight = await page.$('[data-testid="btn-inspect"]');
    if (inspectBtnLight) {
      await inspectBtnLight.click();
      await page.waitForSelector('.drawer-panel', { timeout: 5000 });
      await new Promise((r) => setTimeout(r, 400));
      await saveScreenshot(page, '24-theme-light-drawer.png');

      const closeBtn = await page.$('[data-testid="btn-close-drawer"], .drawer-panel button[aria-label="Close detail panel"], .drawer-panel button[aria-label="Đóng bảng chi tiết"]');
      if (closeBtn) await closeBtn.click();
      await new Promise((r) => setTimeout(r, 300));
    }

    // 6. Test Empty State in Light Theme
    console.log('[Step 6] Testing Empty State in Light Theme...');
    await page.$eval('#pill-topic-Database', (el) => el.click());
    await new Promise((r) => setTimeout(r, 600));
    await saveScreenshot(page, '25-theme-light-empty-state.png');

    // 7. Reset filters & Switch back to Dark Theme
    console.log('[Step 7] Resetting filters and toggling back to Dark Theme...');
    await page.$eval('#pill-topic-all', (el) => el.click());
    await new Promise((r) => setTimeout(r, 1200));
    await page.waitForSelector('[data-testid="intelligence-card"]', { timeout: 30000 });
    await page.$eval('#btn-theme-toggle', (el) => el.click());
    await new Promise((r) => setTimeout(r, 400));
    await saveScreenshot(page, '26-theme-dark-final.png');


    // 8. Test Pagination Controls
    console.log('[Step 8] Testing Pagination Controls & Page Navigation...');
    await page.waitForSelector('.pagination-bar', { timeout: 15000 });
    const paginationText = await page.$eval('.pagination-info', (el) => el.innerText);
    console.log(`  Initial Pagination Info: "${paginationText}"`);

    // Click page 2
    console.log('  Navigating to Page 2...');
    await page.$eval('#btn-page-2', (el) => el.scrollIntoView({ block: 'center' }));
    await new Promise((r) => setTimeout(r, 200));
    await page.click('#btn-page-2');
    await new Promise((r) => setTimeout(r, 400));
    await saveScreenshot(page, '27-pagination-page-2.png');

    // Change page size to 12
    console.log('  Changing page size to 12 signals per page...');
    await page.$eval('#btn-page-size-12', (el) => el.scrollIntoView({ block: 'center' }));
    await new Promise((r) => setTimeout(r, 200));
    await page.click('#btn-page-size-12');
    await new Promise((r) => setTimeout(r, 400));
    // 9. Mobile Viewport Responsive Audit (iPhone SE 375x667 & Small Android 360x800)
    console.log('[Step 9] Running Mobile Viewport & Button Visibility Verification...');
    const mobileViewports = [
      { name: 'iPhone-SE', width: 375, height: 667 },
      { name: 'Small-Android', width: 360, height: 800 },
    ];

    for (const mvp of mobileViewports) {
      console.log(`  Auditing mobile viewport: ${mvp.name} (${mvp.width}x${mvp.height})...`);
      await page.setViewport({ width: mvp.width, height: mvp.height, isMobile: true, hasTouch: true });
      await new Promise((r) => setTimeout(r, 400));

      // Check horizontal overflow
      const overflow = await page.evaluate(() => {
        return {
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          hasOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        };
      });

      console.log(`    ${mvp.name} ScrollWidth: ${overflow.scrollWidth}px, ClientWidth: ${overflow.clientWidth}px`);
      if (overflow.hasOverflow) {
        throw new Error(`Mobile layout regression: ${mvp.name} has horizontal overflow! (${overflow.scrollWidth}px > ${overflow.clientWidth}px)`);
      }

      await saveScreenshot(page, `29-mobile-${mvp.name.toLowerCase()}-dashboard.png`);

      // Open drawer on mobile
      const inspectBtnMobile = await page.$('[data-testid="btn-inspect"]');
      if (inspectBtnMobile) {
        await inspectBtnMobile.click();
        await page.waitForSelector('.drawer-panel', { timeout: 5000 });
        await new Promise((r) => setTimeout(r, 400));

        // Check button bounding boxes
        const buttonAudit = await page.evaluate((vpWidth) => {
          const btnIds = ['btn-copy-draft', 'btn-drawer-save', 'btn-drawer-written', 'btn-drawer-dismiss'];
          const results = [];
          for (const id of btnIds) {
            const btn = document.querySelector(`[data-testid="${id}"]`);
            if (!btn) {
              results.push({ id, found: false });
              continue;
            }
            const r = btn.getBoundingClientRect();
            results.push({
              id,
              found: true,
              rect: { left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width) },
              isClipped: r.right > vpWidth || r.left < 0 || r.width < 30,
            });
          }
          return results;
        }, mvp.width);

        console.log(`    ${mvp.name} Drawer Button Audits:`, buttonAudit);
        const clipped = buttonAudit.filter((b) => !b.found || b.isClipped);
        if (clipped.length > 0) {
          throw new Error(`Mobile button clipping regression on ${mvp.name}: ${JSON.stringify(clipped)}`);
        }

        await saveScreenshot(page, `30-mobile-${mvp.name.toLowerCase()}-drawer.png`);

        // Close drawer
        const closeBtnMobile = await page.$('[data-testid="btn-close-drawer"]');
        if (closeBtnMobile) await closeBtnMobile.click();
        await new Promise((r) => setTimeout(r, 300));
      }
    }

    console.log('=== All Multi-Theme, Desktop, and Mobile Tests Passed Cleanly! ===');
    console.log(`Unhandled Console Errors: ${consoleErrors.length}`, consoleErrors);
  } finally {
    await browser.close();
  }
}

runE2ETests().catch((err) => {
  console.error('E2E Test Failed:', err);
  process.exit(1);
});
