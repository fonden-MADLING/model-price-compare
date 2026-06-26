const fs = require("fs/promises");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");

async function copy(src, dest) {
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.copyFile(src, dest);
}

async function main() {
  await fs.rm(DIST, { recursive: true, force: true });
  await copy(path.join(ROOT, "src", "index.html"), path.join(DIST, "index.html"));
  await copy(path.join(ROOT, "src", "styles.css"), path.join(DIST, "styles.css"));
  await copy(path.join(ROOT, "src", "app.js"), path.join(DIST, "app.js"));
  await copy(path.join(ROOT, "data", "models.json"), path.join(DIST, "data", "models.json"));
  await copy(path.join(ROOT, "data", "evidence.json"), path.join(DIST, "data", "evidence.json"));
  console.log(`Built static site at ${DIST}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
