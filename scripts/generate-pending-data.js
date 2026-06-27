const fs = require("fs/promises");
const path = require("path");
const { readJson, writeJson, slugify, readSources, ROOT } = require("./lib/source-utils");
const { extractDeepSeekTable } = require("./lib/deepseek-table-rule");
const { extractAliyunMarkdown } = require("./lib/aliyun-markdown-rule");
const { extractSeedData } = require("./lib/seed-fallback-rule");

async function fileExists(absPath) {
  try {
    await fs.access(absPath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const extractedAt = new Date().toISOString();
  const allModels = [];
  const allEvidence = [];

  const config = await readSources();

  for (const source of config.sources) {
    // 对于 opencli-read-docs.js 和 opencli-extract-tables.js，
    // slug = slugify(`${vendor}-${doc_url}`)
    const slug = slugify(`${source.vendor}-${source.doc_url}`);
    const metaPath = path.join(ROOT, "data", "snapshots", "opencli", `${slug}.meta.json`);
    const hasSnapshot = await fileExists(metaPath);

    if (hasSnapshot) {
      if (source.vendor === "DeepSeek") {
        // DeepSeek 用 DOM 表格抽取
        const tablesPath = path.join(ROOT, "pending", "tables", `${slug}.tables.json`);
        if (await fileExists(tablesPath)) {
          const snapshot = JSON.parse(await fs.readFile(tablesPath, "utf8"));
          const result = extractDeepSeekTable(snapshot, extractedAt);
          allModels.push(...result.models);
          allEvidence.push(...result.evidence);
        } else {
          // 有 meta.json 但无 tables.json，回退到种子数据
          const meta = JSON.parse(await fs.readFile(metaPath, "utf8"));
          const result = extractSeedData(meta, extractedAt);
          allModels.push(...result.models);
          allEvidence.push(...result.evidence);
        }
      } else if (source.vendor === "阿里") {
        // 阿里百炼用 Markdown 段落抽取
        const mdPath = path.join(ROOT, "data", "snapshots", "opencli", `${slug}.md`);
        if (await fileExists(mdPath)) {
          const [meta, markdown] = await Promise.all([
            readJson(`data/snapshots/opencli/${slug}.meta.json`),
            fs.readFile(mdPath, "utf8")
          ]);
          const result = extractAliyunMarkdown(markdown, meta, extractedAt);
          allModels.push(...result.models);
          allEvidence.push(...result.evidence);
        } else {
          // 有 meta.json 但无 .md 快照，回退到种子数据
          const meta = JSON.parse(await fs.readFile(metaPath, "utf8"));
          const result = extractSeedData(meta, extractedAt);
          allModels.push(...result.models);
          allEvidence.push(...result.evidence);
        }
      } else {
        // 有快照但暂无匹配的具体抽取规则，用种子数据 fallback
        const meta = JSON.parse(await fs.readFile(metaPath, "utf8"));
        const result = extractSeedData(meta, extractedAt);
        allModels.push(...result.models);
        allEvidence.push(...result.evidence);
      }
    } else {
      // 没有任何快照，直接从 sources.yaml 的种子数据构造
      const meta = {
        vendor: source.vendor,
        region: source.region,
        doc_url: source.doc_url,
        models: source.models
      };
      const result = extractSeedData(meta, extractedAt);
      allModels.push(...result.models);
      allEvidence.push(...result.evidence);
    }
  }

  await writeJson("pending/models.generated.json", {
    schema_version: "1.0.0",
    generated_at: extractedAt,
    source_revision: "rules-v1",
    models: allModels
  });
  await writeJson("pending/evidence.generated.json", {
    schema_version: "1.0.0",
    generated_at: extractedAt,
    evidence: allEvidence
  });

  console.log(`Generated ${allModels.length} models and ${allEvidence.length} evidence items.`);
}

main().catch((err) => { console.error(err); process.exit(1); });
