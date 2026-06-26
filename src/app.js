const state = { models: [], evidence: [], sortKey: "scenario_cost", sortDir: "asc" };

const $id = (id) => document.getElementById(id);
const rowsEl = $id("modelRows");
const vendorFilter = $id("vendorFilter");
const regionFilter = $id("regionFilter");
const statusFilter = $id("statusFilter");
const inputTokens = $id("inputTokens");
const outputTokens = $id("outputTokens");
const cacheHitRate = $id("cacheHitRate");
const cacheHitLabel = $id("cacheHitLabel");
const drawer = $id("drawer");
const drawerContent = $id("drawerContent");

function money(v) {
  if (v == null) return "待抽取";
  return `${v.toFixed(v < 1 ? 3 : 2)} 元`;
}

function scenarioCost(model) {
  const input = Number(inputTokens.value || 0);
  const output = Number(outputTokens.value || 0);
  const hit = Number(cacheHitRate.value || 0) / 100;
  const { input_uncached: u, input_cached: c, output: o } = model.pricing;
  if (u == null || c == null || o == null) return null;
  return (input / 1e6) * (hit * c + (1 - hit) * u) + (output / 1e6) * o;
}

function sortValue(model, key) {
  if (key === "context") return model.context_window.tokens || 0;
  if (key === "scenario_cost") return scenarioCost(model) ?? Infinity;
  if (key in model.pricing) return model.pricing[key] ?? Infinity;
  if (key === "status") return model.review.status;
  return model[key] || "";
}

function filteredModels() {
  return state.models
    .filter((m) => !vendorFilter.value || m.vendor === vendorFilter.value)
    .filter((m) => !regionFilter.value || m.region === regionFilter.value)
    .filter((m) => !statusFilter.value || m.review.status === statusFilter.value)
    .sort((a, b) => {
      const av = sortValue(a, state.sortKey);
      const bv = sortValue(b, state.sortKey);
      const r = typeof av === "number" && typeof bv === "number"
        ? av - bv
        : String(av).localeCompare(String(bv), "zh-CN");
      return state.sortDir === "asc" ? r : -r;
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
  const model = state.models.find((m) => m.id === modelId);
  const evs = state.evidence.filter((e) => model.source.evidence_ids.includes(e.id));
  drawerContent.innerHTML = `
    <h2>${model.name}</h2>
    <p>${model.vendor} / ${model.region}</p>
    <p><a href="${model.source.doc_url}" target="_blank" rel="noreferrer">官方文档</a></p>
    <h3>价格</h3>
    <p>未命中输入：${money(model.pricing.input_uncached)}</p>
    <p>命中缓存输入：${money(model.pricing.input_cached)}</p>
    <p>输出：${money(model.pricing.output)}</p>
    <h3>证据</h3>
    ${evs.map((e) => `
      <div class="evidence">
        <strong>${e.field}</strong>
        <p>${e.quote}</p>
        <p>值：${e.normalized_value} / 置信度：${e.confidence}</p>
      </div>
    `).join("")}
  `;
  drawer.classList.add("open");
  drawer.setAttribute("aria-hidden", "false");
}

async function load() {
  const [models, evidence] = await Promise.all([
    fetch("./data/models.json").then((r) => r.json()),
    fetch("./data/evidence.json").then((r) => r.json())
  ]);
  state.models = models.models;
  state.evidence = evidence.evidence;
  $id("metaLine").textContent = `更新时间：${models.generated_at || "未知"} / 模型数：${state.models.length}`;

  for (const vendor of [...new Set(state.models.map((m) => m.vendor))].sort()) {
    const opt = document.createElement("option");
    opt.value = vendor; opt.textContent = vendor;
    vendorFilter.appendChild(opt);
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

rowsEl.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-model]");
  if (btn) openDrawer(btn.dataset.model);
});

$id("closeDrawer").addEventListener("click", () => {
  drawer.classList.remove("open");
  drawer.setAttribute("aria-hidden", "true");
});

[vendorFilter, regionFilter, statusFilter, inputTokens, outputTokens, cacheHitRate].forEach((el) => {
  el.addEventListener("input", renderRows);
});

load().catch((err) => { $id("metaLine").textContent = `加载失败：${err.message}`; });
