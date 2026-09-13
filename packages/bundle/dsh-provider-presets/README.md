# @yeisme/dsh-provider-presets

DSH 渠道市场 bundle：Models 设置页 footer 的 cc-switch 式 provider 快速接入。

- **预设渠道目录**：智谱 GLM（anthropic/openai 双协议）、Moonshot Kimi、SiliconFlow、OpenRouter、DashScope Qwen、ModelScope、火山方舟、DeepSeek 官方（openai 兼容）+ 自定义空白卡。
- **引导式添加**：选预设 → 粘贴 API key →「拉取模型」（OpenAI 兼容 `GET /models`，兼作连通性与延迟反馈）→ 勾选采用 → 保存。密钥经 `remote.credentials.set` 入 host 凭证存储（`.credentials.yaml` refs），浏览器不留存明文；渠道 profile 以一条 `set` path op 写入 `llm-pi-ai.providers.<route>`。
- **快切默认**：渠道总览「设为默认」整段写 `agent-default-model`（live 生效）。
- **无 host 半**：全部读写经上游 remote namespaces，根 face 是空 apply，web 行只承载 client 注册。

## 兼容性

`settings.models.footer` 扩展 slot 与 `remote.settings`/`remote.credentials`/`remote.llm` 子命名空间自 **DSH 0.1.2-rc.1** 起提供。更早版本（含 0.1.0-rc.6）INCOMPATIBLE with this bundle's surface：行可加载，渠道市场零注册、无死按钮，Models 页保持原生形态（capability probe 降级）。

## 安装

```sh
dsh plugin --profile web add @yeisme/dsh-provider-presets
# 或从本仓：
dsh plugin --profile web add ./packages/bundle/dsh-provider-presets
```

## 验证

```sh
pnpm --dir packages/bundle/dsh-provider-presets run test
pnpm --dir packages/bundle/dsh-provider-presets run build
pnpm run check:bundles
pnpm --dir packages/bundle/dsh-provider-presets run test:integration
```

规格与设计：`openspec/changes/dsh-provider-presets-v1/`。
