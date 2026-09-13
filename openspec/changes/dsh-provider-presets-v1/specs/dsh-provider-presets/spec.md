## ADDED Requirements

### Requirement: 预设渠道目录

系统 SHALL 在 Models 设置页 `settings.models.footer` 扩展区渲染渠道市场：预设渠道卡片（displayName、协议、baseURL、建议 credential ref，zh/en 双语）与自定义空白卡，并在顶部以 row/list 总览已配置渠道（route、displayName、live/dormant 状态、当前默认标记）。

#### Scenario: 打开 Models 设置页

- **WHEN** 运行时提供 `settings.models.footer` slot 且三个 remote namespace 可用
- **THEN** 渠道市场渲染预设卡片与已配置渠道总览，总览数据来自 `listProviders()` ⋈ `listConfigurableProviders()` 与 `agent-default-model` 当前值

#### Scenario: 预设端点已收录但协议不可自动发现

- **WHEN** 预设协议为非 OpenAI 兼容（如 anthropic-messages）
- **THEN** 引导流回退到预设种子模型与手填入口，并说明该协议无自动模型列表

### Requirement: 引导式添加渠道

系统 SHALL 提供引导式添加流：预填协议/baseURL/route key/credential ref（可改）→ 粘贴 API key → 经 `remote.llm.discoverModels('llm-pi-ai', …)` 拉取模型（结果含端点顺序与耗时；401/403 提示检查 key）→ 勾选采用模型 → 保存为 `llm-pi-ai.providers.<route>` 并经 `remote.credentials.set` 写入密钥，可选勾选「保存后设为默认」。

#### Scenario: 保存成功

- **WHEN** 用户完成表单并保存，route key 无冲突
- **THEN** 密钥先经 credentials namespace 写入 host，随后 profile 以一条 `set` path op 写入 `llm-pi-ai`，UI 展示 receipt（渠道名 + route + 默认标记），模型缺容量字段时省略该字段由 route 默认兜底

#### Scenario: route key 冲突

- **WHEN** 建议 route key 已存在于 provider 目录或 `llm-pi-ai` user 层
- **THEN** 保存被拒绝并要求改名，不覆盖既有 route

#### Scenario: 写入被拒

- **WHEN** host 返回 `settings-rejected` 或 `settings/conflict`
- **THEN** UI 如实展示 host 诊断；conflict 保留草稿并提示重拉目录后重试；不静默重试或自动覆盖

### Requirement: 快切默认

系统 SHALL 在渠道总览提供「设为默认」动作，将 `agent-default-model` 整段写为所选 provider 与该 route 现有模型之一（`reasoningEffort` 仅显式选择时携带）；route 无可用模型时动作禁用并说明原因。

#### Scenario: 设为默认成功

- **WHEN** 用户对某 live route 点击「设为默认」并选定模型
- **THEN** `agent-default-model` 写入生效，默认标记移动，新会话继承该选择

### Requirement: 密钥安全边界

系统 SHALL 保证浏览器侧永不接收密钥明文：已配置状态仅经 `remote.credentials.describe` 的 `CredentialInfo{configured, source?, writable}` 呈现；密钥值不写 localStorage、不进日志与证据。

#### Scenario: 查看已配置渠道

- **WHEN** 总览渲染某渠道的密钥状态
- **THEN** 仅展示 configured/writable 事实与来源名，无任何密钥值或可还原片段

### Requirement: 能力探针与诚实降级

系统 SHALL 在 `settings.models.footer` slot 或任一所需 remote namespace 缺失时零注册（不渲染任何入口），不出现死按钮；静态 inject 仅声明官方 runtime 恒有服务，remote 子命名空间经动态晚绑定。

#### Scenario: 运行时为 rc.6 官方面

- **WHEN** web profile 不提供 `settings.models.footer` slot 或 remote settings/credentials/llm namespace
- **THEN** 插件零输出，Models 页保持原生形态，boot 无 pending entry
