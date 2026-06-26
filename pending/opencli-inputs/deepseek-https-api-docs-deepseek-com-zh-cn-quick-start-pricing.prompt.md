你是一个严格的信息抽取器。请只基于下面的官方文档文本，抽取 AI 模型价格、缓存价格和上下文窗口。

要求：
1. 只输出 JSON，不要输出 Markdown 或解释。
2. 价格统一归一到人民币 CNY / 每百万 token；如果官方文档不是人民币，保留原币种并在 notes 说明，不要擅自换算。
3. 没有找到的字段填 null，不要猜。
4. 每个非空字段必须给 evidence，quote 只保留短摘录。
5. 如果文档文本明显不是目标内容、需要登录、或动态页面未渲染，请把 review.status 设为 needs_review。

目标厂商：DeepSeek
地区：国内
官方文档：https://api-docs.deepseek.com/zh-cn/quick_start/pricing

目标模型：
- deepseek-v4-flash (deepseek-v4-flash)，Base 种子价格：未命中输入 1，命中缓存输入 0.02，输出 2，上下文 1M
- deepseek-v4-pro (deepseek-v4-pro)，Base 种子价格：未命中输入 3，命中缓存输入 0.025，输出 6，上下文 1M

请输出如下 JSON 结构：
{
  "schema_version": "1.0.0",
  "generated_at": "<ISO 时间>",
  "models": [
    {
      "id": "<模型 id>",
      "name": "<模型名称>",
      "vendor": "DeepSeek",
      "region": "国内",
      "context_window": {
        "label": "<例如 1M>",
        "tokens": 1000000,
        "note": null
      },
      "pricing": {
        "currency": "CNY",
        "unit": "PER_1M_TOKENS",
        "input_uncached": null,
        "input_cached": null,
        "cache_write": null,
        "output": null,
        "notes": []
      },
      "source": {
        "doc_url": "https://api-docs.deepseek.com/zh-cn/quick_start/pricing",
        "fetched_at": "2026-06-25T14:50:27.114Z",
        "evidence_ids": []
      },
      "review": {
        "status": "auto_extracted",
        "confidence": 0.0,
        "reviewed_at": null,
        "reviewer": null
      }
    }
  ],
  "evidence": [
    {
      "id": "<唯一证据 id>",
      "model_id": "<模型 id>",
      "field": "pricing.input_uncached",
      "doc_url": "https://api-docs.deepseek.com/zh-cn/quick_start/pricing",
      "quote": "<官方文档短摘录>",
      "normalized_value": null,
      "unit": "CNY_PER_1M_TOKENS",
      "extracted_at": "<ISO 时间>",
      "confidence": 0.0,
      "note": null
    }
  ]
}

官方文档文本：
# 模型 & 价格 下表所列模型价格以“百万 tokens”为单位。Token 是模型用来表示自然语言文本的的最小单位，可以是一个词、一个数字或一个标点符号等。我们将根据模型输入和输出的总 token 数进行计量计费。 * * * ## 模型细节[​](#模型细节 "模型细节的直接链接") ** 模型 deepseek-v4-flash(1) deepseek-v4-pro BASE URL (OpenAI 格式) [https://api.deepseek.com](https://api.deepseek.com) BASE URL (Anthropic 格式) [https://api.deepseek.com/anthropic](https://api.deepseek.com/anthropic) 模型版本 DeepSeek-V4-Flash DeepSeek-V4-Pro 思考模式 支持非思考与思考模式（默认） 切换方式详见[思考模式](/zh-cn/guides/thinking_mode) 上下文长度 1M 输出长度 最大 384K 功能 [Json Output](/zh-cn/guides/json_mode) 支持 支持 [Tool Calls](/zh-cn/guides/tool_calls) 支持 支持 [对话前缀续写（Beta）](/zh-cn/guides/chat_prefix_completion) 支持 支持 [FIM 补全（Beta）](/zh-cn/guides/fim_completion) 仅非思考模式支持 仅非思考模式支持 价格 百万tokens输入（缓存命中） 0.02元 0.025元 百万tokens输入（缓存未命中） 1元 3元 百万tokens输出 2元 6元 并发限制(2) 2500 500 ** (1) deepseek-chat 与 deepseek-reasoner 两个模型名将于北京时间 2026/07/24 23:59 弃用。出于兼容考虑，二者分别对应 deepseek-v4-flash 的非思考与思考模式。 (2) 更多并发限制细节，请参考[限速与隔离](/zh-cn/quick_start/rate_limit) * * * ## 扣费规则[​](#扣费规则 "扣费规则的直接链接") 扣减费用 = token 消耗量 × 模型单价，对应的费用将直接从充值余额或赠送余额中进行扣减。 当充值余额与赠送余额同时存在时，优先扣减赠送余额。 产品价格可能发生变动，DeepSeek 保留修改价格的权利。请您依据实际用量按需充值，定期查看此页面以获知最新价格信息。 - [模型细节](#模型细节) - [扣费规则](#扣费规则)
