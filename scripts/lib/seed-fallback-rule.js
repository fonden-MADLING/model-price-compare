// 种子数据 fallback 抽取器
// 从 meta 的 seed_pricing 种子数据直接生成模型条目，不依赖页面抽取。
// 所有结果标记 needs_review，需要人工复核。
const { buildEvidence } = require("./evidence");

function extractSeedData(meta, extractedAt) {
  const models = [];
  const evidence = [];

  for (const sourceModel of meta.models) {
    const modelId = sourceModel.id;
    const p = sourceModel.seed_pricing;

    const evidenceItems = [
      buildEvidence({
        modelId, field: "pricing.input_uncached", docUrl: meta.doc_url,
        quote: `种子数据 - 待官方文档验证`,
        normalizedValue: p.input_uncached, unit: "CNY_PER_1M_TOKENS",
        extractedAt, confidence: 0.3,
        note: `来自飞书 Base 种子数据，尚未从官方文档验证。`
      }),
      buildEvidence({
        modelId, field: "pricing.input_cached", docUrl: meta.doc_url,
        quote: `种子数据 - 待官方文档验证`,
        normalizedValue: p.input_cached, unit: "CNY_PER_1M_TOKENS",
        extractedAt, confidence: 0.3,
        note: `来自飞书 Base 种子数据，尚未从官方文档验证。`
      }),
      buildEvidence({
        modelId, field: "pricing.output", docUrl: meta.doc_url,
        quote: `种子数据 - 待官方文档验证`,
        normalizedValue: p.output, unit: "CNY_PER_1M_TOKENS",
        extractedAt, confidence: 0.3,
        note: `来自飞书 Base 种子数据，尚未从官方文档验证。`
      })
    ];
    if (p.cache_write != null) {
      evidenceItems.push(buildEvidence({
        modelId, field: "pricing.cache_write", docUrl: meta.doc_url,
        quote: `种子数据 - 待官方文档验证`,
        normalizedValue: p.cache_write, unit: "CNY_PER_1M_TOKENS",
        extractedAt, confidence: 0.3,
        note: `来自飞书 Base 种子数据，尚未从官方文档验证。`
      }));
    }

    evidence.push(...evidenceItems);
    models.push({
      id: modelId, name: sourceModel.name,
      vendor: meta.vendor, region: meta.region,
      context_window: sourceModel.seed_context_window,
      pricing: {
        currency: meta.region === "国外" ? "USD" : "CNY",
        unit: "PER_1M_TOKENS",
        input_uncached: p.input_uncached,
        input_cached: p.input_cached,
        cache_write: p.cache_write || null,
        output: p.output,
        notes: ["价格来自种子数据（飞书 Base），尚未从官方文档验证。"]
      },
      source: {
        doc_url: meta.doc_url, fetched_at: extractedAt,
        evidence_ids: evidenceItems.map((i) => i.id)
      },
      review: { status: "needs_review", confidence: 0.3, reviewed_at: null, reviewer: null }
    });
  }

  return { models, evidence };
}

module.exports = { extractSeedData };
