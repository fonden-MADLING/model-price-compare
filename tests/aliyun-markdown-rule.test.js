const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { extractAliyunMarkdown } = require("../scripts/lib/aliyun-markdown-rule");

function readFixture(name) {
  return fs.readFileSync(path.join(__dirname, "..", "data", "snapshots", "opencli", name), "utf8");
}

test("extractAliyunMarkdown handles qwen3.7-max pricing section", () => {
  const markdown = readFixture("https-bailian-console-aliyun-com-cn-beijing-tab-model-model-market-detail-qwen3-7-max.md");
  const meta = require("../data/snapshots/opencli/https-bailian-console-aliyun-com-cn-beijing-tab-model-model-market-detail-qwen3-7-max.meta.json");
  const result = extractAliyunMarkdown(markdown, meta, "2026-06-25T15:00:00.000Z");

  assert.equal(result.models.length, 1);
  const model = result.models[0];
  assert.equal(model.id, "qwen3.7-max");
  assert.equal(model.pricing.input_uncached, 12);
  assert.equal(model.pricing.input_cached, 1.2);
  assert.equal(model.pricing.cache_write, 15);
  assert.equal(model.pricing.output, 36);
});

test("extractAliyunMarkdown handles qwen3.6-plus explicit cache hit", () => {
  const markdown = readFixture("https-bailian-console-aliyun-com-cn-beijing-tab-model-model-market-detail-qwen3-6-plus.md");
  const meta = require("../data/snapshots/opencli/https-bailian-console-aliyun-com-cn-beijing-tab-model-model-market-detail-qwen3-6-plus.meta.json");
  const result = extractAliyunMarkdown(markdown, meta, "2026-06-25T15:00:00.000Z");

  assert.equal(result.models.length, 1);
  const model = result.models[0];
  assert.equal(model.id, "qwen3.6-plus");
  assert.equal(model.pricing.input_uncached, 2);
  assert.equal(model.pricing.input_cached, 0.2);
  assert.equal(model.pricing.cache_write, 2.5);
  assert.equal(model.pricing.output, 12);
});
