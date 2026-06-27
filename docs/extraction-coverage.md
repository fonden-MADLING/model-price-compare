# 抽取覆盖报告

## 当前覆盖总览

**26 个模型 / 8 个厂商 / 82 条证据**（2026-06-27 数据）

| 厂商 | 模型数 | 策略 | 状态 | 快照 |
|------|--------|------|------|------|
| DeepSeek | 2 | DOM 表格（`deepseek-table-rule.js`） | ✅ 规则抽取 | ✅ |
| 阿里 | 3 | Markdown 段落（`aliyun-markdown-rule.js`） | ⚠️ 需复核 | ✅ |
| 字节/火山引擎 | 4 | 种子数据 fallback（`seed-fallback-rule.js`） | ⚠️ 需复核 | ✅ |
| 智谱 | 3 | 种子数据 fallback | ⚠️ 需复核 | ✅ |
| MiniMax | 2 | 种子数据 fallback | ⚠️ 需复核 | ✅ |
| 月之暗面 | 2 | 种子数据 fallback | ⚠️ 需复核 | ✅ |
| xAI | 3 | 种子数据 fallback | ⚠️ 需复核 | ✅ |
| OpenAI | 4 | 种子数据 fallback | ⚠️ 需复核 | ❌ (被墙) |
| Anthropic | 3 | 种子数据 fallback | ⚠️ 需复核 | ❌ (区域限制) |

## 规则抽取优先级

| 优先级 | 厂商 | 原因 |
|--------|------|------|
| P0 | 字节/火山引擎 | 快照已有，页面结构清晰 |
| P1 | 智谱 | 快照已有，典型价格页 |
| P2 | MiniMax | 快照已有，文档段落结构 |
| P3 | 月之暗面 | 快照已有，每个模型独立页面 |
| P4 | xAI | 快照已有，需 USD 字段 |
| P5 | OpenAI/Anthropic | 需代理/梯子抓取 |

## 扩展原则

- 优先规则抽取，页面结构不稳定时才用 LLM 并标记 `needs_review`。
- 外币**不得**自动换算人民币，除非新增 `exchange_rate` 和 `exchange_rate_date` 字段。
- 所有非空价格字段必须有证据记录（`source.evidence_ids` 不能为空）。
- 种子数据标记 `confidence: 0.3`，规则抽取标记 `confidence: 0.82~0.96`。
