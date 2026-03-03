import { test, expect } from '@playwright/test';

test('smoke: image loader works without CORS errors', async ({ page }) => {
    // Capture console messages
    const consoleMsgs = [];
    page.on('console', msg => {
        consoleMsgs.push({ type: msg.type(), text: msg.text() });
    });

    await page.goto('http://localhost:5173/');

    // Wait a bit for app to mount and attempt image loads
    await page.waitForTimeout(3000);

    // Check that there are no CORS errors in console
    const corsErrors = consoleMsgs.filter(m => /CORS|cross-origin/i.test(m.text));
    expect(corsErrors.length).toBe(0);

    // Optionally ensure at least one image element is present and loaded
    const imgs = await page.$$eval('img', els => els.map(i => ({ src: i.currentSrc || i.src, naturalWidth: i.naturalWidth })));
    const loaded = imgs.some(i => i.naturalWidth > 0);
    expect(loaded).toBeTruthy();
});
