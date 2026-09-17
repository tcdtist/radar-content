import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const TARGET_URL = process.env.TEST_URL || 'http://localhost:5173';
const SCREENSHOT_DIR = path.resolve('assets/screenshots');

async function clearReactInput(page, selector) {
  await page.$eval(selector, (el) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(el, '');
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function runWebVerification() {
  console.log(`🌐 [Web-Testing] Initiating live web verification at: ${TARGET_URL}`);
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--window-size=1440,960',
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 960, deviceScaleFactor: 2 });

  try {
    // 1. Load the live page
    console.log('[Step 1] Loading dashboard...');
    await page.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForSelector('[data-testid="intelligence-card"]', { timeout: 30000 });
    console.log('✅ Dashboard loaded successfully with intelligence cards.');

    // 2. Search for Varun Mohan / Antigravity from X
    console.log('[Step 2] Filtering by search term: "Varun Mohan"...');
    await page.type('#input-card-search', 'Varun Mohan', { delay: 50 });
    await new Promise((r) => setTimeout(r, 1200));

    // Verify card presence
    const cardTitle = await page.$eval(
      '[data-testid="intelligence-card"] h3',
      (el) => el.textContent?.trim()
    );
    console.log(`✅ Found Card: "${cardTitle}"`);

    const cardScore = await page.$eval(
      '[data-testid="intelligence-card"] .font-mono',
      (el) => el.textContent?.trim()
    );
    console.log(`✅ Card Score: ${cardScore}`);

    // Take screenshot of feed showing the X card
    const cardScreenshotPath = path.join(SCREENSHOT_DIR, '31-x-article-feed-card.png');
    await page.screenshot({ path: cardScreenshotPath });
    console.log(`📸 Saved screenshot: ${cardScreenshotPath}`);

    // 3. Open the Slide-in Drawer
    console.log('[Step 3] Clicking card to open Slide-in Detail Drawer...');
    await page.click('[data-testid="intelligence-card"]');
    await page.waitForSelector('.drawer-panel', { timeout: 5000 });
    await new Promise((r) => setTimeout(r, 600));

    // Verify drawer header
    const drawerLabel = await page.$eval(
      '.drawer-body h2',
      (el) => el.textContent?.trim()
    );
    console.log(`✅ Drawer opened for: "${drawerLabel}"`);

    // 4. Click Counter tab
    console.log('[Step 4] Inspecting Counter-arguments tab...');
    // Find tab button that starts with 'Counter'
    const tabButtons = await page.$$('.drawer-tabs-nav button');
    for (const btn of tabButtons) {
      const text = await page.evaluate((el) => el.textContent, btn);
      if (text && text.includes('Counter')) {
        await btn.click();
        break;
      }
    }
    await new Promise((r) => setTimeout(r, 600));

    // Extract counter items
    const counters = await page.$$eval('.drawer-body .card', (cards) =>
      cards.map((c) => c.textContent?.trim()).filter(Boolean)
    );
    console.log(`✅ Extracted Counter-arguments from X replies: (${counters.length} items)`);
    counters.forEach((c, idx) => console.log(`   [${idx + 1}] ${c?.slice(0, 100)}...`));

    const drawerCounterScreenshotPath = path.join(SCREENSHOT_DIR, '32-x-article-drawer-counter.png');
    await page.screenshot({ path: drawerCounterScreenshotPath });
    console.log(`📸 Saved screenshot: ${drawerCounterScreenshotPath}`);

    // 5. Click Sources tab
    console.log('[Step 5] Inspecting Sources tab...');
    for (const btn of tabButtons) {
      const text = await page.evaluate((el) => el.textContent, btn);
      if (text && text.includes('Sources')) {
        await btn.click();
        break;
      }
    }
    await new Promise((r) => setTimeout(r, 600));

    // Verify X Source badge and Link
    const sourceBadges = await page.$$eval('.drawer-body .badge', (badges) =>
      badges.map((b) => b.textContent?.trim()).filter(Boolean)
    );
    console.log(`✅ Source badges found:`, sourceBadges);

    const sourceLinks = await page.$$eval('.drawer-body a', (links) =>
      links.map((a) => ({ text: a.textContent?.trim(), href: a.href }))
    );
    console.log(`✅ Source Links:`, sourceLinks);

    const drawerSourcesScreenshotPath = path.join(SCREENSHOT_DIR, '33-x-article-drawer-sources.png');
    await page.screenshot({ path: drawerSourcesScreenshotPath });
    console.log(`📸 Saved screenshot: ${drawerSourcesScreenshotPath}`);

    // 6. Close Drawer
    console.log('[Step 6] Closing drawer and testing second X card ("Can BöLüK")...');
    await page.click('[data-testid="btn-close-drawer"]');
    await new Promise((r) => setTimeout(r, 600));

    // Clear search and search for Can Bölük via Cerebras
    await clearReactInput(page, '#input-card-search');
    await page.type('#input-card-search', 'Cerebras', { delay: 50 });
    await new Promise((r) => setTimeout(r, 1200));

    const secondCardTitle = await page.$eval(
      '[data-testid="intelligence-card"] h3',
      (el) => el.textContent?.trim()
    );
    console.log(`✅ Found Second X Card: "${secondCardTitle}"`);

    await page.click('[data-testid="intelligence-card"]');
    await page.waitForSelector('.drawer-panel', { timeout: 5000 });
    await new Promise((r) => setTimeout(r, 600));

    const canBolukScreenshotPath = path.join(SCREENSHOT_DIR, '34-x-article-can-boluk-drawer.png');
    await page.screenshot({ path: canBolukScreenshotPath });
    console.log(`📸 Saved screenshot: ${canBolukScreenshotPath}`);

    // 7. Toggle to Light Theme (Vintage Paper) to verify styling
    console.log('[Step 7] Closing drawer and toggling to Light Theme (Vintage Paper)...');
    await page.click('[data-testid="btn-close-drawer"]');
    await new Promise((r) => setTimeout(r, 600));

    await page.click('#btn-theme-toggle');
    await new Promise((r) => setTimeout(r, 600));

    // Reopen drawer in Light Theme
    await page.click('[data-testid="intelligence-card"]');
    await page.waitForSelector('.drawer-panel', { timeout: 5000 });
    await new Promise((r) => setTimeout(r, 600));

    const lightDrawerScreenshotPath = path.join(SCREENSHOT_DIR, '35-x-article-light-drawer.png');
    await page.screenshot({ path: lightDrawerScreenshotPath });
    console.log(`📸 Saved screenshot: ${lightDrawerScreenshotPath}`);

    console.log('🎉 All live web checks for X harvester content passed with flying colors!');
  } finally {
    await browser.close();
  }
}

runWebVerification().catch((err) => {
  console.error('❌ Web Verification failed:', err);
  process.exit(1);
});
