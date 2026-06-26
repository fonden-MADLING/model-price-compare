# 操作流程

## 第一阶段：本地手动闭环

1. 维护 `data/sources.yaml`。
2. 优先执行 `npm run opencli:read`，把官方文档的渲染后 Markdown 保存到 `data/snapshots/opencli/`。
3. 执行 `npm run opencli:tables`，把页面 DOM 表格保存到 `pending/tables/`。
4. 对表格清晰的页面优先走规则抽取；对表格缺失、动态渲染失败或字段描述复杂的页面，再进入 OpenCLI prompt / LLM 抽取。
5. 抽取结果先写入 `pending/`，不要直接覆盖正式数据。
6. 运行校验脚本，检查数字、单位、缓存价格和证据字段。
7. 人工确认后，生成 `data/models.json` 和 `data/evidence.json`。
8. 静态网页读取 JSON 展示。

## 必须保留的证据

- 字段来自哪个官方文档 URL。
- 字段对应的短摘录。
- 抽取时间。
- 抽取置信度。
- 人工复核状态。

## 校验重点

- 单位是否统一为每百万 token。
- 外币价格是否已经换算成人民币，或者是否明确保留官方币种。
- 命中缓存价格是否小于或等于未命中输入价格。
- 输出价格是否没有被误填成输入价格。
- 上下文窗口里的 K、M、+ 是否被正确转成数值和说明。

## 当前策略分流

- 标准 HTML 表格：优先走 DOM table 规则抽取，例如 DeepSeek。
- 非 table 但 Markdown 中存在“模型价格”段落：走价格段落规则，例如阿里百炼。
- Markdown 为空、需要登录或字段位置不稳定：进入 OpenCLI prompt / LLM 抽取，并标记 `needs_review`。
