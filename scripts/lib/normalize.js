function normalizeModelId(name) {
  return String(name)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function parsePriceText(text) {
  const raw = String(text || "").replace(/,/g, "");
  const match = raw.match(/(\d+(?:\.\d+)?)/);
  if (!match) return { value: null, currency: "CNY", unit: "PER_1M_TOKENS" };
  return {
    value: Number(match[1]),
    currency: raw.includes("$") || raw.includes("USD") ? "USD" : "CNY",
    unit: "PER_1M_TOKENS"
  };
}

function parseContextWindow(text) {
  const label = String(text || "").trim();
  const match = label.match(/(\d+(?:\.\d+)?)([kKmM])(\+)?/);
  if (!match) {
    return { label, tokens: null, note: label ? "未识别出标准 K/M 上下文窗口，保留原始标签。" : null };
  }
  const value = Number(match[1]);
  const tokens = match[2].toUpperCase() === "M" ? value * 1000000 : value * 1000;
  return {
    label,
    tokens: Math.round(tokens),
    note: match[3] ? "官方标注包含 +，数值按最低明确窗口记录。" : null
  };
}

module.exports = { normalizeModelId, parsePriceText, parseContextWindow };
