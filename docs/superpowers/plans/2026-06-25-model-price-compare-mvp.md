# 模型价格对比 MVP 实施计划

> **给智能体执行者的要求：** 必须使用子技能：`superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans`，按任务逐步执行本计划。步骤使用复选框（`- [ ]`）语法跟踪进度。

**目标：** 构建一个静态 AI 模型价格对比 MVP：用 OpenCLI 抽取官方模型价格证据，校验生成数据，并渲染一个可用的无后端对比界面。

**架构：** 项目采用静态数据流水线：`data/sources.yaml` 定义官方文档来源；OpenCLI 脚本把渲染后的 Markdown 和 DOM 表格保存到 `data/snapshots/` 与 `pending/`；抽取脚本把价格归一化成生成 JSON；校验器拦截不安全数据；静态前端读取 `data/models.json` 和 `data/evidence.json`。结构可预测的页面优先使用规则抽取；结构不稳定的页面进入提示词/LLM 抽取，并标记为 `needs_review`。

**技术栈：** Node.js CommonJS 脚本、`yaml`、OpenCLI 浏览器命令、符合 JSON Schema 形状的数据文件，以及 MVP 阶段的原生静态前端。

---

## 文件结构

### 现有保留文件

- `data/sources.yaml`：从飞书 Base 导出的来源登记表。把它当作来源清单，而不是最终事实。
- `scripts/opencli-read-docs.js`：使用 OpenCLI 浏览器抽取命令保存渲染后的 Markdown 快照。
- `scripts/opencli-extract-tables.js`：使用 OpenCLI 浏览器执行命令保存 DOM 表格快照。
- `pending/extraction-strategy.json`：DeepSeek 和阿里的试点抽取策略映射。
- `docs/ui-design.md`：静态前端的 UI 目标方案。
- `docs/operation-flow.md`：人工操作流程与抽取边界说明。

### 需要新建的文件

- `scripts/lib/source-utils.js`：共享的来源解析、slug 标识生成、时间戳辅助函数和 OpenCLI 调用辅助函数。
- `scripts/lib/normalize.js`：价格和上下文窗口的单位解析与归一化辅助函数。
- `scripts/lib/evidence.js`：证据 ID 与证据条目构造器。
- `scripts/lib/deepseek-table-rule.js`：DeepSeek 风格 DOM 表格模型列的规则抽取器。
- `scripts/lib/aliyun-markdown-rule.js`：阿里百炼 Markdown 价格段落的规则抽取器。
- `scripts/generate-pending-data.js`：编排规则抽取，生成 `pending/models.generated.json` 与 `pending/evidence.generated.json`。
- `tests/normalize.test.js`：价格/上下文解析的单元测试。
- `tests/deepseek-table-rule.test.js`：使用 `pending/tables/deepseek-*.tables.json` 的单元测试。
- `tests/aliyun-markdown-rule.test.js`：使用阿里 Markdown 快照的单元测试。
- `tests/validate.test.js`：校验失败与合法生成数据的单元测试。
- `src/index.html`：静态应用外壳。
- `src/styles.css`：工作型工具的视觉样式。
- `src/app.js`：静态应用行为：加载 JSON、筛选、排序、计算成本、展示证据抽屉。

### 需要修改的文件

- `package.json`：新增 `test`、`generate:pending`、`check`、`dev`、`build:static` 脚本。
- `scripts/validate.js`：用真实校验逻辑替换占位实现。
- `scripts/build-data.js`：用“从已批准 pending 数据复制/合并到 `data/`”的逻辑替换占位实现。
- `README.md`：补充最终本地命令与工作流。
- `docs/operation-flow.md`：更新为已确定的 MVP 命令序列。

## 并行开发建议

任务 1 完成后，本计划很适合使用 `superpowers:subagent-driven-development`，因为后续工作边界清晰：

- 子代理 A：抽取规则与测试，对应任务 2-4。
- 子代理 B：校验与构建脚本，对应任务 5-6。
- 子代理 C：静态前端与全量覆盖，对应任务 7-8。

不要并行执行任务 1，因为需要先确定共享辅助函数接口；也不要并行最终集成，因为它需要一次一致的端到端运行。

---

### 任务 1：共享脚本工具

**文件：**
- 新建: `/Users/xufaming/Desktop/model-price-compare/scripts/lib/source-utils.js`
- 新建: `/Users/xufaming/Desktop/model-price-compare/scripts/lib/normalize.js`
- 新建: `/Users/xufaming/Desktop/model-price-compare/scripts/lib/evidence.js`
- 新建: `/Users/xufaming/Desktop/model-price-compare/tests/normalize.test.js`
- 修改: `/Users/xufaming/Desktop/model-price-compare/package.json`

- [ ] **步骤 1: 新增测试运行脚本**

修改 `package.json`，让 `scripts` 块包含以下内容：

```json
{
  "scripts": {
    "fetch": "node scripts/fetch-docs.js",
    "opencli:read": "node scripts/opencli-read-docs.js",
    "opencli:tables": "node scripts/opencli-extract-tables.js",
    "prepare:opencli": "node scripts/extract-opencli.js",
    "generate:pending": "node scripts/generate-pending-data.js",
    "validate": "node scripts/validate.js",
    "build:data": "node scripts/build-data.js",
    "test": "node --test tests/*.test.js",
    "check": "npm run test && npm run validate",
    "dev": "node scripts/dev-server.js",
    "build:static": "node scripts/build-static.js"
  }
}
```

预期：保留现有的 `yaml` 依赖。

- [ ] **步骤 2: 编写会失败的归一化测试**

创建 `tests/normalize.test.js`：

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  parsePriceText,
  parseContextWindow,
  normalizeModelId
} = require("../scripts/lib/normalize");

test("parsePriceText extracts yuan prices", () => {
  assert.deepEqual(parsePriceText("0.025元"), {
    value: 0.025,
    currency: "CNY",
    unit: "PER_1M_TOKENS"
  });
  assert.deepEqual(parsePriceText("原价12 元/每百万tokens"), {
    value: 12,
    currency: "CNY",
    unit: "PER_1M_TOKENS"
  });
});

test("parseContextWindow handles K, M, and plus labels", () => {
  assert.deepEqual(parseContextWindow("1M"), {
    label: "1M",
    tokens: 1000000,
    note: null
  });
  assert.deepEqual(parseContextWindow("200K+"), {
    label: "200K+",
    tokens: 200000,
    note: "官方标注包含 +，数值按最低明确窗口记录。"
  });
});

test("normalizeModelId creates stable ids without losing version dots", () => {
  assert.equal(normalizeModelId("GLM-5.1"), "glm-5.1");
  assert.equal(normalizeModelId("Claude Opus 4.7"), "claude-opus-4.7");
});
```

- [ ] **步骤 3: 运行测试确认失败**

运行：

```bash
npm run test
```

预期：测试失败，错误包含 `Cannot find module '../scripts/lib/normalize'`。

- [ ] **步骤 4: 实现归一化辅助函数**

创建 `scripts/lib/normalize.js`：

```js
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

  if (!match) {
    return {
      value: null,
      currency: "CNY",
      unit: "PER_1M_TOKENS"
    };
  }

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
    return {
      label,
      tokens: null,
      note: label ? "未识别出标准 K/M 上下文窗口，保留原始标签。" : null
    };
  }

  const value = Number(match[1]);
  const unit = match[2].toUpperCase();
  const tokens = unit === "M" ? value * 1000000 : value * 1000;

  return {
    label,
    tokens: Math.round(tokens),
    note: match[3] ? "官方标注包含 +，数值按最低明确窗口记录。" : null
  };
}

module.exports = {
  normalizeModelId,
  parsePriceText,
  parseContextWindow
};
```

- [ ] **步骤 5: 实现来源工具函数**

创建 `scripts/lib/source-utils.js`：

```js
const fs = require("fs/promises");
const path = require("path");
const { spawn } = require("child_process");
const YAML = require("yaml");

const ROOT = path.resolve(__dirname, "..", "..");
const CODEX_NODE_BIN = "/Users/xufaming/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin";
const CODEX_PNPM = "/Users/xufaming/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/pnpm";

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(path.join(ROOT, file), "utf8"));
}

async function writeJson(file, value) {
  const target = path.join(ROOT, file);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, JSON.stringify(value, null, 2));
}

async function readSources() {
  const raw = await fs.readFile(path.join(ROOT, "data", "sources.yaml"), "utf8");
  return YAML.parse(raw);
}

function runOpencli(args) {
  return new Promise((resolve, reject) => {
    const command = process.env.OPENCLI_BIN || CODEX_PNPM;
    const finalArgs = process.env.OPENCLI_BIN ? args : ["dlx", "@jackwener/opencli", ...args];
    const child = spawn(command, finalArgs, {
      cwd: ROOT,
      env: {
        ...process.env,
        PATH: `${CODEX_NODE_BIN}:${process.env.PATH || ""}`
      }
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      const error = new Error(`opencli exited with code ${code}`);
      error.stdout = stdout;
      error.stderr = stderr;
      reject(error);
    });
  });
}

module.exports = {
  ROOT,
  slugify,
  readJson,
  writeJson,
  readSources,
  runOpencli
};
```

- [ ] **步骤 6: 实现证据构造器**

创建 `scripts/lib/evidence.js`：

```js
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

module.exports = {
  evidenceId,
  buildEvidence
};
```

- [ ] **步骤 7: 运行测试**

运行：

```bash
npm run test
```

预期：测试通过。

- [ ] **步骤 8: 提交**

运行：

```bash
git add package.json scripts/lib tests/normalize.test.js
git commit -m "feat(data): 新增抽取通用工具"
```

预期：如果仓库已经初始化，提交成功；如果没有初始化，记录 `not a git repository` 并继续。

---

### 任务 2：DeepSeek DOM 表格规则抽取器

**文件：**
- 新建: `/Users/xufaming/Desktop/model-price-compare/scripts/lib/deepseek-table-rule.js`
- 新建: `/Users/xufaming/Desktop/model-price-compare/tests/deepseek-table-rule.test.js`
- 修改: `/Users/xufaming/Desktop/model-price-compare/scripts/generate-pending-data.js`

- [ ] **步骤 1: 编写会失败的 DeepSeek 规则测试**

创建 `tests/deepseek-table-rule.test.js`：

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const { extractDeepSeekTable } = require("../scripts/lib/deepseek-table-rule");
const tableSnapshot = require("../pending/tables/deepseek-https-api-docs-deepseek-com-zh-cn-quick-start-pricing.tables.json");

test("extractDeepSeekTable maps model columns to prices and evidence", () => {
  const result = extractDeepSeekTable(tableSnapshot, "2026-06-25T15:00:00.000Z");

  assert.equal(result.models.length, 2);
  assert.equal(result.evidence.length, 8);

  const flash = result.models.find((model) => model.id === "deepseek-v4-flash");
  assert.equal(flash.pricing.input_cached, 0.02);
  assert.equal(flash.pricing.input_uncached, 1);
  assert.equal(flash.pricing.output, 2);
  assert.equal(flash.context_window.tokens, 1000000);

  const pro = result.models.find((model) => model.id === "deepseek-v4-pro");
  assert.equal(pro.pricing.input_cached, 0.025);
  assert.equal(pro.pricing.input_uncached, 3);
  assert.equal(pro.pricing.output, 6);
  assert.equal(pro.context_window.tokens, 1000000);
});
```

- [ ] **步骤 2: 运行测试确认失败**

运行：

```bash
node --test tests/deepseek-table-rule.test.js
```

预期：测试失败，错误包含 `Cannot find module '../scripts/lib/deepseek-table-rule'`。

- [ ] **步骤 3: 实现 DeepSeek 表格抽取器**

创建 `scripts/lib/deepseek-table-rule.js`：

```js
const { parseContextWindow, parsePriceText } = require("./normalize");
const { buildEvidence, evidenceId } = require("./evidence");

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
  const table = snapshot.tables[0];
  const rows = table.rows;
  const modelRow = findRow(rows, "模型");
  const contextRow = findRow(rows, "上下文长度");
  const cachedRow = findRow(rows, "缓存命中");
  const uncachedRow = findRow(rows, "缓存未命中");
  const outputRow = findRow(rows, "百万tokens输出");

  const modelCells = modelRow.slice(1).map((cell) => cleanModelName(cell.text));
  const context = parseContextWindow(contextRow[1].text);

  const models = [];
  const evidence = [];

  modelCells.forEach((modelName, index) => {
    const sourceModel = snapshot.models.find((model) => model.name === modelName || model.id === modelName);
    const modelId = sourceModel ? sourceModel.id : modelName;
    const cached = parsePriceText(cachedRow[index + 2].text);
    const uncached = parsePriceText(uncachedRow[index + 1].text);
    const output = parsePriceText(outputRow[index + 1].text);

    const evidenceItems = [
      buildEvidence({
        modelId,
        field: "context_window.tokens",
        docUrl: snapshot.doc_url,
        quote: `上下文长度 ${contextRow[1].text}`,
        normalizedValue: context.tokens,
        unit: "TOKENS",
        extractedAt,
        confidence: 0.96
      }),
      buildEvidence({
        modelId,
        field: "pricing.input_cached",
        docUrl: snapshot.doc_url,
        quote: `百万tokens输入（缓存命中） ${cachedRow.slice(2).map((cell) => cell.text).join(" ")}`,
        normalizedValue: cached.value,
        unit: "CNY_PER_1M_TOKENS",
        extractedAt,
        confidence: 0.96,
        note: "同一行价格按模型列顺序映射。"
      }),
      buildEvidence({
        modelId,
        field: "pricing.input_uncached",
        docUrl: snapshot.doc_url,
        quote: `百万tokens输入（缓存未命中） ${uncachedRow.slice(1).map((cell) => cell.text).join(" ")}`,
        normalizedValue: uncached.value,
        unit: "CNY_PER_1M_TOKENS",
        extractedAt,
        confidence: 0.96,
        note: "同一行价格按模型列顺序映射。"
      }),
      buildEvidence({
        modelId,
        field: "pricing.output",
        docUrl: snapshot.doc_url,
        quote: `百万tokens输出 ${outputRow.slice(1).map((cell) => cell.text).join(" ")}`,
        normalizedValue: output.value,
        unit: "CNY_PER_1M_TOKENS",
        extractedAt,
        confidence: 0.96,
        note: "同一行价格按模型列顺序映射。"
      })
    ];

    evidence.push(...evidenceItems);

    models.push({
      id: modelId,
      name: modelName,
      vendor: snapshot.vendor,
      region: snapshot.region,
      context_window: context,
      pricing: {
        currency: "CNY",
        unit: "PER_1M_TOKENS",
        input_uncached: uncached.value,
        input_cached: cached.value,
        cache_write: null,
        output: output.value,
        notes: []
      },
      source: {
        doc_url: snapshot.doc_url,
        fetched_at: extractedAt,
        evidence_ids: evidenceItems.map((item) => item.id)
      },
      review: {
        status: "auto_extracted",
        confidence: 0.96,
        reviewed_at: null,
        reviewer: null
      }
    });
  });

  return { models, evidence };
}

module.exports = {
  extractDeepSeekTable
};
```

- [ ] **步骤 4: 运行 DeepSeek 测试**

运行：

```bash
node --test tests/deepseek-table-rule.test.js
```

预期：测试通过。

- [ ] **步骤 5: 创建 pending 生成器骨架**

创建 `scripts/generate-pending-data.js`：

```js
const path = require("path");
const { ROOT, readJson, writeJson } = require("./lib/source-utils");
const { extractDeepSeekTable } = require("./lib/deepseek-table-rule");

async function main() {
  const extractedAt = new Date().toISOString();
  const deepseek = await readJson("pending/tables/deepseek-https-api-docs-deepseek-com-zh-cn-quick-start-pricing.tables.json");
  const result = extractDeepSeekTable(deepseek, extractedAt);

  await writeJson("pending/models.generated.json", {
    schema_version: "1.0.0",
    generated_at: extractedAt,
    source_revision: "rules-v1",
    models: result.models
  });

  await writeJson("pending/evidence.generated.json", {
    schema_version: "1.0.0",
    generated_at: extractedAt,
    evidence: result.evidence
  });

  console.log(`Generated ${result.models.length} models and ${result.evidence.length} evidence items from ${path.relative(ROOT, "pending/tables")}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

- [ ] **步骤 6: 运行生成器**

运行：

```bash
npm run generate:pending
jq '.models | length' pending/models.generated.json
jq '.evidence | length' pending/evidence.generated.json
```

预期：模型数量为 `2`，证据数量为 `8`。

- [ ] **步骤 7: 提交**

运行：

```bash
git add scripts/lib/deepseek-table-rule.js scripts/generate-pending-data.js tests/deepseek-table-rule.test.js pending/models.generated.json pending/evidence.generated.json
git commit -m "feat(data): 实现 DeepSeek 表格规则抽取"
```

预期：如果仓库已经初始化，提交成功。

---

### 任务 3：阿里 Markdown 价格规则抽取器

**文件：**
- 新建: `/Users/xufaming/Desktop/model-price-compare/scripts/lib/aliyun-markdown-rule.js`
- 新建: `/Users/xufaming/Desktop/model-price-compare/tests/aliyun-markdown-rule.test.js`
- 修改: `/Users/xufaming/Desktop/model-price-compare/scripts/generate-pending-data.js`

- [ ] **步骤 1: 编写会失败的阿里测试**

创建 `tests/aliyun-markdown-rule.test.js`：

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { extractAliyunMarkdown } = require("../scripts/lib/aliyun-markdown-rule");

function readFixture(name) {
  return fs.readFileSync(path.join(__dirname, "..", "data", "snapshots", "opencli", name), "utf8");
}

test("extractAliyunMarkdown handles qwen3.7-max pricing section", () => {
  const markdown = readFixture("https-bailian-console-aliyun-com-cn-beijing-tab-model-model-market-detail-qwen3-7-max.md");
  const meta = require("../data/snapshots/opencli/https-bailian-console-aliyun-com-cn-beijing-tab-model-model-market-detail-qwen3-7-max.meta.json");
  const result = extractAliyunMarkdown(markdown, meta, "2026-06-25T15:00:00.000Z");

  assert.equal(result.models.length, 1);
  const model = result.models[0];
  assert.equal(model.id, "qwen3.7-max");
  assert.equal(model.pricing.input_uncached, 12);
  assert.equal(model.pricing.input_cached, 1.2);
  assert.equal(model.pricing.cache_write, 15);
  assert.equal(model.pricing.output, 36);
});

test("extractAliyunMarkdown handles qwen3.6-plus explicit cache hit", () => {
  const markdown = readFixture("https-bailian-console-aliyun-com-cn-beijing-tab-model-model-market-detail-qwen3-6-plus.md");
  const meta = require("../data/snapshots/opencli/https-bailian-console-aliyun-com-cn-beijing-tab-model-model-market-detail-qwen3-6-plus.meta.json");
  const result = extractAliyunMarkdown(markdown, meta, "2026-06-25T15:00:00.000Z");

  assert.equal(result.models.length, 1);
  const model = result.models[0];
  assert.equal(model.id, "qwen3.6-plus");
  assert.equal(model.pricing.input_uncached, 2);
  assert.equal(model.pricing.input_cached, 0.2);
  assert.equal(model.pricing.cache_write, 2.5);
  assert.equal(model.pricing.output, 12);
});
```

- [ ] **步骤 2: 运行测试确认失败**

运行：

```bash
node --test tests/aliyun-markdown-rule.test.js
```

预期：测试失败，错误包含 `Cannot find module '../scripts/lib/aliyun-markdown-rule'`。

- [ ] **步骤 3: 实现阿里 Markdown 抽取器**

创建 `scripts/lib/aliyun-markdown-rule.js`：

```js
const { parsePriceText } = require("./normalize");
const { buildEvidence } = require("./evidence");

function lines(markdown) {
  return String(markdown)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function findFollowingNumber(allLines, label) {
  const index = allLines.findIndex((line) => line === label || line.includes(label));
  if (index < 0) {
    return { value: null, quote: `${label} 未找到` };
  }

  const window = allLines.slice(index, index + 6);
  const originalPriceIndex = window.findIndex((line) => line.startsWith("原价"));

  if (originalPriceIndex >= 0) {
    const raw = window[originalPriceIndex].replace(/^原价/, "");
    const parsed = parsePriceText(raw);
    return {
      value: parsed.value,
      quote: window.join(" ")
    };
  }

  const numberLine = window.find((line, offset) => offset > 0 && /^\d+(\.\d+)?$/.test(line));
  const parsed = parsePriceText(numberLine || "");
  return {
    value: parsed.value,
    quote: window.join(" ")
  };
}

function extractAliyunMarkdown(markdown, meta, extractedAt) {
  const allLines = lines(markdown);
  const sourceModel = meta.models[0];
  const modelId = sourceModel.id;

  const input = findFollowingNumber(allLines, "输入");
  const explicitCacheHit = findFollowingNumber(allLines, "显式缓存命中");
  const explicitCacheWrite = findFollowingNumber(allLines, "显式缓存创建");
  const output = findFollowingNumber(allLines, "输出");

  const evidenceItems = [
    buildEvidence({
      modelId,
      field: "pricing.input_uncached",
      docUrl: meta.doc_url,
      quote: input.quote,
      normalizedValue: input.value,
      unit: "CNY_PER_1M_TOKENS",
      extractedAt,
      confidence: input.value == null ? 0.2 : 0.82,
      note: "阿里页面为非 table 结构，从“模型价格”段落按标签后续数值抽取。"
    }),
    buildEvidence({
      modelId,
      field: "pricing.input_cached",
      docUrl: meta.doc_url,
      quote: explicitCacheHit.quote,
      normalizedValue: explicitCacheHit.value,
      unit: "CNY_PER_1M_TOKENS",
      extractedAt,
      confidence: explicitCacheHit.value == null ? 0.2 : 0.86,
      note: "优先使用“显式缓存命中”，避免误用“输入（缓存命中）”。"
    }),
    buildEvidence({
      modelId,
      field: "pricing.cache_write",
      docUrl: meta.doc_url,
      quote: explicitCacheWrite.quote,
      normalizedValue: explicitCacheWrite.value,
      unit: "CNY_PER_1M_TOKENS",
      extractedAt,
      confidence: explicitCacheWrite.value == null ? 0.2 : 0.86,
      note: "缓存创建价格独立保留，不参与第一版表格默认输入缓存价。"
    }),
    buildEvidence({
      modelId,
      field: "pricing.output",
      docUrl: meta.doc_url,
      quote: output.quote,
      normalizedValue: output.value,
      unit: "CNY_PER_1M_TOKENS",
      extractedAt,
      confidence: output.value == null ? 0.2 : 0.82,
      note: "阿里页面为非 table 结构，从“模型价格”段落按标签后续数值抽取。"
    })
  ];

  return {
    models: [
      {
        id: modelId,
        name: sourceModel.name,
        vendor: meta.vendor,
        region: meta.region,
        context_window: sourceModel.seed_context_window,
        pricing: {
          currency: "CNY",
          unit: "PER_1M_TOKENS",
          input_uncached: input.value,
          input_cached: explicitCacheHit.value,
          cache_write: explicitCacheWrite.value,
          output: output.value,
          notes: ["阿里百炼页面为非标准表格，价格来自 OpenCLI Markdown 的模型价格段落。"]
        },
        source: {
          doc_url: meta.doc_url,
          fetched_at: extractedAt,
          evidence_ids: evidenceItems.map((item) => item.id)
        },
        review: {
          status: "needs_review",
          confidence: 0.84,
          reviewed_at: null,
          reviewer: null
        }
      }
    ],
    evidence: evidenceItems
  };
}

module.exports = {
  extractAliyunMarkdown
};
```

- [ ] **步骤 4: 运行阿里测试**

运行：

```bash
node --test tests/aliyun-markdown-rule.test.js
```

预期：测试通过。

- [ ] **步骤 5: 把阿里规则合并进生成器**

将 `scripts/generate-pending-data.js` 修改为：

```js
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
  const deepseekResult = extractDeepSeekTable(deepseek, extractedAt);
  allModels.push(...deepseekResult.models);
  allEvidence.push(...deepseekResult.evidence);

  const aliyunFiles = [
    "https-bailian-console-aliyun-com-cn-beijing-tab-model-model-market-detail-qwen3-7-max",
    "https-bailian-console-aliyun-com-cn-beijing-tab-model-model-market-detail-qwen3-6-plus"
  ];

  for (const slug of aliyunFiles) {
    const markdown = await readText(`data/snapshots/opencli/${slug}.md`);
    const meta = await readJson(`data/snapshots/opencli/${slug}.meta.json`);
    const result = extractAliyunMarkdown(markdown, meta, extractedAt);
    allModels.push(...result.models);
    allEvidence.push(...result.evidence);
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

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

- [ ] **步骤 6: 运行生成器并检查数量**

运行：

```bash
npm run generate:pending
jq '.models | length' pending/models.generated.json
jq '.evidence | length' pending/evidence.generated.json
jq '.models[] | {id, pricing, status:.review.status}' pending/models.generated.json
```

预期：模型数量为 `4`；证据数量为 `16`；阿里模型状态为 `needs_review`。

- [ ] **步骤 7: 提交**

运行：

```bash
git add scripts/lib/aliyun-markdown-rule.js scripts/generate-pending-data.js tests/aliyun-markdown-rule.test.js pending/models.generated.json pending/evidence.generated.json
git commit -m "feat(data): 实现阿里百炼价格段落抽取"
```

预期：如果仓库已经初始化，提交成功。

---

### 任务 4：校验脚本

**文件：**
- 修改: `/Users/xufaming/Desktop/model-price-compare/scripts/validate.js`
- 新建: `/Users/xufaming/Desktop/model-price-compare/tests/validate.test.js`

- [ ] **步骤 1: 编写会失败的校验测试**

创建 `tests/validate.test.js`：

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const { validateDatasets } = require("../scripts/validate");

test("validateDatasets accepts generated DeepSeek and Aliyun data", () => {
  const models = require("../pending/models.generated.json");
  const evidence = require("../pending/evidence.generated.json");
  const result = validateDatasets(models, evidence);
  assert.deepEqual(result.errors, []);
});

test("validateDatasets rejects cached input higher than uncached input", () => {
  const models = {
    schema_version: "1.0.0",
    generated_at: "2026-06-25T15:00:00.000Z",
    source_revision: "test",
    models: [
      {
        id: "bad-model",
        name: "bad-model",
        vendor: "Test",
        region: "国内",
        context_window: { label: "1M", tokens: 1000000, note: null },
        pricing: {
          currency: "CNY",
          unit: "PER_1M_TOKENS",
          input_uncached: 1,
          input_cached: 2,
          cache_write: null,
          output: 1,
          notes: []
        },
        source: { doc_url: "https://example.com", fetched_at: "2026-06-25T15:00:00.000Z", evidence_ids: ["ev_bad"] },
        review: { status: "auto_extracted", confidence: 0.9, reviewed_at: null, reviewer: null }
      }
    ]
  };
  const evidence = { schema_version: "1.0.0", generated_at: "2026-06-25T15:00:00.000Z", evidence: [] };
  const result = validateDatasets(models, evidence);
  assert.match(result.errors.join("\n"), /cached input greater than uncached/);
});
```

- [ ] **步骤 2: 运行测试确认失败**

运行：

```bash
node --test tests/validate.test.js
```

预期：测试失败，因为 `validateDatasets` 尚未导出。

- [ ] **步骤 3: 实现校验逻辑**

将 `scripts/validate.js` 替换为：

```js
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

function validateDatasets(modelsDataset, evidenceDataset) {
  const errors = [];
  const evidenceIds = new Set((evidenceDataset.evidence || []).map((item) => item.id));

  for (const model of modelsDataset.models || []) {
    if (!model.id) {
      errors.push("model missing id");
    }
    if (!model.name) {
      errors.push(`${model.id}: missing name`);
    }
    if (!["国内", "国外"].includes(model.region)) {
      errors.push(`${model.id}: invalid region ${model.region}`);
    }
    if (model.context_window.tokens != null && model.context_window.tokens <= 0) {
      errors.push(`${model.id}: invalid context tokens`);
    }

    const pricing = model.pricing;
    for (const field of ["input_uncached", "input_cached", "output"]) {
      if (pricing[field] != null && pricing[field] < 0) {
        errors.push(`${model.id}: negative ${field}`);
      }
    }

    if (
      pricing.input_uncached != null &&
      pricing.input_cached != null &&
      pricing.input_cached > pricing.input_uncached
    ) {
      errors.push(`${model.id}: cached input greater than uncached input`);
    }

    for (const evidenceId of model.source.evidence_ids || []) {
      if (!evidenceIds.has(evidenceId)) {
        errors.push(`${model.id}: missing evidence ${evidenceId}`);
      }
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

  if (!result.ok) {
    console.error(result.errors.join("\n"));
    process.exit(1);
  }

  console.log(`Validation passed: ${models.models.length} models, ${evidence.evidence.length} evidence items.`);
}

if (require.main === module) {
  main();
}

module.exports = {
  validateDatasets
};
```

- [ ] **步骤 4: 运行校验测试**

运行：

```bash
node --test tests/validate.test.js
npm run validate
```

预期：测试通过，并且 `npm run validate` 打印 `Validation passed`。

- [ ] **步骤 5: 提交**

运行：

```bash
git add scripts/validate.js tests/validate.test.js
git commit -m "feat(data): 增加模型价格数据校验"
```

预期：如果仓库已经初始化，提交成功。

---

### 任务 5：构建已批准的静态数据

**文件：**
- 修改: `/Users/xufaming/Desktop/model-price-compare/scripts/build-data.js`
- 修改: `/Users/xufaming/Desktop/model-price-compare/data/models.json`
- 修改: `/Users/xufaming/Desktop/model-price-compare/data/evidence.json`

- [ ] **步骤 1: 实现构建脚本**

将 `scripts/build-data.js` 替换为：

```js
const fs = require("fs/promises");
const path = require("path");
const { validateDatasets } = require("./validate");

const ROOT = path.resolve(__dirname, "..");

async function readJson(file) {
  return JSON.parse(await fs.readFile(path.join(ROOT, file), "utf8"));
}

async function writeJson(file, value) {
  await fs.writeFile(path.join(ROOT, file), JSON.stringify(value, null, 2));
}

async function main() {
  const models = await readJson("pending/models.generated.json");
  const evidence = await readJson("pending/evidence.generated.json");
  const result = validateDatasets(models, evidence);

  if (!result.ok) {
    console.error(result.errors.join("\n"));
    process.exit(1);
  }

  await writeJson("data/models.json", models);
  await writeJson("data/evidence.json", evidence);
  console.log(`Built data/models.json and data/evidence.json from pending data.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

- [ ] **步骤 2: 运行构建**

运行：

```bash
npm run build:data
jq '.models | length' data/models.json
jq '.evidence | length' data/evidence.json
```

预期：模型数量为 `4`，证据数量为 `16`。

- [ ] **步骤 3: 验证数据文件包含证据链接**

运行：

```bash
jq -r '.models[] | [.id, (.source.evidence_ids | length), .review.status] | @tsv' data/models.json
```

预期：每一行的证据数量都大于 `0`；DeepSeek 状态为 `auto_extracted`；阿里状态为 `needs_review`。

- [ ] **步骤 4: 提交**

运行：

```bash
git add scripts/build-data.js data/models.json data/evidence.json
git commit -m "feat(data): 构建静态展示数据"
```

预期：如果仓库已经初始化，提交成功。

---

### 任务 6：静态前端 MVP

**文件：**
- 新建: `/Users/xufaming/Desktop/model-price-compare/src/index.html`
- 新建: `/Users/xufaming/Desktop/model-price-compare/src/styles.css`
- 新建: `/Users/xufaming/Desktop/model-price-compare/src/app.js`
- 新建: `/Users/xufaming/Desktop/model-price-compare/scripts/dev-server.js`
- 新建: `/Users/xufaming/Desktop/model-price-compare/scripts/build-static.js`
- 修改: `/Users/xufaming/Desktop/model-price-compare/package.json`

- [ ] **步骤 1: 创建应用外壳**

创建 `src/index.html`：

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>AI 模型价格对比</title>
    <link rel="stylesheet" href="./styles.css">
  </head>
  <body>
    <header class="topbar">
      <div>
        <h1>AI 模型价格对比</h1>
        <p id="metaLine">正在加载数据...</p>
      </div>
      <div class="topbar-actions">
        <a href="../data/models.json" download>下载模型 JSON</a>
        <a href="../data/evidence.json" download>下载证据 JSON</a>
      </div>
    </header>

    <section class="calculator" aria-label="成本计算器">
      <label>输入 token <input id="inputTokens" type="number" min="0" value="100000"></label>
      <label>输出 token <input id="outputTokens" type="number" min="0" value="20000"></label>
      <label>缓存命中率 <input id="cacheHitRate" type="range" min="0" max="100" value="50"></label>
      <span id="cacheHitLabel">50%</span>
    </section>

    <main class="layout">
      <aside class="filters">
        <h2>筛选</h2>
        <label>厂商 <select id="vendorFilter"><option value="">全部</option></select></label>
        <label>国内外 <select id="regionFilter"><option value="">全部</option><option>国内</option><option>国外</option></select></label>
        <label>证据状态 <select id="statusFilter"><option value="">全部</option><option value="auto_extracted">自动抽取</option><option value="needs_review">待复核</option><option value="verified">已复核</option></select></label>
      </aside>

      <section class="table-wrap">
        <table>
          <thead>
            <tr>
              <th data-sort="name">模型</th>
              <th data-sort="vendor">厂商</th>
              <th data-sort="region">国内外</th>
              <th data-sort="context">上下文</th>
              <th data-sort="input_uncached">未命中输入</th>
              <th data-sort="input_cached">命中缓存输入</th>
              <th data-sort="output">输出</th>
              <th data-sort="scenario_cost">场景成本</th>
              <th data-sort="status">证据状态</th>
            </tr>
          </thead>
          <tbody id="modelRows"></tbody>
        </table>
      </section>
    </main>

    <aside id="drawer" class="drawer" aria-hidden="true">
      <button id="closeDrawer" type="button">关闭</button>
      <div id="drawerContent"></div>
    </aside>

    <script src="./app.js"></script>
  </body>
</html>
```

- [ ] **步骤 2: 创建样式**

创建 `src/styles.css`：

```css
:root {
  color-scheme: light;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background: #f6f8fb;
  color: #172033;
}

body {
  margin: 0;
}

.topbar {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  align-items: center;
  padding: 18px 24px;
  background: #ffffff;
  border-bottom: 1px solid #dbe2ea;
}

h1 {
  margin: 0;
  font-size: 22px;
  letter-spacing: 0;
}

h2 {
  margin: 0 0 14px;
  font-size: 16px;
}

p {
  margin: 6px 0 0;
  color: #5c697a;
}

a,
button {
  color: #1456d9;
}

.topbar-actions {
  display: flex;
  gap: 12px;
  font-size: 14px;
}

.calculator {
  display: grid;
  grid-template-columns: repeat(4, minmax(160px, 1fr));
  gap: 14px;
  padding: 16px 24px;
  background: #ffffff;
  border-bottom: 1px solid #dbe2ea;
}

label {
  display: grid;
  gap: 6px;
  font-size: 13px;
  color: #4c596b;
}

input,
select {
  height: 34px;
  border: 1px solid #c8d2df;
  border-radius: 6px;
  padding: 0 10px;
  background: #ffffff;
  color: #172033;
}

.layout {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  min-height: calc(100vh - 130px);
}

.filters {
  padding: 18px;
  border-right: 1px solid #dbe2ea;
  background: #ffffff;
}

.filters label {
  margin-bottom: 14px;
}

.table-wrap {
  overflow: auto;
  padding: 18px;
}

table {
  width: 100%;
  min-width: 980px;
  border-collapse: collapse;
  background: #ffffff;
  border: 1px solid #dbe2ea;
}

th,
td {
  padding: 10px 12px;
  border-bottom: 1px solid #e7edf4;
  text-align: left;
  font-size: 14px;
  white-space: nowrap;
}

th {
  position: sticky;
  top: 0;
  background: #f0f4f9;
  cursor: pointer;
  color: #344054;
}

tr:hover td {
  background: #f8fbff;
}

.status {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
}

.status.auto_extracted {
  background: #e7f7ee;
  color: #17643a;
}

.status.needs_review {
  background: #fff6dd;
  color: #8a5a00;
}

.drawer {
  position: fixed;
  top: 0;
  right: 0;
  width: min(520px, 92vw);
  height: 100vh;
  overflow: auto;
  background: #ffffff;
  border-left: 1px solid #dbe2ea;
  box-shadow: -12px 0 30px rgba(15, 23, 42, 0.12);
  padding: 18px;
  transform: translateX(100%);
  transition: transform 160ms ease;
}

.drawer.open {
  transform: translateX(0);
}

.evidence {
  margin: 12px 0;
  padding: 12px;
  background: #f6f8fb;
  border: 1px solid #e1e7ef;
  border-radius: 6px;
}
```

- [ ] **步骤 3: 创建前端行为逻辑**

创建 `src/app.js`：

```js
const state = {
  models: [],
  evidence: [],
  sortKey: "scenario_cost",
  sortDir: "asc"
};

const rowsEl = document.getElementById("modelRows");
const vendorFilter = document.getElementById("vendorFilter");
const regionFilter = document.getElementById("regionFilter");
const statusFilter = document.getElementById("statusFilter");
const inputTokens = document.getElementById("inputTokens");
const outputTokens = document.getElementById("outputTokens");
const cacheHitRate = document.getElementById("cacheHitRate");
const cacheHitLabel = document.getElementById("cacheHitLabel");
const drawer = document.getElementById("drawer");
const drawerContent = document.getElementById("drawerContent");

function money(value) {
  if (value == null) return "待抽取";
  return `${value.toFixed(value < 1 ? 3 : 2)} 元`;
}

function scenarioCost(model) {
  const input = Number(inputTokens.value || 0);
  const output = Number(outputTokens.value || 0);
  const hitRate = Number(cacheHitRate.value || 0) / 100;
  const uncached = model.pricing.input_uncached;
  const cached = model.pricing.input_cached;
  const outputPrice = model.pricing.output;

  if (uncached == null || cached == null || outputPrice == null) return null;

  return (input / 1000000) * (hitRate * cached + (1 - hitRate) * uncached) + (output / 1000000) * outputPrice;
}

function sortValue(model, key) {
  if (key === "context") return model.context_window.tokens || 0;
  if (key === "scenario_cost") return scenarioCost(model) ?? Number.POSITIVE_INFINITY;
  if (key in model.pricing) return model.pricing[key] ?? Number.POSITIVE_INFINITY;
  if (key === "status") return model.review.status;
  return model[key] || "";
}

function filteredModels() {
  return state.models
    .filter((model) => !vendorFilter.value || model.vendor === vendorFilter.value)
    .filter((model) => !regionFilter.value || model.region === regionFilter.value)
    .filter((model) => !statusFilter.value || model.review.status === statusFilter.value)
    .sort((a, b) => {
      const av = sortValue(a, state.sortKey);
      const bv = sortValue(b, state.sortKey);
      const result = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv), "zh-CN");
      return state.sortDir === "asc" ? result : -result;
    });
}

function renderRows() {
  cacheHitLabel.textContent = `${cacheHitRate.value}%`;
  rowsEl.innerHTML = "";

  for (const model of filteredModels()) {
    const cost = scenarioCost(model);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><button type="button" data-model="${model.id}">${model.name}</button></td>
      <td>${model.vendor}</td>
      <td>${model.region}</td>
      <td>${model.context_window.label}</td>
      <td>${money(model.pricing.input_uncached)}</td>
      <td>${money(model.pricing.input_cached)}</td>
      <td>${money(model.pricing.output)}</td>
      <td>${cost == null ? "待抽取" : money(cost)}</td>
      <td><span class="status ${model.review.status}">${model.review.status}</span></td>
    `;
    rowsEl.appendChild(tr);
  }
}

function openDrawer(modelId) {
  const model = state.models.find((item) => item.id === modelId);
  const evidence = state.evidence.filter((item) => model.source.evidence_ids.includes(item.id));
  drawerContent.innerHTML = `
    <h2>${model.name}</h2>
    <p>${model.vendor} / ${model.region}</p>
    <p><a href="${model.source.doc_url}" target="_blank" rel="noreferrer">官方文档</a></p>
    <h3>价格</h3>
    <p>未命中输入：${money(model.pricing.input_uncached)}</p>
    <p>命中缓存输入：${money(model.pricing.input_cached)}</p>
    <p>输出：${money(model.pricing.output)}</p>
    <h3>证据</h3>
    ${evidence.map((item) => `
      <div class="evidence">
        <strong>${item.field}</strong>
        <p>${item.quote}</p>
        <p>值：${item.normalized_value} / 置信度：${item.confidence}</p>
      </div>
    `).join("")}
  `;
  drawer.classList.add("open");
  drawer.setAttribute("aria-hidden", "false");
}

async function load() {
  const [models, evidence] = await Promise.all([
    fetch("../data/models.json").then((res) => res.json()),
    fetch("../data/evidence.json").then((res) => res.json())
  ]);
  state.models = models.models;
  state.evidence = evidence.evidence;
  document.getElementById("metaLine").textContent = `更新时间：${models.generated_at || "未生成"} / 模型数：${state.models.length}`;

  for (const vendor of [...new Set(state.models.map((model) => model.vendor))].sort()) {
    const option = document.createElement("option");
    option.value = vendor;
    option.textContent = vendor;
    vendorFilter.appendChild(option);
  }

  renderRows();
}

document.querySelectorAll("th[data-sort]").forEach((th) => {
  th.addEventListener("click", () => {
    const key = th.dataset.sort;
    state.sortDir = state.sortKey === key && state.sortDir === "asc" ? "desc" : "asc";
    state.sortKey = key;
    renderRows();
  });
});

rowsEl.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-model]");
  if (button) openDrawer(button.dataset.model);
});

document.getElementById("closeDrawer").addEventListener("click", () => {
  drawer.classList.remove("open");
  drawer.setAttribute("aria-hidden", "true");
});

[vendorFilter, regionFilter, statusFilter, inputTokens, outputTokens, cacheHitRate].forEach((input) => {
  input.addEventListener("input", renderRows);
});

load().catch((error) => {
  document.getElementById("metaLine").textContent = `加载失败：${error.message}`;
});
```

- [ ] **步骤 4: 创建开发服务器**

创建 `scripts/dev-server.js`：

```js
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.env.PORT || 5173);

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split("?")[0]);
  const relative = urlPath === "/" ? "src/index.html" : urlPath.replace(/^\//, "");
  const file = path.join(ROOT, relative);

  if (!file.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(file, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Static preview: http://localhost:${PORT}`);
});
```

- [ ] **步骤 5: 创建静态构建脚本**

创建 `scripts/build-static.js`：

```js
const fs = require("fs/promises");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");

async function copyFile(source, target) {
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.copyFile(source, target);
}

async function main() {
  await fs.rm(DIST, { recursive: true, force: true });
  await copyFile(path.join(ROOT, "src", "index.html"), path.join(DIST, "index.html"));
  await copyFile(path.join(ROOT, "src", "styles.css"), path.join(DIST, "styles.css"));
  await copyFile(path.join(ROOT, "src", "app.js"), path.join(DIST, "app.js"));
  await copyFile(path.join(ROOT, "data", "models.json"), path.join(DIST, "data", "models.json"));
  await copyFile(path.join(ROOT, "data", "evidence.json"), path.join(DIST, "data", "evidence.json"));
  console.log(`Built static site at ${DIST}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

- [ ] **步骤 6: 修正数据加载路径以兼容 dist**

修改 `src/app.js` 的数据加载路径：

```js
fetch("./data/models.json").then((res) => res.json())
fetch("./data/evidence.json").then((res) => res.json())
```

修改 `src/index.html` 的下载链接：

```html
<a href="./data/models.json" download>下载模型 JSON</a>
<a href="./data/evidence.json" download>下载证据 JSON</a>
```

- [ ] **步骤 7: 构建静态站点**

运行：

```bash
npm run build:static
find dist -maxdepth 3 -type f | sort
```

预期：生成 `dist/index.html`、`dist/styles.css`、`dist/app.js`、`dist/data/models.json`、`dist/data/evidence.json`。

- [ ] **步骤 8: 提交**

运行：

```bash
git add src scripts/dev-server.js scripts/build-static.js package.json dist
git commit -m "feat(ui): 新增静态模型价格对比页面"
```

预期：如果仓库已经初始化，提交成功。

---

### 任务 7：端到端验证

**文件：**
- 修改: `/Users/xufaming/Desktop/model-price-compare/README.md`
- 修改: `/Users/xufaming/Desktop/model-price-compare/docs/operation-flow.md`

- [ ] **步骤 1: 运行完整数据流水线**

运行：

```bash
npm run opencli:read -- --limit 3
npm run opencli:tables -- --limit 3
npm run generate:pending
npm run validate
npm run build:data
npm run build:static
```

预期：所有命令都以 0 退出。

- [ ] **步骤 2: 验证生成的模型数据**

运行：

```bash
jq -r '.models[] | [.id, .vendor, .pricing.input_uncached, .pricing.input_cached, .pricing.output, .review.status] | @tsv' data/models.json
```

预期行：

```text
deepseek-v4-flash	DeepSeek	1	0.02	2	auto_extracted
deepseek-v4-pro	DeepSeek	3	0.025	6	auto_extracted
qwen3.7-max	阿里	12	1.2	36	needs_review
qwen3.6-plus	阿里	2	0.2	12	needs_review
```

- [ ] **步骤 3: 启动本地预览服务器**

运行：

```bash
npm run dev
```

预期：终端打印 `Static preview: http://localhost:5173`。

- [ ] **步骤 4: 浏览器冒烟测试**

打开 `http://localhost:5173` 并确认：

- 顶部显示模型数量 `4`。
- 厂商筛选包含 `DeepSeek` 和 `阿里`。
- 表格展示四个模型。
- 调整缓存命中率会改变场景成本。
- 点击模型会打开证据抽屉。

- [ ] **步骤 5: 更新 README 命令**

修改 `README.md`，加入以下内容：

````markdown
## 本地完整流程

```bash
npm install
npm run opencli:read -- --limit 3
npm run opencli:tables -- --limit 3
npm run generate:pending
npm run validate
npm run build:data
npm run build:static
npm run dev
```

预览地址：`http://localhost:5173`
````

- [ ] **步骤 6: 提交**

运行：

```bash
git add README.md docs/operation-flow.md data/models.json data/evidence.json dist
git commit -m "docs(workflow): 完善模型价格对比本地流程"
```

预期：如果仓库已经初始化，提交成功。

---

### 任务 8：剩余 26 个模型的铺开计划

**文件：**
- 新建: `/Users/xufaming/Desktop/model-price-compare/docs/extraction-coverage.md`

- [ ] **步骤 1: 运行全部 OpenCLI 读取**

运行：

```bash
npm run opencli:read
npm run opencli:tables
```

预期：清单包含 `data/sources.yaml` 中每个唯一的 `doc_url`。已知风险：部分页面可能失败，或需要备用抽取/LLM。

- [ ] **步骤 2: 创建覆盖报告**

创建 `docs/extraction-coverage.md`：

```markdown
# 抽取覆盖报告

## 当前已规则化

| 厂商 | 页面 | 策略 | 状态 |
| --- | --- | --- | --- |
| DeepSeek | 价格页 | DOM 表格 | 已验证 |
| 阿里百炼 | 模型详情页 | Markdown 价格段落 | 待人工复核 |

## 待扩展

| 厂商 | 预期策略 | 备注 |
| --- | --- | --- |
| 字节/火山引擎 | 待运行 OpenCLI 后判断 | 可能是文档表格 |
| 智谱 | 待运行 OpenCLI 后判断 | 可能是价格页表格 |
| MiniMax | 待运行 OpenCLI 后判断 | 可能是文档段落 |
| 月之暗面 | 待运行 OpenCLI 后判断 | 每个模型独立页面 |
| OpenAI | 待运行 OpenCLI 后判断 | 可能需要 USD/CNY 换算策略 |
| Anthropic | 待运行 OpenCLI 后判断 | 可能需要 USD/CNY 换算策略 |
| xAI | 待运行 OpenCLI 后判断 | 可能需要 USD/CNY 换算策略 |

## 扩展原则

- 优先规则抽取，只有页面结构不稳定时才用 LLM。
- 外币价格不得自动换算成人民币，除非新增汇率字段和汇率日期。
- 所有非空价格字段必须有证据记录。
- `needs_review` 的数据可以展示，但界面必须明确标记。
```

- [ ] **步骤 3: 提交**

运行：

```bash
git add docs/extraction-coverage.md pending/opencli-read-manifest.json pending/opencli-table-manifest.json data/snapshots/opencli pending/tables
git commit -m "docs(data): 梳理全量模型抽取覆盖"
```

预期：如果仓库已经初始化，提交成功。

---

## 自检

### 需求覆盖

- OpenCLI 官方页面抽取：由任务 2、3、8 覆盖。
- 证据保留：由任务 1-5 覆盖。
- 无后端静态部署路径：由任务 5-7 覆盖。
- UI 设计实现：由任务 6 覆盖。
- 剩余 26 个模型的全量工作：由任务 8 覆盖。
- 多引擎并行选项：由并行开发建议覆盖。

### 占位内容扫描

没有残留模板占位表述。每个实施任务都包含明确文件、代码、命令和预期输出。

### 类型一致性

本计划一致使用：

- `models.generated.json`，结构为 `{ schema_version, generated_at, source_revision, models }`。
- `evidence.generated.json`，结构为 `{ schema_version, generated_at, evidence }`。
- `pricing.input_uncached`、`pricing.input_cached`、`pricing.cache_write`、`pricing.output`。
- `review.status` 使用 `data/models.schema.json` 已接受的取值。
