## Why

/status 已进入 inspect 路径但缺少对应 resolver；Tokens 把加载、无数据和失败压成“此版本不可用”。现有 Token 账本是进程观察统计，currentSession 使用最近有活动的会话，不能支持多 Pane 下明确的 session 查询及完整历史消费。

## What Changes

- 补齐 /status 与 /status tokens，使用发起命令的 session 引用，复用现有 command lifecycle 和状态表面降级链。
- 在现有 Host 统计服务上增加按会话、运行及时间范围的只读聚合，返回完整性、来源、修订与有界请求明细。
- 统一状态胶囊、Tokens 小插件、Popover 和统计 Pane 的绑定、订阅、晚到服务、错误与恢复语义。
- 将完整消费、上下文占用、费用估算、账户余额和 Provider 配额分别展示；从请求明细定位同一 session 的轨迹。
- 保留旧接口、view kind、DOM 标识和进程账本语义。新增方法和可选能力探测，不删除旧消费者。

## Capabilities

### New Capabilities

- dsh-session-inspect-entrypoints：按发起会话解析 status 命令、状态与用量导航及完成反馈。
- dsh-session-insights-query：完整会话统计的查询、聚合、完整性、权限和兼容合同。
- dsh-session-micro-surfaces：会话小插件与统计 Pane 的一致视图、生命周期和轨迹定位。

### Modified Capabilities

无。现有 dsh-session-status-center、dsh-token-usage-ledger、dsh-token-usage-panel 仍有效；本 change 以新增合同补齐实现与新查询，不重新解释旧进程字段。新增规范只使用 ADDED Requirements。

## Impact

- Host：packages/host/dsh-token-usage、packages/host/dsh-session-status。
- Client：packages/client/command-experience-core、ui-command-experience-web、ui-session-status、ui-token-usage；必要时由 ui-pane-workbench 兼容适配传递安全引用。
- Bundle：沿用相应既有 bundle，不新建统计产品或服务进程。
- 官方会话历史、请求身份、上下文与凭据解析属于 DSH owner；缺失 seam 通过 upstream-prs 提出增量合同，插件继续探测。
- 协议门已完成；官方历史覆盖、权威 request identity 与轨迹定位 seam 仍未验证，不宣称完整会话功能已在真实 DSH 上验证。不改 profile、凭据和会话业务数据。
