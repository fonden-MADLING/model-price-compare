const test = require("node:test");
const assert = require("node:assert/strict");
const { parsePriceText, parseContextWindow, normalizeModelId } = require("../scripts/lib/normalize");

test("parsePriceText extracts yuan prices", () => {
  assert.deepEqual(parsePriceText("0.025元"), { value: 0.025, currency: "CNY", unit: "PER_1M_TOKENS" });
  assert.deepEqual(parsePriceText("原价12 元/每百万tokens"), { value: 12, currency: "CNY", unit: "PER_1M_TOKENS" });
});

test("parseContextWindow handles K, M, and plus labels", () => {
  assert.deepEqual(parseContextWindow("1M"), { label: "1M", tokens: 1000000, note: null });
  assert.deepEqual(parseContextWindow("200K+"), {
    label: "200K+", tokens: 200000,
    note: "官方标注包含 +，数值按最低明确窗口记录。"
  });
});

test("normalizeModelId creates stable ids without losing version dots", () => {
  assert.equal(normalizeModelId("GLM-5.1"), "glm-5.1");
  assert.equal(normalizeModelId("Claude Opus 4.7"), "claude-opus-4.7");
});
