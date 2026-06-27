const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const { spawn } = require("child_process");
const YAML = require("yaml");

const ROOT = path.resolve(__dirname, "..");
const SOURCES_FILE = path.join(ROOT, "data", "sources.yaml");
const SNAPSHOT_DIR = path.join(ROOT, "data", "snapshots", "opencli");

const CODEX_NODE_BIN = "/Users/xufaming/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin";
const CODEX_PNPM = "/Users/xufaming/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/pnpm";

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function getExistingSlugs() {
  const files = fs.readdirSync(SNAPSHOT_DIR);
  const slugs = new Set();
  for (const f of files) {
    if (f.endsWith(".md")) {
      slugs.add(f.replace(/\.md$/, ""));
    }
  }
  return slugs;
}

async function runOpencliWebRead(url) {
  return new Promise((resolve, reject) => {
    const child = spawn(CODEX_PNPM, [
      "dlx", "@jackwener/opencli",
      "web", "read",
      "--url", url,
      "--stdout", "true",
      "-f", "md",
      "--wait", "5"
    ], {
      cwd: ROOT,
      env: {
        ...process.env,
        PATH: `${CODEX_NODE_BIN}:${process.env.PATH || ""}`
      }
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) return resolve({ stdout, stderr });
      const error = new Error(`opencli web read exited with code ${code}`);
      error.stdout = stdout;
      error.stderr = stderr;
      reject(error);
    });
  });
}

async function main() {
  const raw = await fsp.readFile(SOURCES_FILE, "utf8");
  const config = YAML.parse(raw);
  const existingSlugs = getExistingSlugs();

  await fsp.mkdir(SNAPSHOT_DIR, { recursive: true });

  const results = { success: [], failed: [] };

  for (let i = 0; i < config.sources.length; i += 1) {
    const target = config.sources[i];
    const slug = slugify(`${target.vendor}-${target.doc_url}`);

    if (existingSlugs.has(slug)) {
      console.log(`[SKIP] ${target.vendor} - ${target.doc_url} (已有快照)`);
      results.success.push({ vendor: target.vendor, doc_url: target.doc_url, status: "skipped" });
      continue;
    }

    console.log(`[${i + 1}/${config.sources.length}] 抓取: ${target.vendor} - ${target.doc_url}`);
    try {
      const result = await runOpencliWebRead(target.doc_url);
      const content = result.stdout;
      const markdownFile = path.join(SNAPSHOT_DIR, `${slug}.md`);
      await fsp.writeFile(markdownFile, content);
      console.log(`  OK  -> ${path.relative(ROOT, markdownFile)} (${content.length} 字符)`);
      results.success.push({ vendor: target.vendor, doc_url: target.doc_url, status: "ok", chars: content.length });
    } catch (error) {
      console.error(`  FAIL -> ${error.message}`);
      if (error.stderr && error.stderr.length > 0) {
        console.error(`  STDERR: ${error.stderr.slice(0, 300)}`);
      }
      results.failed.push({ vendor: target.vendor, doc_url: target.doc_url, error: error.message });
    }
  }

  console.log("\n\n========== 抓取结果汇总 ==========");
  for (const s of results.success) {
    console.log(`  OK: [${s.vendor}] ${s.doc_url}${s.chars ? ` (${s.chars} 字符)` : ''}`);
  }
  for (const f of results.failed) {
    console.log(`  FAIL: [${f.vendor}] ${f.doc_url} - ${f.error}`);
  }
  console.log(`\n总计: ${results.success.length} 成功, ${results.failed.length} 失败`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
