const { parseContextWindow, parsePriceText } = require("./normalize");
const { buildEvidence } = require("./evidence");

function cellTexts(row) {
  return row.map((cell) => cell.text);
}

function findRow(rows, label) {
  return rows.find((row) => cellTexts(row).some((text) => text.includes(label)));
}

function cleanModelName(text) {
  return text.replace(/\(\d+\)/g, "").trim();
}

function extractDeepSeekTable(snapshot, extractedAt) {
  const rows = snapshot.tables[0].rows;
  const modelRow = findRow(rows, "模型");
  const contextRow = findRow(rows, "上下文长度");
  const cachedRow = findRow(rows, "缓存命中");
  const uncachedRow = findRow(rows, "缓存未命中");
  const outputRow = findRow(rows, "百万tokens输出");

  // modelRow[0] 是"模型"标签（colspan 2），实际模型名从 index 1 开始
  const modelCells = modelRow.slice(1).map((cell) => cleanModelName(cell.text));
  const context = parseContextWindow(contextRow[1].text);

  const models = [];
  const evidence = [];

  modelCells.forEach((modelName, index) => {
    const sourceModel = snapshot.models.find((m) => m.name === modelName || m.id === modelName);
    const modelId = sourceModel ? sourceModel.id : modelName;

    // cachedRow[0]="价格"(rowspan 3), cachedRow[1]=标签，价格从 index+2 开始
    const cached = parsePriceText(cachedRow[index + 2].text);
    const uncached = parsePriceText(uncachedRow[index + 1].text);
    const output = parsePriceText(outputRow[index + 1].text);

    const evidenceItems = [
      buildEvidence({
        modelId, field: "context_window.tokens", docUrl: snapshot.doc_url,
        quote: `上下文长度 ${contextRow[1].text}`,
        normalizedValue: context.tokens, unit: "TOKENS",
        extractedAt, confidence: 0.96
      }),
      buildEvidence({
        modelId, field: "pricing.input_cached", docUrl: snapshot.doc_url,
        quote: `百万tokens输入（缓存命中） ${cachedRow.slice(2).map((c) => c.text).join(" ")}`,
        normalizedValue: cached.value, unit: "CNY_PER_1M_TOKENS",
        extractedAt, confidence: 0.96, note: "同一行价格按模型列顺序映射。"
      }),
      buildEvidence({
        modelId, field: "pricing.input_uncached", docUrl: snapshot.doc_url,
        quote: `百万tokens输入（缓存未命中） ${uncachedRow.slice(1).map((c) => c.text).join(" ")}`,
        normalizedValue: uncached.value, unit: "CNY_PER_1M_TOKENS",
        extractedAt, confidence: 0.96, note: "同一行价格按模型列顺序映射。"
      }),
      buildEvidence({
        modelId, field: "pricing.output", docUrl: snapshot.doc_url,
        quote: `百万tokens输出 ${outputRow.slice(1).map((c) => c.text).join(" ")}`,
        normalizedValue: output.value, unit: "CNY_PER_1M_TOKENS",
        extractedAt, confidence: 0.96, note: "同一行价格按模型列顺序映射。"
      })
    ];

    evidence.push(...evidenceItems);
    models.push({
      id: modelId, name: modelName,
      vendor: snapshot.vendor, region: snapshot.region,
      context_window: context,
      pricing: {
        currency: "CNY", unit: "PER_1M_TOKENS",
        input_uncached: uncached.value, input_cached: cached.value,
        cache_write: null, output: output.value, notes: []
      },
      source: {
        doc_url: snapshot.doc_url, fetched_at: extractedAt,
        evidence_ids: evidenceItems.map((item) => item.id)
      },
      review: { status: "auto_extracted", confidence: 0.96, reviewed_at: null, reviewer: null }
    });
  });

  return { models, evidence };
}

module.exports = { extractDeepSeekTable };
