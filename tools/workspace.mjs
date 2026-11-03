// Development helper: exercise the same visible cyclic mode button as the user.
import assert from 'node:assert/strict';
export async function switchMode(page, target) {
  for (let i = 0; i < 4; i++) {
    if (await page.locator('body').getAttribute('data-workspace') === target) return;
    await page.locator('#mode-toggle').click();
  }
  assert.equal(await page.locator('body').getAttribute('data-workspace'), target, 'Mode cycle must reach the requested workspace');
}
