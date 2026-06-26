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
  if (!result.ok) { console.error(result.errors.join("\n")); process.exit(1); }
  await writeJson("data/models.json", models);
  await writeJson("data/evidence.json", evidence);
  console.log(`Built data/models.json and data/evidence.json from pending data.`);
}

main().catch((err) => { console.error(err); process.exit(1); });
