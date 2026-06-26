const test = require("node:test");
const assert = require("node:assert/strict");
const { extractDeepSeekTable } = require("../scripts/lib/deepseek-table-rule");
const tableSnapshot = require("../pending/tables/deepseek-https-api-docs-deepseek-com-zh-cn-quick-start-pricing.tables.json");

test("extractDeepSeekTable maps model columns to prices and evidence", () => {
  const result = extractDeepSeekTable(tableSnapshot, "2026-06-25T15:00:00.000Z");

  assert.equal(result.models.length, 2);
  assert.equal(result.evidence.length, 8);

  const flash = result.models.find((m) => m.id === "deepseek-v4-flash");
  assert.equal(flash.pricing.input_cached, 0.02);
  assert.equal(flash.pricing.input_uncached, 1);
  assert.equal(flash.pricing.output, 2);
  assert.equal(flash.context_window.tokens, 1000000);

  const pro = result.models.find((m) => m.id === "deepseek-v4-pro");
  assert.equal(pro.pricing.input_cached, 0.025);
  assert.equal(pro.pricing.input_uncached, 3);
  assert.equal(pro.pricing.output, 6);
  assert.equal(pro.context_window.tokens, 1000000);
});
