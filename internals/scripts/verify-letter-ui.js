/* eslint-disable no-console, no-await-in-loop */
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { chromium } = require(process.env.RIS_PLAYWRIGHT_PATH || 'playwright'); // eslint-disable-line import/no-dynamic-require
const base = process.env.RIS_QA_URL || 'http://localhost:3001';

const main = async () => {
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'ris-letter-ui-'));
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    page.setDefaultNavigationTimeout(180000);
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}/login`);
    await page.locator('#ris-login-email').fill(process.env.RIS_QA_ADMIN_EMAIL || 'admin.surat@umn.ac.id');
    await page.locator('#ris-login-password').fill(process.env.RIS_QA_ADMIN_PASSWORD || 'password');
    await page.getByRole('button', { name: 'Masuk', exact: true }).click();
    await page.waitForURL('**/ris');
    await page.goto(`${base}/ris/pengajuan-surat/jenis`);
    await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
    await page.getByRole('tab', { name: 'Templat dan PDF', exact: true }).click();
    await page.locator('.ris-letter-pdf-frame').waitFor({ timeout: 120000 });
    assert.strictEqual(await page.locator('pre.ris-letter-preview-text').count(), 0);
    assert.strictEqual(await page.locator('.ris-letter-document-settings select option').count(), 21);
    const noOverflow = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    assert(await noOverflow(), 'Desktop has horizontal overflow.');
    await page.screenshot({ path: path.join(output, 'admin-desktop.png'), fullPage: true });
    await page.locator('.ris-letter-pdf-frame').scrollIntoViewIfNeeded();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(output, 'admin-pdf-desktop.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    assert(await noOverflow(), 'Mobile has horizontal overflow.');
    await page.screenshot({ path: path.join(output, 'admin-mobile.png'), fullPage: true });
    await page.locator('.ris-letter-pdf-frame').scrollIntoViewIfNeeded();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(output, 'admin-pdf-mobile.png') });
    await page.context().request.post(`${base}/api/auth/logout`);
    await page.goto(`${base}/login`);
    await page.locator('#ris-login-email').fill(process.env.RIS_QA_LECTURER_EMAIL || 'lecturer@umn.ac.id');
    await page.locator('#ris-login-password').fill(process.env.RIS_QA_LECTURER_PASSWORD || 'password');
    await page.getByRole('button', { name: 'Masuk', exact: true }).click();
    await page.waitForURL('**/ris');
    await page.goto(`${base}/ris/pengajuan-surat/new`);
    await page.locator('.ris-letter-kind').first().click();
    assert.strictEqual(await page.locator('iframe').count(), 0, 'Lecturer has unsigned document preview.');
    assert(await noOverflow(), 'Lecturer mobile form has horizontal overflow.');
    await page.screenshot({ path: path.join(output, 'lecturer-mobile.png'), fullPage: true });
    await page.context().request.post(`${base}/api/auth/logout`);
    assert.deepStrictEqual(errors, []);
    console.log(`Letter UI, responsive layout, 21-template selector and lecturer preview restrictions passed. Images: ${output}`);
  } finally { await browser.close(); }
};
main().catch(error => { console.error(error); process.exitCode = 1; });
