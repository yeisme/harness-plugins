## Context

`archive/2026-08-27-workbench-harness-bridge-completion-v1/design.md` 的「后续任务（本 change 不实施）」节指出：五个 Harness 组件当时只被测试渲染，未挂到 `/harness` 路由的真实槽位；后续任务应把它们接到对应 slot 的 connected 数据流，为无合同槽位保持 `needs_contract` 占位，且该工作需要独立的 OpenSpec change。

该后续工作已于 2026-08-27 完成实现与验证，但实现先行于 change 工件。本 design 是追溯记录：specs 与 tasks 严格对照已合入的代码行为撰写，描述的是现状而非计划。

## Goals / Non-Goals

- Goals
  - 为五个组件挂接 `/harness` 路由与 iframe-host 接 `HarnessBridgeSession` 的既成实现补齐独立 change 留痕。
  - specs 与 `apps/web/src/workbench/harness/` 当前代码逐一对应，每条 Requirement/Scenario 都有对应实现与测试。
- Non-Goals
  - 不修改任何代码、测试、SDK、service 或其他 change 的工件。
  - 不声明任何超出已实现行为的能力：真实 owner descriptor catalog、BFF action dispatch、DSH 真实导航仍为 `needs_contract`，不在本 change 伪造。

## Decisions（追溯记录既成决策）

### D1: `/harness` 路由懒加载 connected 组件，不接受 tenant/workspace 路由参数

`apps/web/src/app.tsx:18,41` 用 `lazy` + `Suspense` 挂 `HarnessConnectedRoute`，fallback 为诚实加载态；导航模型 `apps/web/src/workbench/navigation/model.ts:110` 注册 `/harness` 入口。scope 一律由 BFF 从认证 session 派生，组件不接受 tenant/workspace 路由参数。`HarnessConnectedRoute`（`harness-route.tsx:78`）在 harness client 缺席时回退到注入式 `HarnessRoute`，供本地 canary 与组件测试使用。

### D2: connected 数据流全部 fail-closed，descriptor catalog 是槽位的唯一门禁

`HarnessConnectedData`（`harness-route.tsx:83`）依次拉取 context → descriptors → projections：

- 每个请求都经 `withHarnessAuthorityRequest` 注册到 Authority cleanup 边界；任何错误按 envelope code 映射为 `permission_required`/`contract_mismatch`/`needs_contract`/`offline`/`degraded` 之一的诚实状态，绝不以 fixture 或浏览器推断伪装 ready。
- descriptor catalog 只有在与当前 context 完全一致（tenant/workspace/principal/contextRevision 四元组）且每个 descriptor 通过 `validateHarnessPluginDescriptorAgainstRegistry` 且 `readiness === "available"` 时才被采用；projection 存在但无匹配 descriptor 时路由级 readiness 降为 `needs_contract`（diagnostic `descriptor_missing`）。
- 每个 projection 渲染前重跑 `createHarnessProjection` 并比对 context 四元组；snapshot 携带 descriptors 时，无精确绑定（installation/surface/kind/version/contractDigest 五元组）的 projection 被丢弃并记 `descriptorMismatch`，该 surface 渲染 `needs_contract` 而非数据。

### D3: per-surface 槽位门禁——descriptor 未批准一律不渲染

`HarnessSurfaceSlots`/`HarnessLibrarySlots`/`HarnessEpisodeSlots`/`HarnessActionSlot`/`HarnessDshSlot`（`harness-route.tsx:351-426`）按 surface 分发五个组件，规则：

- `eikona.asset`：`asset-library` 槽位无 registry 批准的 descriptor 时，`HarnessAssetLibrary` 与 `HarnessLayoutCanvas` 都不渲染，替换为两个 `needs_contract` 占位；获批后只渲染 server-authored 供给（缺省为空数组，绝不自造数据）。
- `scaena.episode`：`episode-workspace` 槽位无批准 descriptor 时 iframe 与 DSH handoff 双双占位；descriptor 非 `sandboxed-iframe` 种类时 iframe 宿主保持关闭。
- DSH handoff 需同时通过 `validateHarnessDshDeepLink` closed 校验、`sourceSurfaceId === descriptor.surfaceId` 绑定与 `validateHarnessDeepLinkTarget` registry allowlist；任一不满足则不渲染打开按钮。点击打开只记录意图并显示「导航合同仍为 needs_contract」，不执行真实导航。
- action 确认入口需同时满足：action context 与当前 context 一致、`actionRef` 列入 projection `allowedActionRefs`、installation/surface/contractDigest 与 projection 精确绑定、存在 registry 批准且 `available` 的 catalog descriptor；缺任一即整体占位，不产生 dispatch。路由默认 dispatcher 是 `createFakeHarnessActionDispatcher()`（SDK fake seam），真实 TaskService/BFF dispatch 合同保持 `needs_contract`，不伪造 receipt。

### D4: iframe 宿主接线 per-load `HarnessBridgeSession`，任何漂移 fail-closed 卸载

`HarnessSandboxedFrame`（`iframe-host.tsx`）在宿主接线层落地 bridge-completion-v1 交付的时序机：

- descriptor 先过静态 release/origin registry（`createHarnessIframeHostProps`），不过则渲染 `needs_contract` 阻断态，不挂载 iframe；挂载的 iframe 钉死 default-deny `sandbox`/`referrerPolicy`/`csp`/`allow=""`。
- 每次加载生成 per-load channel nonce，构造 `HarnessBridgeChannel` 绑定 context 与 release digest；inbound 监听器先校验 `event.source` 精确等于本 iframe 的 `contentWindow`（不匹配即 `blocked_supply_chain`），再走 `acceptHarnessBridgeInbound` 做逐消息 schema 校验 + handshake→ready→view.request 时序校验。
- 每个 pending `view.request` 经 `sendHarnessViewResponse` 恰好应答一次；任何乱序、重复、origin/nonce/context/release 漂移都把 surface 替换为脱敏 `blocked` 状态并卸载 iframe，不重试、不降级。

### D5: context 切换一次性清空 presentation 状态

`context-switch.ts` 的 `reduceHarnessPresentation` 在 context key（tenant|workspace|principal|revision）变化时把 tab、聚焦资源、overlay、action preview 一次性重置为初始态，路由组件在切换后聚焦默认 tab；不允许旧 tenant/workspace 的呈现状态在 rehydration 后残留。

## Risks / Trade-offs

- 实现先行于 change 是本追溯记录存在的根本原因；缓解：specs 逐条对照代码与 68 个 component 测试撰写，tasks.md 引用既有证据 run-id，不补写无法证实的内容。
- owner descriptor catalog 合同未就绪，真实槽位数据流只在测试中经注入 snapshot 验证；生产路径在 catalog `needs_contract` 时恒为占位，这符合 fail-closed 红线。

## Verification

- `openspec validate workbench-harness-route-wiring-v1 --strict`
- 既有 component 证据：`temp/integration-test-runs/harness-route-wiring-20260827-r1/`（9 个测试文件、68/68 pass、exit 0，含 `harness-route-wiring.test.tsx` 7 个 fail-closed 槽位门禁用例与 `harness-iframe-host.test.tsx` 10 个 bridge 时序用例）
