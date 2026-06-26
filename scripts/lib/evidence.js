function evidenceId(modelId, field) {
  return `ev_${modelId}_${field.replace(/[^a-z0-9]+/gi, "_")}`;
}

function buildEvidence({ modelId, field, docUrl, quote, normalizedValue, unit, extractedAt, confidence, note }) {
  return {
    id: evidenceId(modelId, field),
    model_id: modelId,
    field,
    doc_url: docUrl,
    quote,
    normalized_value: normalizedValue,
    unit,
    extracted_at: extractedAt,
    confidence,
    note: note || null
  };
}

module.exports = { evidenceId, buildEvidence };
