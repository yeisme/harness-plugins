# workbench-dsh-plugin-lane Specification

## Purpose

把 dsh（deepseek harness）插件接入收敛为三层车道准入模型（L0 深链
handoff / L1 server-authored declarative descriptor 与 slash 命令目录 /
L2 embedded iframe 门禁），让任何接入请求都有 fail-closed 的判定依据；
dsh 侧渲染与 Director Pack 归外部仓 `agent/harness-plugins`，本仓只交付
合同、准入判定与 handoff 证据要求。

## Requirements

### Requirement: dsh 插件接入 MUST 收敛为三层车道准入模型

Workbench 对 dsh（deepseek harness）插件生态的接入 MUST 收敛为三层车道：L0 深链/handoff、L1 server-authored declarative descriptor 与 slash 命令目录、L2 embedded iframe。每层 MUST 有显式的交付状态与 fail-closed 语义；任何接入请求 MUST 先归类到唯一一层车道，再按该层合同判定。Workbench MUST NOT 为 dsh 引入运行时安装/更新/卸载 API、服务端下发可执行代码或任何 fail-open 预留口。

#### Scenario: 一个接入请求无法归类到已开放车道

- **WHEN** 一个 dsh 插件接入请求不属于已交付的 L0 合同，且 L1 目录合同尚未实现、L2 前提未交付
- **THEN** Workbench MUST 回答 `needs_contract` 并保留恢复提示
- **AND** MUST NOT 以 flag、配置或"预览模式"名义开放任何执行口

### Requirement: L0 深链 handoff MUST 只消费已冻结的 HarnessDshDeepLink 合同

L0 车道 MUST 只消费 `workbench.harness.dsh_bridge.v1alpha1` 合同的 `HarnessDshDeepLink` closed 字段（`contractVersion`/`targetRef`/`sourceSurfaceId`/`resourceRef`/可选 `resourceVersion`/`mode`/可选 `embedded` 窗口约束/可选 `handoffNonce`）。合同校验失败 MUST fail closed：不渲染目标、不提供打开动作，只暴露脱敏合同诊断。`mode: "embedded"` MUST 仅表示 layout-only 受限窗口约束元数据，MUST NOT 授权任何 iframe 加载或权限提升。本期 MUST NOT 重解释或扩展该合同字段；additive 演进 MUST 升合同版本。

#### Scenario: handoff 合同字段非法

- **WHEN** Workbench 收到缺少 `targetRef` 或 `contractVersion` 不匹配的 handoff descriptor
- **THEN** UI MUST fail closed，不渲染目标、不提供打开动作
- **AND** MUST NOT 猜测字段语义或回退到任意 URL/路由

### Requirement: handoff 目标端 server MUST 重新验证授权

handoff 是导航与关联，不是授权。目标端（dsh server 或 Workbench server）收到 handoff 后 MUST 基于自身已验证 session 的 tenant/workspace/principal 重新验证授权与资源版本；`sourceSurfaceId` 与 `handoffNonce` MUST 仅用于关联、审计与防重放线索，MUST NOT 构成授权事实。验证失败 MUST 返回安全拒绝（existence-hiding deny），MUST NOT 泄露资源存在性。

#### Scenario: handoff 携带有效格式但目标端无授权

- **WHEN** 目标端 server 收到格式合法但 caller 无对应 tenant/workspace 授权的 handoff
- **THEN** server MUST 拒绝并返回安全错误，不确认资源是否存在
- **AND** MUST NOT 依据 handoff 字段授予任何能力

### Requirement: L1 slash 命令目录 MUST 是 server-authored 的版本化 closed 投影

L1 车道的 slash 命令目录 MUST 由服务端以版本化、closed schema 投影下发：每条命令携带稳定 id、dotted i18n key、icon semantic、closed 参数 schema、`requiredCapabilities` 与 availability。descriptor MUST NOT 携带 component/renderer/module/URL/iframe/HTML/JS/DOM selector/credential/token 语义字段（沿用 `FORBIDDEN_MANIFEST_FIELDS` 同原则）。availability MUST 永远来自服务端投影；未知枚举值或未知目录版本 MUST 归一为 `needs_contract`。UI MUST 只投影；目录缺失或合同不可用时 MUST 呈现诚实空态或 `needs_contract`，MUST NOT 回退到前端硬编码命令清单。本期该车道为 spec-only：composer.tsx:260-264 的硬编码是过渡实现，本 change MUST NOT 修改它；实现切换 MUST 由后续 change 一次性完成并删除硬编码。

#### Scenario: 命令目录投影缺失

- **WHEN** 服务端未提供命令目录投影或投影版本未知
- **THEN** composer MUST 呈现诚实空态或 `needs_contract`，并保留恢复提示
- **AND** MUST NOT 用前端内置清单伪造可用命令

#### Scenario: 目录条目携带禁用字段

- **WHEN** 某条命令 descriptor 携带 URL/component/script 语义字段
- **THEN** 校验 MUST 以 `forbidden_field` 拒绝该条目
- **AND** MUST NOT 转义、降级或渲染该条目

### Requirement: L2 embedded iframe 车道本期 MUST 保持 reject-now

L2 车道本期 MUST 一律 `needs_contract`。解锁 MUST 要求 `docs/design/plugin-ecosystem.md` §7.2 六前提全部交付并逐项留证：（1）控制面签名发布；（2）content-addressed artifact 存储与加载前真实字节 digest 校验；（3）`releaseDigest`/`artifactDigest` 进入构建期静态 allowlist；（4）sandbox/CSP/bridge/egress 维持 default-deny 且 action/navigation 不跨 bridge；（5）capability cohort kill switch；（6）供应链审计与分层证据。任一前提缺失 MUST 保持关闭；Workbench MUST NOT 为 L2 预留任何执行口、flag 或动态 module URL。

#### Scenario: 六前提未齐备时的 iframe 接入请求

- **WHEN** 任何请求要求在 Workbench 内嵌 dsh iframe，而六前提任一未交付
- **THEN** Workbench MUST 回答 `needs_contract` 并引用缺失前提
- **AND** MUST NOT 以临时方案、内部试用或受信来源名义放行

### Requirement: 跨仓 handoff MUST 携带分层证据，dsh 侧渲染归外部仓

dsh 侧渲染与 Director Pack 的 canonical owner 是外部仓 `agent/harness-plugins`；Workbench MUST NOT 复制其状态机、领域规则或渲染。跨仓 handoff MUST 提供 contract digest/version、schema fixtures、failure/tenant 隔离证据与 release compatibility。Workbench MUST 只在 provider ready 与 consumer adoption evidence 同时存在时把相关 capability 显示为 `available`；合同 digest 不匹配 MUST 归一为 `needs_contract`/`contract_mismatch`，MUST NOT 做版本猜测。日志、遥测与证据 MUST 只保留 safe refs、digest、状态与脱敏诊断。

#### Scenario: 外部仓合同 digest 与 Workbench 锁定值漂移

- **WHEN** `agent/harness-plugins` 发布的合同 digest 与 Workbench 消费侧锁定值不一致
- **THEN** Workbench MUST 将相关 capability 归一为 `needs_contract`/`contract_mismatch`
- **AND** MUST NOT 按版本号猜测兼容性或继续展示旧投影为新事实
