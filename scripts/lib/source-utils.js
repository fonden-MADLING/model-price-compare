const fs = require("fs/promises");
const path = require("path");
const { spawn } = require("child_process");
const YAML = require("yaml");

const ROOT = path.resolve(__dirname, "..", "..");

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
    const command = process.env.OPENCLI_BIN || "pnpm";
    const finalArgs = process.env.OPENCLI_BIN ? args : ["dlx", "@jackwener/opencli", ...args];
    const child = spawn(command, finalArgs, { cwd: ROOT, env: process.env });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (c) => { stdout += c.toString(); });
    child.stderr.on("data", (c) => { stderr += c.toString(); });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) { resolve({ stdout, stderr }); return; }
      const error = new Error(`opencli exited with code ${code}`);
      error.stdout = stdout;
      error.stderr = stderr;
      reject(error);
    });
  });
}

module.exports = { ROOT, slugify, readJson, writeJson, readSources, runOpencli };
