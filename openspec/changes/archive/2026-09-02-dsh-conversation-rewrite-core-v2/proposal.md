## Why

现有 `ui-conversation-rewrite` 已冻结 Edit/Retry 的 child-branch 语义，但其 boundary 与 controller 位于 Web/React 包内并直接依赖 DSH client runtime 类型。dsh-tui v21 需要复用同一稳定边界、unknown outcome 和 recovery 规则，不能导入 React，也不能复制一份逐渐漂移的实现。

## What Changes

- 新增纯 TypeScript 包 `@yeisme/dsh-client-ui-conversation-rewrite-core`，使用 host-neutral snapshot/target/outcome 类型，不依赖 React、DOM、DSH runtime 或私有 core。
- 将稳定前置 `turn/end`、首轮 capability、text-only、running/removed/stale 等判定收敛为 V2 boundary API，并为 Edit、Retry、TUI historical rewrite 提供同一决策。
- 新增 typed mutation pipeline：`fork → prompt → activate → optional hydrate`，显式区分 `accepted | rejected | unknown`，输出 `forking | prompting | activating | hydrating | succeeded | recoverable_error`。
- child ID 已知后的失败保留 child 并生成无 prompt 内容的 recovery receipt；unknown outcome 不自动 retry，不自动删除 child。
- 现有 `@yeisme/dsh-client-ui-conversation-rewrite` 通过 adapter 使用新 core，但全部旧导出、函数签名、phase/view shape 与 Web slot 行为保持兼容；旧 V1 controller 可作为 thin facade。
- 新增跨 Web/TUI 的 host-neutral contract fixtures，固定 completed、first-round、running、non-text、removed、stale 与 partial-success 分类。

## Capabilities

### New Capabilities

- `conversation-rewrite-core`: 跨客户端的纯 rewrite snapshot、边界决策、typed mutation outcome、分阶段 controller、recovery receipt 与兼容 adapter 合同。

### Modified Capabilities

无。现有 `conversation-rewrite` requirement、Web package export 与 DSH Session owner wire 不改义；新 core 以 additive package/V2 symbols 接入。

## Impact

- 新 owner 路径：`packages/client/conversation-rewrite-core/`；发布包为 `@yeisme/dsh-client-ui-conversation-rewrite-core`。
- `packages/client/ui-conversation-rewrite` 增加 core dependency 与 adapter/shim，但继续是 Web UI/slot owner；React 组件不移动到 core。
- `client/dsh-tui` 作为外部 consumer 使用版本化 package，只实现 terminal gesture、projection 和 DSH API adapter。
- 公开 TS 变化全部 additive。`ChatRewriteController`、`ChatRewriteHost`、`ChatRewritePhase`、`ChatRewriteViewState`、`computeEditTarget`、`computeRetryTarget` 及既有 re-export 不删除、不重命名、不改变参数或返回 shape。
- 不改变 `sessions.fork`、`session.prompt`、`session.open`、`forkBeforeMessage` seam 或 DSH canonical Session/history。无数据库、配置或持久化迁移。
- 集成证据写入本仓 `temp/integration-test-runs/<run-id>/`，只记录 stage/outcome/code/child ID（如已知）等脱敏事实，不记录 raw prompt、provider payload 或 private tool arguments。
