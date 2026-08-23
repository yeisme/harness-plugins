## 1. 合同与迁移门

- [x] 1.1 严格校验 proposal/design/specs，确认公开面均采用 additive optional 字段/参数，记录一 RC deprecation 与 rollback。
- [x] 1.2 更新 Pane Workbench 与 upstream staging 文档，声明唯一 Core Pane 扩展路径和 legacy Details 回退边界。

## 2. Pane Workbench Core 实现

- [x] 2.1 为本地 view registration 增加 `showInPicker`，默认可见；picker 跳过隐藏 provider，现有 provider 无需修改。
- [x] 2.2 为 `PaneLocalViewProps` 与 Right/Bottom chrome 增加 owner-authored `hostContent` / `renderCoreView`，保证该内容不进入 projection 或 persistence。
- [x] 2.3 在生产 apply 中内置注册 singleton `dsh.tool-details`，通过同一 controller 打开/关闭，并将其从通用 picker 隐藏。
- [x] 2.4 attach `ctx.workspaceLayout` 时提供 Core Pane host adapter；dispose 时按逆序释放 adapter、slots、built-in provider 与 controller。
- [x] 2.5 添加 registry、picker、core open/close、Right/Bottom move、single-mount、old consumer compatibility 与 teardown tests。

## 3. DSH upstream seam staging

- [x] 3.1 扩展 `workspace-layout` 合同：可选 Core host adapter、`corePaneHostAttached`、封闭 core id 与 Right/Bottom `renderCoreView` callback。
- [x] 3.2 修改 `LayoutController.openDetails/closeDetails` 和 AppFrame，使 adapter 存在时路由 Core Tool Details，缺席时保留 legacy column。
- [x] 3.3 更新 session-switch、geometry、slot type、service 与 browser/unit tests，验证 Core 主路径不挂载独立 Details column。
- [x] 3.4 重新生成 `upstream-prs/pane-workspace-layout/changes.patch` 与 new-files、README 清单，并在干净 DSH base 上通过 apply check。

## 4. 验证与收口

- [x] 4.1 运行 Pane Workbench focused typecheck/test/build 与 bundle test/profile conformance。
- [x] 4.2 运行 upstream `ui-layout` / `ui-conversation` focused tests 和 typecheck；无法运行的外部环境门记录为明确风险。
- [x] 4.3 运行 `openspec validate dsh-unified-core-pane-v1 --strict --no-interactive`，检查 git diff 与兼容分类。
- [x] 4.4 将完成任务勾选，记录 affected surfaces、deprecation window、rollback 和验证证据。

## 完成证据

- Pane Workbench：TypeScript typecheck 通过；16 个 test files、83 tests 通过；client 与 bundle build 通过；bundle profile conformance 通过；integration projection 1/1 通过。
- DSH staging：5 个 focused test files、102 tests 通过；`build:lib:host` 通过；`ui-layout` + `ui-conversation` focused client typecheck 通过；focused Oxlint 通过。
- DSH 文档：1004 个 translation pairs 与 597 个 Agent Notes format 检查通过。
- Patch：基于 `b150a551b8d465e31e418e1b2eaf5e79bbb7d28e` 的新 worktree 通过 `apply.sh`、`git apply --check` 与 `git diff --check`，关键文件和验证 staging 内容一致。
- Browser：Core Tool Details evidence runner 已迁移为 single-host/cross-region 断言；本次未启动完整 Web profile 重新采集截图，`evidence.tar.gz` 明确保留为旧 docking baseline。
- Affected stable surfaces：`ctx.workspaceLayout.attach`、workspace snapshot、Right/Bottom owner props、`PaneLocalViewProps`、local view registration、`ctx.layout.openDetails/closeDetails` 可观察路由。
- Deprecation window：独立 `details` geometry 与 `auxiliaryPriority` 保留一个 RC；删除必须另开 change。
- Rollback：回退 Pane bundle 与 DSH staging patch；legacy `details` slot/store/column 仍在，不迁移或删除领域数据。
