# workbench-scenario-handoff Specification

## Purpose
TBD - created by archiving change dsh-web-pane-experience-completion-v1. Update Purpose after archive.
## Requirements
### Requirement: Open in Workbench 深链必须经过消费门校验
消费 WorkbenchHandoffV1 深链时，client MUST 校验 expiry、nonce 与 intent 白名单（open_show/open_episode/open_review/open_artifact/open_evidence）；过期、nonce 重放或未知 intent MUST 被拒绝并记录脱敏证据事件，MUST NOT 自动重试或降级为模糊打开。

#### Scenario: 有效 handoff
- **WHEN** 用户在 drama pane 触发 Open in Workbench 且 handoff 未过期、nonce 未使用
- **THEN** Workbench 侧按 intent 打开对应入口，消费后 nonce 失效

#### Scenario: 过期 handoff
- **WHEN** handoff 超过 expiry
- **THEN** 打开被拒绝，用户看到"链接已过期，请重新发起"类提示，证据事件记录 `handoff_expired` 类别

### Requirement: Handoff 目标端必须重新向 owner 拉取数据
Workbench 消费端 MUST 只从 handoff 取 opaque refs、owner versions 与 presentation intent，MUST 重新经 owner projection/transport 解析数据；MUST NOT 渲染 handoff 负载中携带的任何内容字段。

#### Scenario: handoff 负载携带内容字段
- **WHEN** 收到的 handoff 对象含有 refs 以外的正文/标题/URL 字段
- **THEN** 校验拒绝该 handoff，目标端不渲染其内容，并记录 `handoff_rejected` 类别

### Requirement: 跨模块 artifact handoff 必须遵循本仓 pane-artifact-handoff 合同
在官方 ArtifactRef/Intent seam 缺失时，跨模块 handoff（菜单与拖拽意图）MUST 按本仓 `pane-artifact-handoff` 主 spec 执行：ArtifactRefV1 版本校验、ArtifactIntentV1 有限词汇、目标 owner 重新 admission；来源插件 MUST NOT 直调目标 provider。

#### Scenario: 拖拽 artifact 到目标模块
- **WHEN** 用户把 Review 产物拖到 Run 模块且 intent 为 `attach_context`
- **THEN** 目标模块收到经校验的 ArtifactRefV1 与 intent，目标端重新 admission 后决定是否接受

#### Scenario: 未知 intent
- **WHEN** 拖拽携带不在有限词汇表内的 intent
- **THEN** drop 被拒绝、无 state 变化，并给出可见原因

### Requirement: 官方 Artifact seam 出现时必须 probe-gated 无缝升级
实现 MUST 在每次会话 probe 官方 `ArtifactRefV1`/`ArtifactIntentV1` seam；probe 命中时 handoff 通道 MUST 切换为官方 seam 优先，插件侧合同与 UI 保持不变；probe 缺失时回退本仓合同路径且不产生死按钮。

#### Scenario: seam 可用
- **WHEN** 官方 Artifact seam 存在且版本匹配
- **THEN** handoff 意图经官方通道分发，证据事件记录通道类别为 `official`

#### Scenario: seam 缺失
- **WHEN** 官方 Artifact seam 不存在
- **THEN** handoff 走本仓合同路径，菜单与拖拽入口照常可用

### Requirement: 场景 preset 与 Workbench 模块映射必须版本化
Drama/Code/Review/Media 场景 preset 到 workbench 模块集合的映射 MUST 是版本化、可校验的声明式数据；映射缺项时对应模块入口禁用并给原因，MUST NOT 静默跳过或运行时拼接未声明模块。

#### Scenario: 应用 Drama 场景
- **WHEN** 用户从 Workbench 切换到 Drama 场景 preset
- **THEN** 映射表声明的模块集被启用，未声明模块不加载，布局经原子提交应用

#### Scenario: 映射引用未安装模块
- **WHEN** 映射表引用了未安装的模块
- **THEN** 该模块入口显示禁用与安装指引，其余模块正常启用

### Requirement: Handoff 失败路径必须 fail-closed
所有 handoff/深链失败（过期、unknown、partial、admission denied）MUST 禁用 mutation、展示标准 reason 并记录证据事件；MUST NOT 自动重试、轮询或替换 writer。

#### Scenario: 目标 admission denied
- **WHEN** 目标 owner 对 handoff 动作返回 admission denied
- **THEN** 动作按钮禁用并展示 owner 提供的原因，插件不发起第二次尝试

### Requirement: 消费门必须覆盖 digest 完整性与 nonce 重放
消费门校验 MUST 依次覆盖：合同校验、expiry、digest 完整性、nonce 安全性与 nonce 重放；digest 不匹配 MUST 视为篡改并拒绝；nonce MUST 在会话内有界去重（上限 + expiry sweep），重启后 MUST NOT 重放已消费 nonce。

#### Scenario: digest 不匹配
- **WHEN** handoff 任一字段被改动导致 digest 不一致
- **THEN** 消费门拒绝并记录 `handoff_rejected` 类别（digest 原因），不打开任何目标

#### Scenario: nonce 重放
- **WHEN** 同一 nonce 的 handoff 被第二次提交
- **THEN** 消费门拒绝并提示已消费，目标端不产生第二次打开

### Requirement: Handoff 目标缺失必须 fail-closed 并给出指引
当 handoff 指向的 Workbench/模块/pane 未安装或未启用时，消费端 MUST 拒绝打开、展示标准 reason 与安装指引锚点，并记录证据事件；MUST NOT 打开近似替代页面。

#### Scenario: 目标模块未安装
- **WHEN** handoff intent 为 open_show 但 Workbench Show Control Room 不可用
- **THEN** 用户看到"目标未安装/未启用"提示与安装指引，无部分打开状态

### Requirement: Artifact intent 必须携带 idempotency key 并支持目标端去重
每次用户手势产生的 `ArtifactIntentV1` MUST 携带稳定 idempotency key；同一手势的重复投递（拖拽重复 drop、双击、重试）MUST 被目标端去重为一次 admission。

#### Scenario: 重复 drop 同一 artifact
- **WHEN** 用户因网络抖动对同一 artifact 重复触发相同 intent
- **THEN** 目标端凭 idempotency key 只执行一次 admission，不产生重复动作或重复证据

