## ADDED Requirements

### Requirement: Pane SDK SHALL 定义四面插件合同
`PanePluginDefinitionV1` SHALL 声明 Host、Client、Composition、Observation face、稳定 plugin id/version、API version、owner、required/optional capability、permission、view/command/artifact contribution 与 DSH compatibility。所有远程数据 MUST 只选择本地已注册 view factory，不得指定 module URL、脚本、任意 iframe 或 fetch function。

#### Scenario: 注册合法生态 Pane
- **WHEN** 一个本地 bundle 注册包含四个 face 和已满足 required capability 的 plugin definition
- **THEN** Registry SHALL 返回可撤销 disposer 并公开安全 contribution snapshot
- **AND** wire payload SHALL 不能改变该插件绑定的本地 component factory

### Requirement: Registry SHALL effect-scoped 且 generation-safe
Registry SHALL 以 plugin id 与 runtime generation 管理 registration。同 generation 重复 plugin id MUST 拒绝；dispose、unload、HMR 或 generation reset SHALL 删除旧 contribution、listener 与引用。旧 generation 的 late event MUST NOT 更新新 generation。

#### Scenario: HMR 后旧订阅迟到
- **WHEN** generation 1 已 dispose，generation 2 注册同一 plugin id，随后 generation 1 event 到达
- **THEN** Registry SHALL 忽略旧 event
- **AND** generation 2 snapshot SHALL 只含一次有效 contribution

### Requirement: Capability 与兼容性 SHALL fail closed
缺少 required capability、API major 不兼容或 permission 不满足时，Registry SHALL 返回 typed `contract_mismatch` 或 `permission_denied`，MUST NOT 注册部分可执行 contribution。optional capability 缺失 MAY 降级，但 SHALL 保留 disabled reason。

#### Scenario: Browser capability 缺失
- **WHEN** Browser Pane definition 要求 `browser.session.v1` 而 profile 只提供 web search
- **THEN** Registry SHALL 拒绝 Browser view contribution并报告缺失 capability
- **AND** SHALL NOT 将 web search 当作可操作 BrowserSession

### Requirement: 新公共合同 SHALL 标记 experimental
Pane SDK 首个公开版本 SHALL 使用 `0.1.0-rc.1` 与 experimental/alpha API 标记。后续 additive optional field MAY 以兼容 minor/RC 演进；删除、重命名、字段必填化或语义复用 MUST 先进入独立 OpenSpec migration。

#### Scenario: 后续需要新增可选 badge provider
- **WHEN** SDK 需要为 view descriptor 增加 optional badge provider
- **THEN** 新字段 SHALL 以安全默认值添加且旧插件继续注册
- **AND** 不得借 pre-1.0 身份移除现有字段

