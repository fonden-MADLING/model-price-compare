const test = require("node:test");
const assert = require("node:assert/strict");
const { validateDatasets } = require("../scripts/validate");

test("validateDatasets accepts generated data", () => {
  const models = require("../pending/models.generated.json");
  const evidence = require("../pending/evidence.generated.json");
  const result = validateDatasets(models, evidence);
  assert.deepEqual(result.errors, []);
});

test("validateDatasets rejects cached input higher than uncached input", () => {
  const models = {
    schema_version: "1.0.0", generated_at: "2026-06-25T15:00:00.000Z", source_revision: "test",
    models: [{
      id: "bad-model", name: "bad-model", vendor: "Test", region: "国内",
      context_window: { label: "1M", tokens: 1000000, note: null },
      pricing: { currency: "CNY", unit: "PER_1M_TOKENS", input_uncached: 1, input_cached: 2, cache_write: null, output: 1, notes: [] },
      source: { doc_url: "https://example.com", fetched_at: "2026-06-25T15:00:00.000Z", evidence_ids: ["ev_bad"] },
      review: { status: "auto_extracted", confidence: 0.9, reviewed_at: null, reviewer: null }
    }]
  };
  const evidence = { schema_version: "1.0.0", generated_at: "2026-06-25T15:00:00.000Z", evidence: [] };
  const result = validateDatasets(models, evidence);
  assert.match(result.errors.join("\n"), /cached input greater than uncached/);
});
