const { test, expect } = require('@playwright/test');

const BASE = 'http://localhost:5173/dist/index.html';

async function waitForLoad(page) {
  await page.goto(BASE);
  await expect(page.locator('#metaLine')).toContainText('模型数', { timeout: 10000 });
}

test('1. 页面加载：metaLine 包含"模型数：4"', async ({ page }) => {
  await waitForLoad(page);
  await expect(page.locator('#metaLine')).toContainText('模型数：4');
});

test('2. 厂商筛选下拉含 DeepSeek 和 阿里', async ({ page }) => {
  await waitForLoad(page);
  const sel = page.locator('#vendorFilter');
  await expect(sel.locator('option', { hasText: 'DeepSeek' })).toHaveCount(1);
  await expect(sel.locator('option', { hasText: '阿里' })).toHaveCount(1);
});

test('3. 表格显示4行数据', async ({ page }) => {
  await waitForLoad(page);
  await expect(page.locator('#modelRows tr')).toHaveCount(4);
});

test('4. 缓存命中率滑块拖到80，场景成本列数值变化', async ({ page }) => {
  await waitForLoad(page);
  const before = await page.locator('#modelRows').textContent();
  await page.locator('#cacheHitRate').evaluate(el => {
    el.value = '80';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const after = await page.locator('#modelRows').textContent();
  expect(before).not.toEqual(after);
});

test('5. 点击 deepseek-v4-flash 模型按钮，抽屉含 pricing.output', async ({ page }) => {
  await waitForLoad(page);
  await page.locator('button[data-model="deepseek-v4-flash"]').click();
  await expect(page.locator('#drawer')).toContainText('pricing.output');
});
