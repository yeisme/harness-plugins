## Why

Workbench Core 需要证明多个模块可以在同一 shell 中组合。`@yeisme/dsh-rich-media` 与 `@yeisme/dsh-file-document` 已经独立注册；组合包把它们放进同一个 `WorkbenchRegistry`，并通过官方 `sidebar.footer.action` 提供一个统一工作台入口。

准入结论为 `fit`：组合层只做装配与展示，不拥有任何领域 canonical state。

## What Changes

- 新增 `@yeisme/dsh-workbench-compose` package。
- `createComposedWorkbenchRegistry()` 同时注册 Rich Media 与 File/Document 模块。
- `ComposedWorkbench` 使用 `WorkbenchShell` 渲染组合工作台。
- 注册 `sidebar.footer.action` 与组合工作台 locale。

## Required Capability Ledger

| 能力 | 状态 | canonical owner | 本切片 | 验收证据 |
| --- | --- | --- | --- | --- |
| 组合注册 | required | Harness Plugins | deliver-now | registry test |
| 组合 Shell | required | Harness Plugins | deliver-now | typecheck/build |
| 侧栏入口 | required | Harness Plugins | deliver-now | typecheck/build |

## Impact

- 新 owner package：`packages/bundle/dsh-workbench-compose/`。
- 依赖：Workbench Core、Rich Media、File/Document。
- 不修改各模块 canonical state。
