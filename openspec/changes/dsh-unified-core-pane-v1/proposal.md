## Why

DSH 目前把 Tool Details 放在 AppFrame 的独立 `details` 列，而文件、终端、媒体、Agent 等工作视图放在 Pane Workbench 的 Right/Bottom region，形成两套侧栏 owner、两套打开/关闭语义和两套空间竞争规则。现在需要把 Tool Details 也迁入唯一的 Pane Workbench Core，使所有后续侧栏能力都只通过同一 registry、controller、chrome 与 persistence 扩展。

## What Changes

- 将 `@yeisme/dsh-client-ui-pane-workbench` 明确提升为唯一标准 Core Pane，内置注册 `dsh.tool-details`，并继续作为所有生态 Pane 的唯一 `registerView()` / `openView()` 入口。
- 为 `ctx.workspaceLayout` 增加可选 Core Pane host bridge：Pane Workbench attach 时提供 open/close adapter；DSH `layout.openDetails()` / `closeDetails()` 优先路由到该 adapter。
- AppFrame 在 Core Pane host 已 attach 时，不再把 Tool Details 渲染为独立第四列，而是通过 Right/Bottom slot owner 的本地 render callback 把既有 `details` occupant 交给 `dsh.tool-details` Pane view。
- 保留旧 `details` 列和 `ctx.layout.openDetails()` / `closeDetails()` 一整个 RC 作为兼容回退；未安装或未 attach Pane Workbench 时，现有 DSH 行为保持不变并发出弃用说明。
- Core view 与生态 view 走相同的 Tab、split、move、maximize、a11y、error boundary 和 teardown；Core Tool Details 不出现在通用 View Picker，只能由 DSH owner 的显式 inspect/open action打开。
- 更新 DSH 上游 patch staging、插件 README、contract tests 与 OpenSpec，禁止未来 provider 再占用 `details`、`shell.overlay` 或创建第二 sidebar/workbench store。

## Capabilities

### New Capabilities

- `dsh-unified-core-pane`: DSH 内置辅助视图通过唯一 Pane Workbench Core 注册、打开、渲染、关闭与兼容回退的合同。

### Modified Capabilities

- `dsh-pane-workspace-docking`: workspace host 协议新增可选 Core Pane adapter 与 owner-authored local render bridge，legacy Details 仅作为未 attach 时的回退。
- `dsh-pane-workbench-extension`: Pane Workbench 内置 Core view provider，并成为 `details` 与生态 Pane 的唯一正常生产宿主。
- `pane-workbench-interaction`: Core view 与生态 view 共用同一 canonical layout、registry 和 chrome，同时支持隐藏 picker 与 owner-triggered singleton open。

## Impact

- Harness Plugins：`packages/client/ui-pane-workbench/`、`packages/bundle/pane-workbench/`、相关 tests 与 docs。
- DSH upstream staging：`upstream-prs/pane-workspace-layout/` 中 `ui-layout`、`ui-conversation` 的 additive bridge、AppFrame fallback 与 tests。
- 公开 TypeScript 合同：`ctx.paneWorkbench` 保持兼容并新增 Core view hosting；`ctx.workspaceLayout.attach()` 增加可选第三参数，现有两参数调用不变。
- 迁移窗口：当前 RC 同时支持 Core Pane 主路径与 legacy Details 回退；下一 RC 只在证据证明无存量 consumer 后，另开 change 删除独立 Details geometry。
- 回滚：恢复上一版 Pane bundle 与 `pane-workspace-layout` patch；旧 `details` 列在迁移窗口内始终可继续工作，不需要迁移用户领域数据。
