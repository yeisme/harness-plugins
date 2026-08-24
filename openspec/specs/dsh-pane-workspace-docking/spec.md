# dsh-pane-workspace-docking Specification

## Purpose
插件侧双区域 workspace 协议：探测 `shell.workspace.right` / `shell.workspace.bottom` 与 `ctx.workspaceLayout`，不实现 host 几何，不把官方 DSH 合入当完成门。
## Requirements
### Requirement: 插件 SHALL 把双区域 workspace 当作探测协议，不实现 host 几何

插件 SHALL 探测 root-scoped single slots `shell.workspace.right` 与 `shell.workspace.bottom`，以及 `ctx.workspaceLayout.attach/update/getSnapshot/subscribe/dispose`。协议齐全时，插件 SHALL 把 Right/Bottom occupant 注册进这两个 slot，MUST NOT 注册进 `shell.overlay`。协议缺失时，插件 MUST 失败可见，MUST NOT 实现 AppFrame 四列两行、Details 优先级、separator 或 Fullscreen。官方 DSH 是否已实现这些 slot MUST NOT 作为插件完成门。

#### Scenario: 协议面存在时只占 workspace slot
- **WHEN** 运行时暴露两个 workspace slot 且 attach 成功
- **THEN** Right occupant SHALL 只进入 `shell.workspace.right`，Bottom occupant SHALL 只进入 `shell.workspace.bottom`
- **AND** 任一 occupant MUST NOT 进入 `shell.overlay`

#### Scenario: 协议面缺失时诚实失败
- **WHEN** slot 或 `workspaceLayout` 不存在
- **THEN** 插件 SHALL 以兼容错误失败
- **AND** MUST NOT 自行预留 44px rail 或改写 sidebar/conversation

### Requirement: 插件 SHALL 遵守单 owner attach，不分享或替换已有 owner

插件 SHALL 只 attach 一次。第二次 live attach（含同一 owner id）MUST 在加载期失败，不得分享或替换当前 owner。dispose 后 MUST 不再通过旧 handle 重建占用。

#### Scenario: Duplicate owner attaches
- **WHEN** 已有 workspace owner，插件再次 attach
- **THEN** `attach()` SHALL 在改变 snapshot 前抛 ownership/compatibility 错误
- **AND** 原 handle SHALL 仍可用

#### Scenario: HMR disposes the owner
- **WHEN** plugin unload 或 HMR dispose 当前 handle
- **THEN** 订阅者 SHALL 观察到一次 detached snapshot
- **AND** 已 dispose 的 handle 后续调用 MUST NOT 重建占用

### Requirement: 插件 MUST 把几何与优先级留给 host 协议

Right 默认 480px、360–840px、不超过 sidebar 右侧 60%；Bottom 默认 34% 高、180px–65%；conversation 目标最小 420×320px；关闭时 44px rail；不够停靠时 sheet 左边界不得小于已解析 sidebar 宽。这些数字是插件期望的 host 协议，不是插件实现任务。插件 MUST NOT 在 client 里重算四列两行或 Details 竞争。

#### Scenario: 插件不实现 host solver
- **WHEN** 插件在协议齐全的运行时打开 Right
- **THEN** 插件 SHALL 只提交 preference / 读 snapshot
- **AND** MUST NOT 改写 sidebar 宽度或 Details occupant

#### Scenario: 窄屏由 host 投影
- **WHEN** host snapshot 给出 sheet 或 rail
- **THEN** 插件 SHALL 按 snapshot 渲染对应 region
- **AND** MUST NOT 用 DOM offset 模拟 sheet

### Requirement: Workspace layout SHALL expose an optional Core Pane host bridge

`ctx.workspaceLayout.attach()` SHALL accept an optional Core Pane host adapter without changing existing two-argument callers. The adapter SHALL support the DSH-defined `dsh.tool-details` open/close lifecycle. Snapshot SHALL expose whether the Core Pane host is attached, and disposed handles MUST immediately stop receiving callbacks.

#### Scenario: Existing owner attaches without a Core adapter

- **WHEN** an existing consumer calls `attach(ownerId, preference)`
- **THEN** the workspace service SHALL preserve the current layout contract
- **AND** Tool Details SHALL continue through the legacy Details fallback

#### Scenario: Pane Workbench attaches a Core adapter

- **WHEN** Pane Workbench calls `attach(ownerId, preference, corePaneHost)`
- **THEN** the snapshot SHALL report the Core host as attached
- **AND** `openCorePane('dsh.tool-details')` / `closeCorePane('dsh.tool-details')` SHALL route to that live adapter

### Requirement: Workspace slots SHALL provide owner-authored Core view renderers

Right and Bottom workspace owner props SHALL expose a local `renderCoreView(id)` callback. AppFrame SHALL resolve `dsh.tool-details` to the existing `details` slot occupant and unknown ids to no content. The callback MUST NOT accept remote module、URL or component descriptors.

#### Scenario: Core Tool Details is active in Right

- **WHEN** the Right Pane host requests `renderCoreView('dsh.tool-details')`
- **THEN** AppFrame SHALL return the canonical DSH Details occupant
- **AND** AppFrame SHALL NOT mount that occupant in the legacy Details column at the same time

#### Scenario: Legacy fallback is active

- **WHEN** no Core Pane host is attached
- **THEN** AppFrame SHALL mount the existing `details` slot in the legacy column
- **AND** workspace owner props SHALL NOT cause a second Details mount

