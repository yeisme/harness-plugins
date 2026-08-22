## ADDED Requirements

### Requirement: File Pane SHALL 只在 FileWatchCapabilityV1 下宣称实时
File Pane SHALL 探测 `FileWatchCapabilityV1`。缺失时 SHALL 使用按需 `listEntries`，freshness SHALL 为 `unknown`、`stale`、`offline` 或 `contract_mismatch`，MUST NOT 显示 live、MUST NOT 用 `setInterval` 或 TTL refetch 假装文件变化。

#### Scenario: 无 fs-watch seam
- **WHEN** File host 未声明 `FileWatchCapabilityV1`
- **THEN** Pane SHALL 保持按需列表
- **AND** SHALL NOT 渲染 live/watching 状态

### Requirement: File 变化 SHALL 仅消费 owner event
当 capability 存在时，Host SHALL 下发带 cursor 的 created/changed/deleted/renamed 事件。payload SHALL 只含 opaque entry ref。绝对路径、`file://`、凭据 MUST 被拒绝。gap 或过期 cursor SHALL 进入 `reconcile_required`。

#### Scenario: 文件变更事件
- **WHEN** owner 发出 changed 事件且 cursor 连续
- **THEN** Pane SHALL 折叠到对应 opaque ref
- **AND** SHALL NOT 向浏览器暴露 host path

### Requirement: 用户 refresh SHALL 为显式 reconcile
缺 stream 或 gap 之后，唯一允许的刷新 SHALL 是用户显式 refresh 或 owner snapshot 重读。客户端 MUST NOT 后台轮询。

#### Scenario: 用户点击刷新
- **WHEN** freshness 为 stale 或 contract_mismatch
- **THEN** 用户 MAY 触发 reconcile
- **AND** 客户端 SHALL NOT 自行定时重拉目录
