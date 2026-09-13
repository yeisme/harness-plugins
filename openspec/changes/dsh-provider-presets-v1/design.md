# Design — dsh-provider-presets-v1

## 1. 目标与非目标

cc-switch 的产品价值映射到 DSH：settings.yaml 即 live 配置（`remote.settings.mutate` 原子写、`agent-default-model` live 生效），切换/编辑基础设施上游已具备；本插件只补「快速接入」层——预设渠道目录 + 引导式添加 + 总览快切。

非目标：独立 workspace pane（composer 已有模型快切）；代理/故障转移；`llm-deepseek` 原生渠道编辑（Models 页 DeepSeekModelsEditor 所有）；DSH core 改动；密钥在浏览器侧任何形式的留存。

## 2. Seam 选择与版本策略

- **Surface**：`settings.models.footer`（list-kind、scope root）——上游 `ui-settings-models` 明确为仓外插件预留的两个 seat 之一（`slot-contract.ts`）。Models 页 `renderSlot('settings.models.footer', {})` 已分发（`ModelsSection.tsx:541`）。注册走 `ctx.slots.inject('settings.models.footer', () => ctx.slots.register({name, id, order, inject}, Component))`——slot 声明晚于插件加载时自动延迟激活，缺 slot 时永不触发（诚实降级）。
- **Remote 面**：`remote.settings`（`describe()` / `mutate(ns, ops, expectedRevision)`）、`remote.credentials`（`describe([ref])` / `set(ref, value)` / `unset(ref)`）、`remote.llm`（`discoverModels(settingsNs, req)` / `listProviders()` / `listConfigurableProviders()`）。事件刷新：`settings/document-updated`、`credentials/reference-updated`、`llm/adapters-updated`。
- **版本策略**：仓内 devDep 面 pin 在发布版 0.1.0-rc.6，而上述 remote 面 + footer slot 只在 0.1.2-rc.1（用户运行时，temp/dsh-unified-host-source）出现。因此：
  - 不新增上游依赖；wire 类型在本包 `wire.ts` 以本地结构化类型镜像（字段名与 0.1.2-rc.1 `dsh-api-remotes/client` 一致：`LlmModelDiscoveryRequest{provider?,baseURL?,api?,apiKey?}`、`LlmDiscoveredModel{id,name?,contextWindow?,maxTokens?}`、`LlmConfigurableProvider{provider,displayName,settingsNs,settingsPath,declared?}`、`CredentialInfo{configured,source?,writable}`、`SettingsPathOpView`、`SettingsNamespaceView.user/revision` 子集）。
  - 静态 `inject` 只声明官方 runtime 恒有服务 `['slots','locale','remote']`（session-tags 教训：静态 inject 是硬依赖，缺服务拖死 web boot）；三个 remote 子命名空间经运行时探针 + 动态 `ctx.inject(['remote.settings','remote.credentials','remote.llm'], …)` 晚绑定，缺失即零注册。
  - rc.6 运行时：footer slot 不存在 → 本插件零输出，无死按钮。

## 3. 数据与写路径

- **预设目录**（`presets.ts` 静态数据）：每条 `{ id, displayName{zh,en}, apiProtocol, baseURL, suggestedRoute, suggestedCredentialRef, modelsSeed?, note{zh,en} }`。v1 收录：智谱 GLM（anthropic + openai 双端点）、Moonshot Kimi（openai）、SiliconFlow、OpenRouter、302.ai、DashScope Qwen compatible-mode、ModelScope、Volcengine Ark、DeepSeek 官方 openai 兼容 + 自定义空白卡。anthropic 协议渠道带 `modelsSeed`（`discoverModels` 对非 OpenAI 兼容协议报 `DISCOVERY_UNSUPPORTED`，回退种子/手填）。
- **route key 冲突**：保存前经 `listConfigurableProviders()`（`settingsNs='llm-pi-ai'` 且 `settingsPath[0]==='providers'`）与 `remote.settings.describe()` 的 `user.providers` 键并查；冲突即拒绝并提示改名（不做覆盖编辑，v1 明确不做）。
- **保存事务序**：`credentials.set(ref, key)` 先行（ref 名即 env 名，POSIX 校验）→ `settings.mutate('llm-pi-ai', [{op:'set', path:['providers',route], value: profile}], expectedRevision)`。`settings-rejected`/`settings/conflict` 如实展示（conflict 提示重拉目录后重试；已写入的 credential 残留说明于错误文案）。profile 生成规则：`models[]` 仅含勾选模型（`contextWindow/maxTokens` 缺省时省略字段，由 route 级 `defaultContextWindow/defaultMaxTokens` 兜底）；`defaultInput` 仅在预设声明时写入；不写 `compat`/`modelOverrides`。
- **设为默认**：`settings.mutate('agent-default-model', [set 根对象])`（整段 `{provider, model, reasoningEffort?}`；`reasoningEffort` 仅用户显式选择时携带）。总览行「设为默认」同路径，需模型已存在（从该 route 现有 models 取第一个/用户选择）。
- **密钥边界**：输入框值只存在于对话框内存态；「已配置」状态经 `remote.credentials.describe` 的 `CredentialInfo` 呈现；不写 localStorage、不进日志。

## 4. UI Contract

- Surface classification: adopted
- Surface kind: dialog（引导添加对话框）；渠道市场区为 Models 页内 embed 内容（token/排版/焦点规则遵循 embed 档）
- First / second / third visual priority: 预设卡片网格（下一动作） → 已配置渠道总览（当前状态） → 引导弹窗内的表单/模型勾选
- Existing components reused: `@deepseek-ai/dsh-client-ui-primitives` 的 Button/Input/Modal；`@yeisme/dsh-client-ui-surface` 的 Surface/SurfaceContextBar/SurfaceState/SurfaceActionBar；`@yeisme/dsh-client-ui-visual-kit` 的 `buildPanelStyles`（scope `provider-presets`）
- Cards that earn existence: 预设渠道卡（可独立选择的任务入口）；总览用 row/list，不用卡片
- Primary scroll owner: Models 设置页自身（弹窗内为弹窗 body）

### State Matrix

| Feature | Loading | Empty | Error | Success | Partial/Stale | Disabled |
|---|---|---|---|---|---|---|
| 渠道市场区 | 目录快照读取中有界 skeleton | describe 返回空（无 provider 目录）→ 简短说明 + 仅预设卡可用 | describe/mutate 拒绝 → 紧凑 strip 展示 host 诊断（不泄 token/路径） | 保存成功 → receipt strip（渠道名 + route + 可选默认标记） | settings/conflict → 保留草稿 + 提示重拉重试 | remote 面缺失 → 整区不渲染（slot 缺失）/ 按钮禁用 + title 原因 |
| 模型拉取 | busy 态禁重复提交 | `data` 空数组 → 「端点无模型，可手填」 | 401/403 → 「检查 API key」；`DISCOVERY_UNSUPPORTED` → 种子/手填回退提示；网络错误 → host 诊断 | 模型列表 + 端点顺序 + 耗时 | 部分模型缺容量字段 → 眙选框旁标注「容量未披露，用默认」 | 未选 key 且渠道必填 → 拉取按钮禁用 |
| 设为默认 | 写入中 busy | — | 拒绝 → strip + 原因 | 默认标记移动 + composer 后续会话生效 | — | route 无可用模型 → 禁用 + 原因 |

### Responsive

| <=420px | 421–720px | >720px |
|---|---|---|
| 卡片网格单列；弹窗全宽（官方 Modal 管理）；主操作不裁切 | 网格两列 | 网格三列；总览与网格单列布局不变（Settings 页内区域，无双栏） |

### Accessibility

- Keyboard path: Tab 遍历卡片（button 语义）→ Enter 开弹窗 → 表单 Tab 序 → Enter 提交；Escape 关闭（官方 Modal 合同）
- Focus owner/return: 弹窗焦点交官方 Modal trap；关闭后回到触发卡片
- Visible labels and accessible names: 表单字段可见 label；状态 strip 带 `role="status"/"alert"`；禁用按钮带 `title` 原因
- Reduced motion and coarse pointer: `prefers-reduced-motion` 关闭过渡；coarse pointer 关键目标 ≥44px（visual-kit base 规则）

### Visual Exceptions

无。预设端点字面量触发 safe-projection 观测门 `RAW_URL_LITERAL`，按 owner 复核流程在 `REVIEWED_EXEMPTIONS` 登记豁免（静态目录数据，非投影；先例 `dsh-context/meta.ts`）。

## 5. 测试策略

- 纯函数单测：preset 数据契约（协议∈已知集、URL 非空、ref 名 POSIX、种子模型容量齐全）、profile 生成（勾选→字段省略规则）、path op 生成、冲突检测。
- 组件测试：渠道市场区渲染（空/加载/错误/冲突态）、弹窗流程（拉取成功/401/UNSUPPORTED）、键盘与 aria。
- visual-adoption.spec：token 单点声明、scope 隔离、无同义词 token、交互底线（仿 session-tags）。
- bundle.spec：check:bundles 合同（自包含 + banner id）。
- 端到端：workbench 实测（任务 5.x）。

## 6. 风险与回退

- 0.1.2-rc.1 之后上游 slot/wire 形状变化 → 本地 wire 类型失配表现为运行时拒绝，UI 如实展示 host 诊断；修复 = 对齐类型，无数据迁移。
- 预设端点过期 → 拉取失败如实提示，手填路径始终可用（上游 CustomProviderCard 不受影响）。
- 移除插件 = 卸载 bundle 行，已写入的 settings/credentials 留存于用户层（与 cc-switch 卸载语义一致）。
