const fs = require("fs/promises");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OPENCLI_MANIFEST_FILE = path.join(ROOT, "pending", "opencli-read-manifest.json");
const FALLBACK_MANIFEST_FILE = path.join(ROOT, "pending", "fetch-manifest.json");
const PROMPT_DIR = path.join(ROOT, "pending", "opencli-inputs");

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function clipText(text, maxLength = 30000) {
  if (text.length <= maxLength) {
    return text;
  }

  // 文档页面经常包含大量导航和页脚，先截足够长的主体文本给 OpenCLI 试跑。
  return `${text.slice(0, maxLength)}\n\n[内容已截断，完整 HTML 见快照文件]`;
}

function buildPrompt(item, html, meta) {
  const pageText = clipText(stripHtml(html));
  const expectedModels = meta.models
    .map((model) => {
      return `- ${model.name} (${model.id})，Base 种子价格：未命中输入 ${model.seed_pricing.input_uncached}，命中缓存输入 ${model.seed_pricing.input_cached}，输出 ${model.seed_pricing.output}，上下文 ${model.seed_context_window.label}`;
    })
    .join("\n");

  return `你是一个严格的信息抽取器。请只基于下面的官方文档文本，抽取 AI 模型价格、缓存价格和上下文窗口。

要求：
1. 只输出 JSON，不要输出 Markdown 或解释。
2. 价格统一归一到人民币 CNY / 每百万 token；如果官方文档不是人民币，保留原币种并在 notes 说明，不要擅自换算。
3. 没有找到的字段填 null，不要猜。
4. 每个非空字段必须给 evidence，quote 只保留短摘录。
5. 如果文档文本明显不是目标内容、需要登录、或动态页面未渲染，请把 review.status 设为 needs_review。

目标厂商：${meta.vendor}
地区：${meta.region}
官方文档：${meta.doc_url}

目标模型：
${expectedModels}

请输出如下 JSON 结构：
{
  "schema_version": "1.0.0",
  "generated_at": "<ISO 时间>",
  "models": [
    {
      "id": "<模型 id>",
      "name": "<模型名称>",
      "vendor": "${meta.vendor}",
      "region": "${meta.region}",
      "context_window": {
        "label": "<例如 1M>",
        "tokens": 1000000,
        "note": null
      },
      "pricing": {
        "currency": "CNY",
        "unit": "PER_1M_TOKENS",
        "input_uncached": null,
        "input_cached": null,
        "cache_write": null,
        "output": null,
        "notes": []
      },
      "source": {
        "doc_url": "${meta.doc_url}",
        "fetched_at": "${meta.fetched_at}",
        "evidence_ids": []
      },
      "review": {
        "status": "auto_extracted",
        "confidence": 0.0,
        "reviewed_at": null,
        "reviewer": null
      }
    }
  ],
  "evidence": [
    {
      "id": "<唯一证据 id>",
      "model_id": "<模型 id>",
      "field": "pricing.input_uncached",
      "doc_url": "${meta.doc_url}",
      "quote": "<官方文档短摘录>",
      "normalized_value": null,
      "unit": "CNY_PER_1M_TOKENS",
      "extracted_at": "<ISO 时间>",
      "confidence": 0.0,
      "note": null
    }
  ]
}

官方文档文本：
${pageText}
`;
}

async function main() {
  const manifestFile = await fs
    .access(OPENCLI_MANIFEST_FILE)
    .then(() => OPENCLI_MANIFEST_FILE)
    .catch(() => FALLBACK_MANIFEST_FILE);
  const rawManifest = await fs.readFile(manifestFile, "utf8");
  const manifest = JSON.parse(rawManifest);
  await fs.mkdir(PROMPT_DIR, { recursive: true });

  const generated = [];

  for (const item of manifest.items.filter((entry) => entry.status === "ok")) {
    const sourceFile = item.markdown_file || item.html_file;
    const html = await fs.readFile(path.join(ROOT, sourceFile), "utf8");
    const meta = JSON.parse(await fs.readFile(path.join(ROOT, item.meta_file), "utf8"));
    const prompt = buildPrompt(item, html, meta);
    const promptFile = path.join(PROMPT_DIR, `${path.basename(item.meta_file, ".meta.json")}.prompt.md`);

    await fs.writeFile(promptFile, prompt);
    generated.push(path.relative(ROOT, promptFile));
  }

  await fs.writeFile(
    path.join(PROMPT_DIR, "README.md"),
    [
      "# OpenCLI 输入文件",
      "",
      "这里的 prompt 文件由 `npm run prepare:opencli` 生成。",
      "当前脚本只负责生成稳定输入，不直接调用 OpenCLI，因为本机尚未发现固定的 `opencli` 命令。",
      "确认命令后，可以把这些 prompt 文件作为 stdin 或文件参数传给 OpenCLI。",
      "",
      "已生成文件：",
      ...generated.map((file) => `- ${file}`)
    ].join("\n")
  );

  console.log(`已生成 ${generated.length} 个 OpenCLI prompt。`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
