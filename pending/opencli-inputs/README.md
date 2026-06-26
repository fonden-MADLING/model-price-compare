# OpenCLI 输入文件

这里的 prompt 文件由 `npm run prepare:opencli` 生成。
当前脚本只负责生成稳定输入，不直接调用 OpenCLI，因为本机尚未发现固定的 `opencli` 命令。
确认命令后，可以把这些 prompt 文件作为 stdin 或文件参数传给 OpenCLI。

已生成文件：
- pending/opencli-inputs/deepseek-https-api-docs-deepseek-com-zh-cn-quick-start-pricing.prompt.md