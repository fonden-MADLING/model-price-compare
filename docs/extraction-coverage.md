# 抽取覆盖报告

## 当前已规则化（2 个页面，4 个模型）

| 厂商 | 页面 | 策略 | 状态 |
| --- | --- | --- | --- |
| DeepSeek | 价格页 | DOM 表格（`deepseek-table-rule.js`） | 已验证 |
| 阿里百炼 | 模型详情页（qwen3.7-max、qwen3.6-plus） | Markdown 价格段落（`aliyun-markdown-rule.js`） | 待人工复核 |

## 待扩展（来自 data/sources.yaml）

| 厂商 | 预期策略 | 备注 |
| --- | --- | --- |
| 字节/火山引擎 | 待运行 OpenCLI 后判断 | 可能是文档表格 |
| 智谱 | 待运行 OpenCLI 后判断 | 可能是价格页表格 |
| MiniMax | 待运行 OpenCLI 后判断 | 可能是文档段落 |
| 月之暗面 | 待运行 OpenCLI 后判断 | 每个模型独立页面 |
| OpenAI | 待运行 OpenCLI 后判断 | 需要 USD 字段，不自动换算人民币 |
| Anthropic | 待运行 OpenCLI 后判断 | 需要 USD 字段，不自动换算人民币 |
| xAI | 待运行 OpenCLI 后判断 | 需要 USD 字段，不自动换算人民币 |

## 扩展原则

- 优先规则抽取，页面结构不稳定时才用 LLM 并标记 `needs_review`。
- 外币不得自动换算人民币，除非新增 `exchange_rate` 和 `exchange_rate_date` 字段。
- 所有非空价格字段必须有证据记录（`source.evidence_ids` 不能为空）。
