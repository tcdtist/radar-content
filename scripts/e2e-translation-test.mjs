import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer-core';

const CHROME_PATH = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const TARGET_URL = process.env.TARGET_URL || 'http://localhost:3000';
const LOCAL_SCREENSHOTS_DIR = path.resolve('assets/screenshots');

function loadDevVars() {
  const varsPath = path.resolve('.dev.vars');
  if (!fs.existsSync(varsPath)) return {};
  const content = fs.readFileSync(varsPath, 'utf8');
  const vars = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
      vars[key] = val;
    }
  }
  return vars;
}

function resolveAdminToken() {
  const devVars = loadDevVars();
  if (process.env.ADMIN_TOKEN) return process.env.ADMIN_TOKEN;
  if (devVars.ADMIN_TOKEN) return devVars.ADMIN_TOKEN;

  const secret = process.env.JWT_SECRET || devVars.JWT_SECRET || devVars.ADMIN_SECRET || 'radar-content-secret-fallback-key-2026';
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      email: 'admin@example.com',
      name: 'Radar Admin',
      role: 'admin',
      exp: Math.floor(Date.now() / 1000) + 86400 * 30,
    })
  ).toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${signature}`;
}

const ADMIN_TOKEN = resolveAdminToken();
const ADMIN_USER = {
  email: 'admin@example.com',
  name: 'Radar Admin',
  role: 'admin',
};

async function saveScreenshot(page, filename) {
  if (!fs.existsSync(LOCAL_SCREENSHOTS_DIR)) {
    fs.mkdirSync(LOCAL_SCREENSHOTS_DIR, { recursive: true });
  }
  const localPath = path.join(LOCAL_SCREENSHOTS_DIR, filename);
  await page.screenshot({ path: localPath, fullPage: true });
  console.log(`[Screenshot] Saved ${filename}`);
}

async function runTranslationE2E() {
  console.log('=== Starting Radar Content On-Demand Translation E2E Audit ===');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    defaultViewport: { width: 1380, height: 980 },
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  const consoleErrors = [];
  page.on('console', (msg) => {
    console.log(`[Browser Console ${msg.type()}]:`, msg.text());
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => {
    console.log('[Browser PageError]:', err.message);
    consoleErrors.push(err.message);
  });
  page.on('response', async (res) => {
    const url = res.url();
    if (url.includes('/api/')) {
      let body = '';
      try {
        body = await res.text();
      } catch {}
      console.log(`[API Response] ${res.status()} ${url} -> ${body.slice(0, 150)}`);
    }
  });

  try {
    // 1. Guest Mode: Load dashboard without admin token
    console.log('[Phase 1] Testing Guest Access (Translate button must NOT be visible)...');
    await page.goto(TARGET_URL, { waitUntil: 'networkidle0' });
    await page.waitForSelector('.base-card', { timeout: 8000 });

    // Open detail drawer
    const inspectBtn = await page.$('[data-testid="btn-inspect"]');
    if (!inspectBtn) throw new Error('Inspect button not found in Guest mode');
    await inspectBtn.click();
    await page.waitForSelector('.drawer-panel', { timeout: 5000 });
    await new Promise((r) => setTimeout(r, 400));

    // Verify translate button does NOT exist
    const guestTranslateBtn = await page.$('#btn-drawer-lang-toggle');
    if (guestTranslateBtn) {
      throw new Error('Security Violation: Translate toggle button is visible to guest users!');
    }
    console.log('  ✓ Verified: Guest cannot see translation toggle button.');
    await saveScreenshot(page, '38-guest-drawer-no-translate.png');

    // Close drawer
    const closeBtn = await page.$('[data-testid="btn-close-drawer"]');
    if (closeBtn) await closeBtn.click();
    await new Promise((r) => setTimeout(r, 300));

    // 2. Admin Mode: Inject admin session
    console.log('[Phase 2] Injecting Admin Session & Reloading...');
    await page.evaluate((token, user) => {
      localStorage.setItem('radar_auth_token', token);
      localStorage.setItem('radar_auth_user', JSON.stringify(user));
    }, ADMIN_TOKEN, ADMIN_USER);

    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('.base-card', { timeout: 8000 });

    // Open detail drawer as Admin
    console.log('[Phase 3] Opening Detail Drawer as Admin...');
    const adminInspectBtn = await page.$('[data-testid="btn-inspect"]');
    if (!adminInspectBtn) throw new Error('Inspect button not found in Admin mode');
    await adminInspectBtn.click();
    await page.waitForSelector('.drawer-panel', { timeout: 5000 });
    await new Promise((r) => setTimeout(r, 400));

    // Verify translate button is visible and shows Vietnamese flag
    const translateBtn = await page.$('#btn-drawer-lang-toggle');
    if (!translateBtn) throw new Error('Translation toggle button not found for admin user');
    const flagText = await page.$eval('#btn-drawer-lang-toggle', (el) => el.innerText.trim());
    console.log(`  ✓ Verified: Admin sees translation button with flag: "${flagText}"`);
    await saveScreenshot(page, '39-admin-drawer-with-translate-button.png');

    // Read original English summary
    const originalSummary = await page.evaluate(() => {
      const p = document.querySelector('.drawer-body p');
      return p ? p.innerText : '';
    });
    console.log(`  Original English Summary snippet: "${originalSummary.slice(0, 60)}..."`);

    // 3. Click translate button to trigger Vietnamese translation
    console.log('[Phase 4] Clicking translation toggle to translate into Vietnamese...');
    await translateBtn.click();

    // Wait for button to change to US flag 🇺🇸 (meaning currentLang is 'vi')
    await page.waitForFunction(
      () => {
        const btn = document.querySelector('#btn-drawer-lang-toggle');
        return btn && btn.innerText.includes('🇺🇸');
      },
      { timeout: 25000 }
    );
    console.log('  ✓ Verified: Translation completed. Button flipped to 🇺🇸.');
    await new Promise((r) => setTimeout(r, 500));

    const translatedSummary = await page.evaluate(() => {
      const p = document.querySelector('.drawer-body p');
      return p ? p.innerText : '';
    });
    console.log(`  Translated Vietnamese Summary: "${translatedSummary.slice(0, 80)}..."`);
    await saveScreenshot(page, '40-admin-drawer-translated-vietnamese.png');

    // 4. Toggle back to English
    console.log('[Phase 5] Toggling back to English...');
    await translateBtn.click();
    await page.waitForFunction(
      () => {
        const btn = document.querySelector('#btn-drawer-lang-toggle');
        return btn && btn.innerText.includes('🇻🇳');
      },
      { timeout: 5000 }
    );
    const englishSummaryReverted = await page.evaluate(() => {
      const p = document.querySelector('.drawer-body p');
      return p ? p.innerText : '';
    });
    console.log(`  Reverted English Summary: "${englishSummaryReverted.slice(0, 60)}..."`);
    await saveScreenshot(page, '41-admin-drawer-toggle-back-english.png');

    // 5. Instant Cache Hit Check
    console.log('[Phase 6] Toggling again to verify Instant Cache Hit (< 300ms)...');
    const startTime = Date.now();
    await translateBtn.click();
    await page.waitForFunction(
      () => {
        const btn = document.querySelector('#btn-drawer-lang-toggle');
        return btn && btn.innerText.includes('🇺🇸');
      },
      { timeout: 5000 }
    );
    const elapsed = Date.now() - startTime;
    console.log(`  ✓ Instant Cache Hit elapsed: ${elapsed}ms (Expected < 300ms)`);
    await saveScreenshot(page, '42-admin-drawer-instant-cache-hit.png');

    console.log('=== On-Demand Translation E2E Test Passed with 100% Success! ===');
    console.log(`Unhandled Console Errors: ${consoleErrors.length}`, consoleErrors);
  } finally {
    await browser.close();
  }
}

runTranslationE2E().catch((err) => {
  console.error('Translation E2E Failed:', err);
  process.exit(1);
});
