# Tasks

## 1. P0 合同

- [x] 1.1 [Owner: Harness Plugins；Scope: `packages/host/dsh-selection-host/src`；Dependencies: none] `SelectionAnchorV1` additive 新增 `table-range` kind（sheetId/rowFrom/rowTo/colFrom/colTo/digest）与校验；拒绝越界与非单调区间。Acceptance: valid/invalid fixtures 全过；Validation: `pnpm --filter @yeisme/dsh-selection-host run test`。
- [x] 1.2 [Owner: Harness Plugins；Scope: `packages/client/ui-interaction-space/src/contracts`；Dependencies: none] 定义 `SpaceDirectiveV1`（focus/highlight/propose/request-input/progress）与 `SpaceProposalV1`（per-format diff 载荷）headless 校验：unknown kind、越界 anchor、超预算载荷 fail-closed。Acceptance: negative fixtures 全过；Validation: `pnpm --filter @yeisme/dsh-client-ui-interaction-space run test`。
- [x] 1.3 [Owner: Harness Plugins；Scope: tests] P0 合同测试。Acceptance: 新测试通过；Validation: 同上。

## 2. P1 空间壳

- [x] 2.1 [Owner: Harness Plugins；Scope: `packages/client/ui-interaction-space/src/client/view.tsx`；Dependencies: 1.x] `interaction.space` view（pane-workbench 注册、resourceKey `space:<owner>:<ref>@<version>`、Tier 0 单 region 折叠）：锚点栏、directive 时间线骨架、降级条。Acceptance: view 注册/关闭重开 retention；Validation: `pnpm --filter @yeisme/dsh-client-ui-interaction-space run test`。
- [x] 2.2 [Owner: Harness Plugins；Scope: `packages/bundle/dsh-rich-media/src/client`；Dependencies: 1.1] 格式渲染器补 `data-source-*` 锚点提示（网格行列、文本行号、PDF 页码）并接 `selectionToAnchorDraft`；无提示→`dom-region`+unmappedReason。Acceptance: 不伪造行列号；Validation: `pnpm --filter @yeisme/dsh-rich-media run test`。
- [x] 2.3 [Owner: Harness Plugins；Scope: tests] 空间壳与锚点映射测试。Acceptance: 新测试通过；Validation: 同上。

## 3. P2 对话层

- [x] 3.1 [Owner: Harness Plugins；Scope: `packages/client/ui-interaction-space/src/client/session.ts`；Dependencies: 2.1] 空间内 session attach/fork（`ISessions.binding`/`fork`）；controller 不持有 `open()/openSubagent()/clear()` 引用，计数测试钉死主选择不变量。Acceptance: attach 后主对话 current selection 不变；Validation: `pnpm --filter @yeisme/dsh-client-ui-interaction-space run test`。
- [x] 3.2 [Owner: Harness Plugins；Scope: 同上；Dependencies: 3.1] composer adapter 锚点附着（`send {intent, text, anchorIds, approvalPolicy}`）；无 adapter 时本地评论降级。Acceptance: 锚点以结构化 anchorIds 附着；Validation: 同上。

## 4. P3 提案层

- [x] 4.1 [Owner: Harness Plugins；Scope: `packages/client/ui-interaction-space/src/client/directives.tsx`；Dependencies: 1.2, 2.1] `space/ref` 事件族→空间 directive 渲染（focus 确认、highlight、request-input、progress）；校验失败丢弃+typed 原因；节流合并。Acceptance: unknown directive 不渲染为空白；Validation: `pnpm --filter @yeisme/dsh-client-ui-interaction-space run test`。
- [x] 4.2 [Owner: Harness Plugins；Scope: `packages/client/ui-interaction-space/src/client/proposals.tsx`；Dependencies: 4.1] per-format diff 投影（行级 hunk/cell 变更矩阵/图片对比/docx 片段）+ 逐位置审批（复用 approval 合同）。Acceptance: drift/依赖阻断投影正确；Validation: 同上。
- [x] 4.3 [Owner: Harness Plugins；Scope: 同上；Dependencies: 4.2] owner adapter preview-before-mutate dispatch + receipt 时间线；无 adapter→只读 diff+复制出口。Acceptance: receipt 未知/失败不自动重试；Validation: 同上。

## 5. P4 收口

- [x] 5.1 [Owner: Harness Plugins；Scope: 全包；Dependencies: all] 预算/版本围栏/漂移协调（锚点 digest 校验、version bump→drifted）；bundle `dsh-interaction-space` + README。Acceptance: bundle 合同检查通过；Validation: `pnpm run check:bundles`。
- [x] 5.2 [Owner: Harness Plugins；Scope: openspec；Dependencies: all] `openspec validate dsh-agent-interaction-space-v1 --strict --no-interactive` 通过；全量 `pnpm run typecheck && pnpm run build`。
