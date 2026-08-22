## ADDED Requirements

### Requirement: V2 插件 SHALL 只消费 workspace 协议，不实现 host 布局

V2 client 插件 SHALL 在探测到 `shell.workspace.right`、`shell.workspace.bottom` 与 `ctx.workspaceLayout` 后注册两个 slot occupant 并 attach 一个 owner。它 MUST NOT 占用 `sidebar`、`conversation`、`details` 或生产 `shell.overlay`；MUST NOT 用私有 DOM selector、root margin 或全局 layout patch 模拟 docking。任一协议面缺失时，加载 MUST 以明确兼容错误失败，MUST NOT 回退 overlay。插件完成验收 MUST NOT 要求官方 DSH 已实现这些 slot。

#### Scenario: 协议面齐全时注册双宿主
- **WHEN** 运行时暴露两个 workspace slot 与 `ctx.workspaceLayout`
- **THEN** 插件 SHALL 注册 Right/Bottom occupant 并 attach 一个 layout owner
- **AND** MUST NOT 再注册 `shell.overlay`

#### Scenario: 发布版缺少 workspace 协议
- **WHEN** 运行时不暴露 workspace service 或两个声明 slot
- **THEN** 插件 SHALL 报告可操作的兼容错误
- **AND** MUST NOT 挂载整框 overlay

### Requirement: Bundle 声明 SHALL 可逆，且不把官方 CLI 当作完成门

Pane Workbench SHALL 通过 bundle patch 只挂本仓库 package 行。完成验收是 patch 行、client 面与 disposer 合同；官方 `dsh plugin add` / Web boot 是可选 host 集成，MUST NOT 阻塞插件完成。移除声明后，插件 MUST dispose 两个 slot 注册、layout handle、drag coordinator、订阅与 persistence listener。

#### Scenario: 卸载释放插件占用
- **WHEN** bundle 被移除或 client apply disposer 执行
- **THEN** 两个 workspace occupant、client service 与 provider 注册 SHALL 消失
- **AND** 插件 MUST NOT 留下第二套 layout owner

### Requirement: Two workspace hosts SHALL share one controller generation

Right and Bottom slot 组件 SHALL 通过 `useSyncExternalStore` 读同一个外部 Pane controller/store。Registry unload、session switch、openView、Tab move、split、resize 与 persistence 变化 SHALL 对两个 host 同时可见，MUST NOT 复制 view id 或注册第二 owner。

#### Scenario: Provider unloads while visible in Right
- **WHEN** 已注册 view provider 在 Right 与 Bottom host 已挂载时 dispose
- **THEN** 两个 host SHALL 观察到同一 orphaned workspace snapshot
- **AND** 只有受影响 Tab SHALL 显示 recovery UI
