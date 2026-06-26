const fs = require("fs/promises");
const path = require("path");
const http = require("http");
const https = require("https");
const { URL } = require("url");
const YAML = require("yaml");

const ROOT = path.resolve(__dirname, "..");
const SOURCES_FILE = path.join(ROOT, "data", "sources.yaml");
const SNAPSHOT_DIR = path.join(ROOT, "data", "snapshots", "docs");
const MANIFEST_FILE = path.join(ROOT, "pending", "fetch-manifest.json");

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

function requestUrl(url, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) {
      reject(new Error(`redirect too deep: ${url}`));
      return;
    }

    const target = new URL(url);
    const client = target.protocol === "http:" ? http : https;

    const req = client.request(
      target,
      {
        method: "GET",
        headers: {
          // 一些文档站会拒绝默认 Node UA；这里模拟普通浏览器，降低被误拦截的概率。
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7",
          "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8"
        },
        timeout: 30000
      },
      (res) => {
        const { statusCode = 0, headers } = res;
        const location = headers.location;

        if ([301, 302, 303, 307, 308].includes(statusCode) && location) {
          res.resume();
          const nextUrl = new URL(location, target).toString();
          requestUrl(nextUrl, redirectCount + 1).then(resolve, reject);
          return;
        }

        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const buffer = Buffer.concat(chunks);
          resolve({
            final_url: target.toString(),
            status_code: statusCode,
            content_type: headers["content-type"] || null,
            content_length: buffer.length,
            body: buffer.toString("utf8")
          });
        });
      }
    );

    req.on("timeout", () => {
      req.destroy(new Error(`request timeout: ${url}`));
    });
    req.on("error", reject);
    req.end();
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const raw = await fs.readFile(SOURCES_FILE, "utf8");
  const config = YAML.parse(raw);
  const targets = collectDocTargets(config, args);
  const fetchedAt = new Date().toISOString();

  await fs.mkdir(SNAPSHOT_DIR, { recursive: true });

  const manifest = {
    generated_at: fetchedAt,
    source_file: path.relative(ROOT, SOURCES_FILE),
    snapshot_dir: path.relative(ROOT, SNAPSHOT_DIR),
    count: targets.length,
    items: []
  };

  for (const target of targets) {
    const slug = slugify(`${target.vendor}-${target.doc_url}`);
    const htmlFile = path.join(SNAPSHOT_DIR, `${slug}.html`);
    const metaFile = path.join(SNAPSHOT_DIR, `${slug}.meta.json`);

    try {
      const response = await requestUrl(target.doc_url);
      await fs.writeFile(htmlFile, response.body);
      await fs.writeFile(
        metaFile,
        JSON.stringify(
          {
            vendor: target.vendor,
            region: target.region,
            doc_url: target.doc_url,
            final_url: response.final_url,
            fetched_at: fetchedAt,
            status_code: response.status_code,
            content_type: response.content_type,
            content_length: response.content_length,
            models: target.models.map((model) => ({
              id: model.id,
              name: model.name,
              base_record_id: model.base_record_id,
              seed_context_window: model.seed_context_window,
              seed_pricing: model.seed_pricing
            }))
          },
          null,
          2
        )
      );

      manifest.items.push({
        vendor: target.vendor,
        region: target.region,
        doc_url: target.doc_url,
        status: "ok",
        status_code: response.status_code,
        content_length: response.content_length,
        html_file: path.relative(ROOT, htmlFile),
        meta_file: path.relative(ROOT, metaFile),
        models: target.models.map((model) => model.id)
      });
    } catch (error) {
      manifest.items.push({
        vendor: target.vendor,
        region: target.region,
        doc_url: target.doc_url,
        status: "error",
        error: error.message,
        models: target.models.map((model) => model.id)
      });
    }
  }

  await fs.writeFile(MANIFEST_FILE, JSON.stringify(manifest, null, 2));
  console.log(`已生成 ${path.relative(ROOT, MANIFEST_FILE)}，抓取目标 ${manifest.count} 个。`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
