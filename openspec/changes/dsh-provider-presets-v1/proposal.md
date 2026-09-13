## Why

用户希望参考 cc-switch 在 DSH 内快速接入 API provider：上游 Web 已有 Models 设置页（`ui-settings-models`，手填自定义 provider + `GET /models` 拉取 + composer 模型切换），但添加一个渠道仍需手填 baseURL、协议、credential ref 名与模型目录——没有任何预设渠道目录。本 change 补齐 cc-switch 式的增量：在 Models 设置页预留的 `settings.models.footer` 扩展 slot 内提供「渠道市场」——预设渠道卡片 + 引导式添加（选渠道 → 粘贴 key → 自动拉取模型 → 保存，可选设为默认），并附已配置渠道总览与快切默认。

全部读写经上游已暴露的 client Remote namespaces（`remote.settings.mutate` / `remote.credentials.set` / `remote.llm.discoverModels`），不改 DSH core、不新建 host 服务。

## What Changes

- 新增 `packages/client/ui-provider-presets`（React client 面）：预设渠道数据、remote 操作封装、目录快照 store、`settings.models.footer` slot 注册（渠道市场区）与引导添加对话框；zh/en 双字典；dispose 对称。
- 新增 `packages/bundle/dsh-provider-presets`（可安装 web 行）：空 host apply 模式 + client 转发 + `dsh.compatibility.json`。
- 写入语义：新渠道 = `llm-pi-ai.providers.<route>` 一条 `set` path op（经 `assertServiceable` 校验，`settings-rejected` 如实展示）+ `credentials.set(ref, key)`（明文只进 host `.credentials.yaml` refs）；可选 `agent-default-model` 整段 replace 设为默认。
- 模型拉取复用上游 `remote.llm.discoverModels`（OpenAI 兼容 `GET {baseURL}/models`；anthropic 协议渠道回退预设种子模型/手填，`DISCOVERY_UNSUPPORTED` 如实提示）。
- 能力探针：目标运行时（0.1.2-rc.1 统一 host）缺 `settings.models.footer` slot 或任一 remote namespace 时零注册、诚实降级；对 rc.6 官方面用本地结构化 wire 类型 + 动态 `ctx.inject` 晚绑定，不引入跨版本类型冲突。
- `check:surfaces` catalog 登记 `ui-provider-presets: adopted`；safe-projection 观测门为预设渠道官方端点字面量登记 owner 复核豁免（静态目录数据，非 host→client 投影，同类先例 `dsh-context/meta.ts`）。

## Capabilities

### New Capabilities

- `dsh-provider-presets`：预设渠道目录、引导式添加（模型拉取/凭据写入/冲突防护）、渠道总览与快切默认、能力探针降级。

### Modified Capabilities

无。上游 Models 页、composer 切换与 `llm-deepseek` 原生渠道编辑保持原义；本插件只在预留 footer 扩展区追加内容。

## Impact

拟用路径：`packages/client/ui-provider-presets`、`packages/bundle/dsh-provider-presets`；`scripts/check-ui-surface-contracts.mjs` 增 catalog 行；`packages/tool/dsh-plugin-toolchain/src/checkers/safe-projection-audit.ts` 增豁免条目。浏览器侧永不接收密钥明文（读取仅 `CredentialInfo{configured,writable,source}`）；不覆盖既有 route key；不落真实凭据进源码/fixture/日志/证据。独立 pane、代理/故障转移、渠道延迟测速为后续 change。
