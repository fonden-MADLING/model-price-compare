const fs = require("fs/promises");
const path = require("path");
const { readJson, writeJson, ROOT } = require("./lib/source-utils");
const { extractDeepSeekTable } = require("./lib/deepseek-table-rule");
const { extractAliyunMarkdown } = require("./lib/aliyun-markdown-rule");

async function readText(file) {
  return fs.readFile(path.join(ROOT, file), "utf8");
}

async function main() {
  const extractedAt = new Date().toISOString();
  const allModels = [];
  const allEvidence = [];

  const deepseek = await readJson("pending/tables/deepseek-https-api-docs-deepseek-com-zh-cn-quick-start-pricing.tables.json");
  const ds = extractDeepSeekTable(deepseek, extractedAt);
  allModels.push(...ds.models);
  allEvidence.push(...ds.evidence);

  const aliyunFiles = [
    "https-bailian-console-aliyun-com-cn-beijing-tab-model-model-market-detail-qwen3-7-max",
    "https-bailian-console-aliyun-com-cn-beijing-tab-model-model-market-detail-qwen3-6-plus"
  ];

  for (const slug of aliyunFiles) {
    const markdown = await readText(`data/snapshots/opencli/${slug}.md`);
    const meta = await readJson(`data/snapshots/opencli/${slug}.meta.json`);
    const res = extractAliyunMarkdown(markdown, meta, extractedAt);
    allModels.push(...res.models);
    allEvidence.push(...res.evidence);
  }

  await writeJson("pending/models.generated.json", {
    schema_version: "1.0.0", generated_at: extractedAt,
    source_revision: "rules-v1", models: allModels
  });
  await writeJson("pending/evidence.generated.json", {
    schema_version: "1.0.0", generated_at: extractedAt,
    evidence: allEvidence
  });

  console.log(`Generated ${allModels.length} models and ${allEvidence.length} evidence items.`);
}

main().catch((err) => { console.error(err); process.exit(1); });
