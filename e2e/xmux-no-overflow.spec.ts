import { expect, test, type Page } from '@playwright/test';

async function assertNoHorizontalOverflow(page: Page) {
  const metrics = await page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    return {
      innerWidth: window.innerWidth,
      docScrollWidth: doc?.scrollWidth ?? 0,
      bodyScrollWidth: body?.scrollWidth ?? 0,
    };
  });

  expect(metrics.docScrollWidth).toBeLessThanOrEqual(metrics.innerWidth + 1);
  expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.innerWidth + 1);
}

test.describe('xmux — split layout stays within viewport (no horizontal overflow)', () => {
  const cases = [
    { width: 800, height: 500 },
    { width: 1024, height: 700 },
    { width: 1400, height: 900 },
  ] as const;

  for (const c of cases) {
    test(`viewport ${c.width}x${c.height}`, async ({ page }) => {
      await page.setViewportSize({ width: c.width, height: c.height });
      await page.goto('/xmux', { waitUntil: 'networkidle' });
      await page.waitForSelector('[data-xmux-viewport]');
      await assertNoHorizontalOverflow(page);

      const splitDown = page.getByLabel('Split pane downward').first();
      const splitRight = page.getByLabel('Split pane to the right').first();

      for (let i = 0; i < 6; i += 1) {
        await splitDown.click();
        await assertNoHorizontalOverflow(page);
      }

      for (let i = 0; i < 2; i += 1) {
        await splitRight.click();
        await assertNoHorizontalOverflow(page);
      }
    });
  }
});
