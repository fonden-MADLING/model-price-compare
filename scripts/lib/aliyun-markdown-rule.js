const { parsePriceText } = require("./normalize");
const { buildEvidence } = require("./evidence");

function lines(markdown) {
  return String(markdown).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
}

// 使用精确等值匹配，避免"输入<=256k"之类的标签误匹配"输入"
function findFollowingNumber(allLines, label) {
  const index = allLines.findIndex((line) => line === label);
  if (index < 0) return { value: null, quote: `${label} 未找到` };

  const window = allLines.slice(index, index + 6);
  const quote = window.join(" ");

  // 只在前4行内找"原价XX"，避免6行窗口跨越到下一个价格区块后误命中
  const nearWindow = window.slice(0, 4);
  const originalPriceIdx = nearWindow.findIndex((line) => line.startsWith("原价"));
  if (originalPriceIdx >= 0) {
    const raw = nearWindow[originalPriceIdx].replace(/^原价/, "");
    return { value: parsePriceText(raw).value, quote };
  }

  // 回退：找紧随标签后的纯数字行
  const numberLine = window.find((line, offset) => offset > 0 && /^\d+(\.\d+)?$/.test(line));
  return { value: parsePriceText(numberLine || "").value, quote };
}

function extractAliyunMarkdown(markdown, meta, extractedAt) {
  const allLines = lines(markdown);
  const sourceModel = meta.models[0];
  const modelId = sourceModel.id;

  const input = findFollowingNumber(allLines, "输入");
  // 优先使用显式缓存命中，避免误用"输入（缓存命中）"普通缓存价格
  const explicitCacheHit = findFollowingNumber(allLines, "显式缓存命中");
  const explicitCacheWrite = findFollowingNumber(allLines, "显式缓存创建");
  const output = findFollowingNumber(allLines, "输出");

  const evidenceItems = [
    buildEvidence({
      modelId, field: "pricing.input_uncached", docUrl: meta.doc_url,
      quote: input.quote, normalizedValue: input.value,
      unit: "CNY_PER_1M_TOKENS", extractedAt,
      confidence: input.value == null ? 0.2 : 0.82,
      note: "阿里页面为非 table 结构，从模型价格段落按标签后续数值抽取。"
    }),
    buildEvidence({
      modelId, field: "pricing.input_cached", docUrl: meta.doc_url,
      quote: explicitCacheHit.quote, normalizedValue: explicitCacheHit.value,
      unit: "CNY_PER_1M_TOKENS", extractedAt,
      confidence: explicitCacheHit.value == null ? 0.2 : 0.86,
      note: "优先使用显式缓存命中，避免误用输入缓存命中普通缓存价格。"
    }),
    buildEvidence({
      modelId, field: "pricing.cache_write", docUrl: meta.doc_url,
      quote: explicitCacheWrite.quote, normalizedValue: explicitCacheWrite.value,
      unit: "CNY_PER_1M_TOKENS", extractedAt,
      confidence: explicitCacheWrite.value == null ? 0.2 : 0.86,
      note: "缓存创建价格独立保留，不参与第一版表格默认输入缓存价。"
    }),
    buildEvidence({
      modelId, field: "pricing.output", docUrl: meta.doc_url,
      quote: output.quote, normalizedValue: output.value,
      unit: "CNY_PER_1M_TOKENS", extractedAt,
      confidence: output.value == null ? 0.2 : 0.82,
      note: "阿里页面为非 table 结构，从模型价格段落按标签后续数值抽取。"
    })
  ];

  return {
    models: [{
      id: modelId, name: sourceModel.name,
      vendor: meta.vendor, region: meta.region,
      context_window: sourceModel.seed_context_window,
      pricing: {
        currency: "CNY", unit: "PER_1M_TOKENS",
        input_uncached: input.value, input_cached: explicitCacheHit.value,
        cache_write: explicitCacheWrite.value, output: output.value,
        notes: ["阿里百炼页面为非标准表格，价格来自 OpenCLI Markdown 的模型价格段落。"]
      },
      source: {
        doc_url: meta.doc_url, fetched_at: extractedAt,
        evidence_ids: evidenceItems.map((item) => item.id)
      },
      review: { status: "needs_review", confidence: 0.84, reviewed_at: null, reviewer: null }
    }],
    evidence: evidenceItems
  };
}

module.exports = { extractAliyunMarkdown };
