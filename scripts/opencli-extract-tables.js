const fs = require("fs/promises");
const path = require("path");
const { spawn } = require("child_process");
const YAML = require("yaml");

const ROOT = path.resolve(__dirname, "..");
const SOURCES_FILE = path.join(ROOT, "data", "sources.yaml");
const TABLE_DIR = path.join(ROOT, "pending", "tables");
const MANIFEST_FILE = path.join(ROOT, "pending", "opencli-table-manifest.json");

const CODEX_NODE_BIN = "/Users/xufaming/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin";
const CODEX_PNPM = "/Users/xufaming/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/pnpm";

function parseArgs(argv) {
  const args = {
    limit: Infinity,
    vendor: null,
    model: null
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--limit") {
      args.limit = Number(argv[i + 1]);
      i += 1;
    } else if (arg === "--vendor") {
      args.vendor = argv[i + 1];
      i += 1;
    } else if (arg === "--model") {
      args.model = argv[i + 1];
      i += 1;
    }
  }

  return args;
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function collectDocTargets(config, args) {
  const targets = new Map();

  for (const source of config.sources || []) {
    if (args.vendor && source.vendor !== args.vendor) {
      continue;
    }

    const models = (source.models || []).filter((model) => {
      return !args.model || model.id === args.model || model.name === args.model;
    });

    if (models.length === 0) {
      continue;
    }

    const existing = targets.get(source.doc_url);
    if (existing) {
      existing.models.push(...models);
      continue;
    }

    targets.set(source.doc_url, {
      vendor: source.vendor,
      region: source.region,
      doc_url: source.doc_url,
      models: [...models]
    });
  }

  return [...targets.values()].slice(0, args.limit);
}

function opencliArgs(args) {
  if (process.env.OPENCLI_BIN) {
    return {
      command: process.env.OPENCLI_BIN,
      args
    };
  }

  return {
    command: CODEX_PNPM,
    args: ["dlx", "@jackwener/opencli", ...args]
  };
}

function runOpencli(args) {
  return new Promise((resolve, reject) => {
    const invocation = opencliArgs(args);
    const child = spawn(invocation.command, invocation.args, {
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

async function extractTables(target, index) {
  const session = `model-price-table-${index + 1}`;
  const expression = `(() => Array.from(document.querySelectorAll("main table, article table, table")).map((table, tableIndex) => ({
    tableIndex,
    caption: table.caption?.innerText?.trim() || null,
    rows: Array.from(table.querySelectorAll("tr")).map((row) =>
      Array.from(row.querySelectorAll("th,td")).map((cell) => ({
        text: cell.innerText.trim().replace(/\\s+/g, " "),
        colspan: Number(cell.getAttribute("colspan") || 1),
        rowspan: Number(cell.getAttribute("rowspan") || 1),
        tag: cell.tagName.toLowerCase()
      }))
    )
  })))()`;

  const openResult = await runOpencli(["browser", session, "open", target.doc_url]);
  const evalResult = await runOpencli(["browser", session, "eval", expression]);
  await runOpencli(["browser", session, "close"]).catch(() => null);

  return {
    open: JSON.parse(openResult.stdout),
    tables: JSON.parse(evalResult.stdout)
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const raw = await fs.readFile(SOURCES_FILE, "utf8");
  const config = YAML.parse(raw);
  const targets = collectDocTargets(config, args);
  const generatedAt = new Date().toISOString();

  await fs.mkdir(TABLE_DIR, { recursive: true });

  const manifest = {
    generated_at: generatedAt,
    source_file: path.relative(ROOT, SOURCES_FILE),
    table_dir: path.relative(ROOT, TABLE_DIR),
    count: targets.length,
    items: []
  };

  for (let index = 0; index < targets.length; index += 1) {
    const target = targets[index];
    const slug = slugify(`${target.vendor}-${target.doc_url}`);
    const outputFile = path.join(TABLE_DIR, `${slug}.tables.json`);

    try {
      const result = await extractTables(target, index);
      const payload = {
        vendor: target.vendor,
        region: target.region,
        doc_url: target.doc_url,
        opencli_url: result.open.url,
        page_id: result.open.page,
        extracted_at: generatedAt,
        models: target.models.map((model) => ({
          id: model.id,
          name: model.name,
          base_record_id: model.base_record_id,
          seed_context_window: model.seed_context_window,
          seed_pricing: model.seed_pricing
        })),
        tables: result.tables
      };

      await fs.writeFile(outputFile, JSON.stringify(payload, null, 2));

      manifest.items.push({
        vendor: target.vendor,
        region: target.region,
        doc_url: target.doc_url,
        status: "ok",
        table_count: result.tables.length,
        output_file: path.relative(ROOT, outputFile),
        models: target.models.map((model) => model.id)
      });
    } catch (error) {
      manifest.items.push({
        vendor: target.vendor,
        region: target.region,
        doc_url: target.doc_url,
        status: "error",
        error: error.message,
        stdout: error.stdout || null,
        stderr: error.stderr || null,
        models: target.models.map((model) => model.id)
      });
    }
  }

  await fs.writeFile(MANIFEST_FILE, JSON.stringify(manifest, null, 2));
  console.log(`已生成 ${path.relative(ROOT, MANIFEST_FILE)}，表格抽取目标 ${manifest.count} 个。`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
