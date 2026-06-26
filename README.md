# AI 模型价格对比

这个项目用于把各模型厂商官方文档中的价格、上下文窗口和缓存计费信息抽取成结构化 JSON，再通过静态网页展示。

当前阶段先跑通最小闭环：

1. 在 `data/sources.yaml` 维护模型、厂商和官方文档链接。
2. 后续用 OpenCLI 读取官方文档并抽取结构化数据。
3. 抽取结果写入 `data/models.json` 和 `data/evidence.json`。
4. 静态网页只读取本地 JSON，不直接连接数据库或调用带密钥的接口。

## 目录说明

- `data/sources.yaml`：数据源清单，来自飞书 Base 的 26 条模型记录。
- `data/models.schema.json`：网页最终消费的模型数据结构。
- `data/evidence.schema.json`：字段级证据结构。
- `data/models.json`：后续构建生成的模型数据，当前为空结构。
- `data/evidence.json`：后续构建生成的证据数据，当前为空结构。
- `docs/ui-design.md`：第一版前端 UI 设计方案。
- `scripts/`：后续放抓取、抽取、校验、构建脚本。
- `pending/`：后续放待人工审核的抽取结果，避免自动结果直接覆盖正式数据。
- `src/`：后续放静态前端页面代码。

## 本地完整流程

```bash
npm install
npm run generate:pending   # 从快照抽取价格 → pending/
npm run validate           # 校验抽取结果
npm run build:data         # 写入 data/models.json + data/evidence.json
npm run build:static       # 构建 dist/（用于 GitHub Pages）
npm run dev                # 本地预览 → http://localhost:5173
```

## 刷新官方文档快照

```bash
npm run opencli:read -- --limit 3
npm run opencli:tables -- --limit 3
```

## 脚本说明

| 命令 | 作用 |
| --- | --- |
| `generate:pending` | 规则抽取 → `pending/models.generated.json` + `pending/evidence.generated.json` |
| `validate` | 校验抽取结果（缓存价异常、负价格、证据缺失等） |
| `build:data` | 通过校验后写入 `data/` 正式数据 |
| `build:static` | 复制前端 + 数据到 `dist/`，可直接部署 |
| `dev` | Node.js 原生静态服务，端口 5173 |
| `opencli:read` | 用 OpenCLI 保存官方文档 Markdown 快照 |
| `opencli:tables` | 用 OpenCLI 保存 DOM 表格快照 |
