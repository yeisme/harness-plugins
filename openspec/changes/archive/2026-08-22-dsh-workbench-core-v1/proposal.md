## Why

DSH-better-sidebar 已证明“侧边工作台 + Tab 生态”是 DSH 从聊天工具走向可组合工作台的关键交互。社区已有 Jupyter、Office、Sidebar QA 等第三方 Tab，但缺少一个自研、可扩展、基于官方 seam 的 Workbench Core。当前 `@yeisme/dsh-rich-media` 里的 Rich Media Workbench 是第一个模块；继续发展需要把 shell/tab registry 抽成通用核心，而不是在每个模块里重复实现工作台。

准入结论为 `fit + split-owner`：Harness Plugins 适合拥有 Workbench Core 的 module/tab registry、React shell 与命令聚合；文件、终端、Git、浏览器、媒体、Agent、Plan/Skills 等 canonical state 继续归 DSH/领域 owner。

## What Changes

- 新增 `@yeisme/dsh-workbench-core` package，提供 `WorkbenchModuleDefinitionV1`、`WorkbenchTabV1`、`WorkbenchCommandV1` 合同与纯 headless `WorkbenchRegistry`。
- 新增可访问的 React `WorkbenchShell`：tablist + 主面板 + status bar，供各模块复用。
- 提供可安装 bundle row 与 `cordis.patch.yml`；当前 client apply 为 no-op，等待官方 Workbench/Pane slot 确认后接入。
- 以 DSH-better-sidebar 为交互参考，但不复制其源码、DOM、CSS 或私有 API。
- 为后续 Rich Media、File、Terminal、Git、Browser、Jobs、Plan+Skills 等模块提供统一注册/排序/生命周期入口。

## Required Capability Ledger

| 能力 | 状态 | canonical owner | 本切片 | 验收证据 |
| --- | --- | --- | --- | --- |
| Workbench 合同 | required | Harness Plugins | deliver-now | validation/negative fixtures |
| Module Registry | required | Harness Plugins | deliver-now | register/dispose/sort tests |
| React Shell | required | Harness Plugins | deliver-now | typecheck/build |
| 官方 Workbench/Pane slot 接入 | required | Harness Plugins + DSH | retain-next | 待 seam 确认 |
| 模块市场/签名/自动更新 | required | Harness Plugins | retain-next | 后续独立 change |

## Capabilities

### New Capabilities

- `workbench-module-contract`: 模块/tab/command 描述与校验。
- `workbench-module-registry`: 纯 headless registry、排序、dispose。
- `workbench-react-shell`: 可访问的通用工作台 shell。

### Modified Capabilities

无。本 change 新增 additive package，不修改既有 Rich Media、Ordo 或 DSH package 合同。

## Impact

- 新 owner package：`packages/bundle/dsh-workbench-core/`。
- 依赖关系：React、`@deepseek-ai/dsh-client-runtime`、`@deepseek-ai/dsh-client-ui-slots`、Cordis；不依赖 DSH-better-sidebar。
- 后续模块：`@yeisme/dsh-rich-media` 将改为消费 Workbench Core 的 registry/shell。
- 合同兼容分类：全新、additive、experimental；rollback 为移除新 bundle/feature，不涉及数据迁移。
