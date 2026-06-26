const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

function validateDatasets(modelsDataset, evidenceDataset) {
  const errors = [];
  const evidenceIds = new Set((evidenceDataset.evidence || []).map((item) => item.id));

  for (const model of modelsDataset.models || []) {
    if (!model.id) errors.push("model missing id");
    if (!model.name) errors.push(`${model.id}: missing name`);
    if (!["国内", "国外"].includes(model.region)) errors.push(`${model.id}: invalid region ${model.region}`);
    if (model.context_window.tokens != null && model.context_window.tokens <= 0) {
      errors.push(`${model.id}: invalid context tokens`);
    }

    const p = model.pricing;
    for (const field of ["input_uncached", "input_cached", "output"]) {
      if (p[field] != null && p[field] < 0) errors.push(`${model.id}: negative ${field}`);
    }
    if (p.input_uncached != null && p.input_cached != null && p.input_cached > p.input_uncached) {
      errors.push(`${model.id}: cached input greater than uncached input`);
    }

    for (const evId of model.source.evidence_ids || []) {
      if (!evidenceIds.has(evId)) errors.push(`${model.id}: missing evidence ${evId}`);
    }
  }

  for (const item of evidenceDataset.evidence || []) {
    if (!item.quote || item.quote.length > 240) {
      errors.push(`${item.id}: quote must be present and shorter than 240 chars`);
    }
    if (item.confidence != null && (item.confidence < 0 || item.confidence > 1)) {
      errors.push(`${item.id}: invalid confidence`);
    }
  }

  return { ok: errors.length === 0, errors };
}

function main() {
  const models = JSON.parse(fs.readFileSync(path.join(ROOT, "pending", "models.generated.json"), "utf8"));
  const evidence = JSON.parse(fs.readFileSync(path.join(ROOT, "pending", "evidence.generated.json"), "utf8"));
  const result = validateDatasets(models, evidence);
  if (!result.ok) { console.error(result.errors.join("\n")); process.exit(1); }
  console.log(`Validation passed: ${models.models.length} models, ${evidence.evidence.length} evidence items.`);
}

if (require.main === module) main();

module.exports = { validateDatasets };
