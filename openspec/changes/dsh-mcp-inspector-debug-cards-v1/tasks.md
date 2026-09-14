# Tasks: dsh-mcp-inspector-debug-cards-v1

本 change 立项波为设计工件 only：仅 §1 勾选，§2–§6 全部面向后续实现波，勾选必须以
对应 Validation 的通过证据为准（不含启动官方 `dsh web`，治理约定）。实现前先读
`docs/design/dsh-unified-panel-visual-system.md`；本 change design.md 已填 §12 UI Contract。

## 1. 设计工件（本波交付）

- [x] 1.1 冻结本 change 设计工件四件套：proposal、design、tasks、spec delta。
  - **Evidence**：`proposal.md` 与 `.openspec.yaml` 由前序会话 2026-09-14 交付（本波未改动）；本波补齐 `design.md`（信号源/映射表/合并码/undecoded/bounded retry/host 投影/恰好一次 re-discovery/诚实降级/UI Contract）、`tasks.md` 与 `specs/dsh-mcp-inspector-debug-cards/spec.md`；`openspec validate dsh-mcp-inspector-debug-cards-v1 --strict --no-interactive` 本波实测绿（exit 0，2026-09-14）。
  - **Validation**：`openspec validate dsh-mcp-inspector-debug-cards-v1 --strict --no-interactive`。

## 2. 失败解码卡

- [x] 2.1 纯解码函数 `decodeToolFailure(signal)`：按 design §2 冻结映射表把三路信号（ConversationSnapshot `errorCode`/`errorName`、toolHub client error、目录派生空工具信号）映射到根仓冻结分类法七码，fail-closed。
  - **Owner/Scope**：`packages/client/ui-mcp-inspector/src/client/failure-decode.ts` + `tests/failure-decode.test.ts`。
  - **Acceptance**：框架无关纯函数；同输入输出确定；分类法码字面量透传不改写；未知形状/超界输入 → `undecoded`，永不猜测码。
  - **Validation**：`pnpm --filter @yeisme/dsh-client-ui-mcp-inspector test -- tests/failure-decode.test.ts`。
  - **Evidence**：`src/client/failure-decode.ts`（框架无关纯函数，安全门沿用 errorCode/errorName 门格式）+ `tests/failure-decode.test.ts`；focused Vitest 27 项绿（2026-09-14）。未知/超界/无字段输入实测落 `undecoded`。
- [x] 2.2 归一器 additive 结构化原因：`ToolHubClientError` 增加可选 `authCause`（`unauthenticated | permission_denied`），保留结构化 `status`；丢失区分度的 `accessDenied` → 解码为 `undecoded`。
  - **Owner/Scope**：`packages/client/ui-mcp-inspector/src/client/remote.ts` + `tests/remote.test.ts`。
  - **Acceptance**：既有 `code`/`accessDenied` 字段与消费者语义零变化；仅 additive 可选字段。
  - **Validation**：`pnpm --filter @yeisme/dsh-client-ui-mcp-inspector test -- tests/remote.test.ts`。
  - **Evidence**：`src/client/remote.ts` additive：`ToolHubClientError` 增可选 `authCause`，`normalizeToolHubClientError` 401/403 分支携带结构化原因（含结构化 `status` 文本）；`code`/`accessDenied` 既有语义与消费者零变化（`tests/remote.test.ts` 新增三例，10 项全绿）。
- [x] 2.3 合并码单一状态实现：`permission_denied_or_unknown_action` 渲染一个共享常量状态对象；解码结果无任何可反推触发条件的字段。
  - **Owner/Scope**：`src/client/failure-decode.ts`（共享常量）+ 卡片组件。
  - **Acceptance**：403、空 tools、unknown-action 三类输入命中同一呈现对象（同 title/likely causes/next actions：capability 搜索拼写核对、申请授权、预算内重试）。
  - **Validation**：合同测试 §3.1。
  - **Evidence**：合并码渲染共享冻结常量 `PLAIN_DECODED.permission_denied_or_unknown_action`（仅 `taxonomyCode` 键，无 cause/detail/hit-reason）；403/空 tools/unknown-action 三类输入命中同一对象，由 §3.1 合同测试钉死。
- [x] 2.4 bounded `retry_after_seconds` 呈现：仅 rate/budget 码携带；`0–3600` 显示精确秒，`>3600` 定性提示，缺省不造数；无倒计时、无据此自动重试或调度。
  - **Owner/Scope**：`src/client/failure-decode.ts` + 卡片渲染 + locale。
  - **Acceptance**：缺省字段时不显示任何时间承诺；源码无 timer/auto-retry 路径。
  - **Validation**：`pnpm --filter @yeisme/dsh-client-ui-mcp-inspector test`。
  - **Evidence**：`retryAfterHint`：仅 rate/budget 码可携带 `retryAfterSeconds`；0–3600 精确秒、>3600 定性提示、缺失/非有限/负值不造数；`failure-decode.ts`/`DebugCards.tsx` grep 无 timer/auto-retry/mount 触发路径。
- [x] 2.5 失败解码卡组件接入既有 pane（session-scope；activity/catalog 信号已在仓内），zh/en 双语，空态（无失败信号）不渲染卡片。
  - **Owner/Scope**：`src/client/McpInspectorView.tsx`（或新增 `DebugCards.tsx`）+ `src/client/locales.ts`；不改 pane 注册与 tab 结构。
  - **Acceptance**：纯只读呈现，无调用动作；卸载插件随 pane 一并移除；不触碰 `dsh-mcp-inspector-v1` 既有 snapshot。
  - **Validation**：`pnpm --filter @yeisme/dsh-client-ui-mcp-inspector typecheck && pnpm --filter @yeisme/dsh-client-ui-mcp-inspector build`。

## 3. 合同测试：合并态不可拆分

  - **Evidence**：`src/client/DebugCards.tsx` FailureDecodeCard 经 `failureSignals` 接入 `renderToolsInspectorTree`（pane 注册与 tab 结构零改动）；信号源为 health-gated 空工具目录信号与 `error` 态 toolHub client error（controller additive 携带 authCause）；空态不渲染卡片；locale zh/en 对称（173/173 键一致）。`pnpm --filter @yeisme/dsh-client-ui-mcp-inspector typecheck && vitest run && build` 全绿（18 文件/121 测试）。
- [x] 3.1 合并态 non-split 断言：对"403/forbidden 信号、server 健康但空 tools 信号、unknown-action 信号"三类输入断言呈现输出 deep-equal（taxonomy code、title、likely causes、next actions 全一致），并断言解码结果对象上不存在任何可区分触发条件的键。
  - **Owner/Scope**：`tests/failure-decode.test.ts`（`describe('merged-state contract')`）。
  - **Acceptance**：任何试图拆分合并态（新增 cause/hit-reason 字段或分叉文案）的实现使本测试红灯；测试注释引用根仓冻结合同（存在性预言机）。
  - **Validation**：`pnpm --filter @yeisme/dsh-client-ui-mcp-inspector test -- tests/failure-decode.test.ts`。
  - **Evidence**：`tests/failure-decode.test.ts` `describe('merged-state contract')`：三类输入解码结果 `toBe` 同一冻结常量 + `Object.keys` 仅 `['taxonomyCode']` + zh/en 呈现 deep-equal；注释引用根仓冻结合同（存在性预言机）。
- [x] 3.2 分类法快照测试：冻结七码逐一有用例覆盖 + 每码一条未知/无信号输入 → `undecoded` 的 fail-closed 用例。
  - **Owner/Scope**：`tests/failure-decode.test.ts`（`describe('frozen taxonomy snapshot')`）。
  - **Acceptance**：分类法码集合变化（根仓未来演进）时本测试显式红灯而非静默漂移。
  - **Validation**：同 3.1。

## 4. 能力地图卡

  - **Evidence**：`tests/failure-decode.test.ts` `describe('frozen taxonomy snapshot')`：冻结七码逐一用例 + 字面量透传 + 未知/无信号/超界/丢失区分度 fail-closed 用例；分类法码集合变化显式红灯。
- [x] 4.1 Host additive connect-doc 投影：`toolHub` Remote 新增 `connectDoc()` 只读方法与 wire 类型（compact faces + `docDigest` digest_sha256_16 + observedAt；`connect-doc-unavailable` 失败形状），从已批准绑定/当前暴露读取 `gateway_connect_doc.v1`；既有 `list`/`setEnabled` 与 `specVersion` 不变。
  - **Owner/Scope**：`packages/host/dsh-tool-hub/src/wire.ts`、`src/remote.ts`、新增 `src/connect-doc.ts` + `tests/service.spec.ts` 增例。
  - **Acceptance**：旧客户端零感知；wire 只传 safe projection 字段；G4 未落地时回 `connect-doc-unavailable`（带原因）。
  - **Validation**：`pnpm --filter @yeisme/dsh-tool-hub-host test`。
  - **Evidence**：`packages/host/dsh-tool-hub` additive：`src/wire.ts` 新增 connect-doc/rediscover wire 类型、`src/connect-doc.ts`（digest_sha256_16/face 白名单/有界校验，未知字段不透传）、`src/remote.ts` 增 `connectDoc()` 只读转发、`src/service.ts` 增 reader；`list`/`setEnabled` 描述符与 `specVersion` 零变化（markers 测试更新为 4 方法）。G4 未落地时实测回 `connect-doc-unavailable`（带原因，transport error 不泄私有细节）。`tests/service.spec.ts` 全绿；包 typecheck+build 绿。
- [x] 4.2 Host server-authored 恰好一次 re-discovery：`rediscover()` 单次 `tools/list`、in-flight 守卫（`rediscover-in-progress`）、完成后 generation 递增并重取 digest；无 timer/mount/漂移自动触发路径。
  - **Owner/Scope**：`packages/host/dsh-tool-hub/src/connect-doc.ts` + `tests/service.spec.ts`。
  - **Acceptance**：并发调用只放行一次；源码 grep 无自动调度调用点。
  - **Validation**：`pnpm --filter @yeisme/dsh-tool-hub-host test`。
  - **Evidence**：`src/service.ts` `rediscover()`：单次 catalog collect（=一次 tools/list）→ generation 递增 → 重取 digest；in-flight 守卫实测并发第二调用回 `rediscover-in-progress`、settle 后守卫解除；collect/doc 失败回 `rediscover-unavailable`。源码 grep 无 timer/mount/漂移自动调用点（仅 Remote 显式转发）。`tests/service.spec.ts` 全绿。包内 2 个 owner spec 需 `--host` 集成证据入口（环境门），基线 worktree 复核为 pre-existing environmental，非本 change 引入。
- [x] 4.3 Client wire mirror + 轻量 controller：digest 背书记录、漂移置 stale、重读后一致才撤；浏览器不直连 Gateway 的静态守卫测试（client 源无 gateway URL/token/cookie、无新增任意 fetch 面）。
  - **Owner/Scope**：`packages/client/ui-mcp-inspector/src/client/wire.ts`（mirror）、新增 `src/client/connect-doc.ts` + `tests/connect-doc.test.ts`。
  - **Acceptance**：probe 不到 `connectDoc`/`rediscover`（旧宿主）→ controller 呈禁用态而非报错。
  - **Validation**：`pnpm --filter @yeisme/dsh-client-ui-mcp-inspector test -- tests/connect-doc.test.ts`。
  - **Evidence**：`src/client/wire.ts` mirror（connect-doc/rediscover 类型 + `ToolHubRemoteFace` 可选方法）、`src/client/connect-doc.ts` `ConnectDocController`（digest 背书/漂移置 stale 保留渲染 doc/重读一致不冒充/rediscover 单飞守卫同步生效）、`src/client/remote.ts` unwrapNamespace 仅在 namespace 已暴露时 additive 转发；`tests/connect-doc.test.ts` 8 项绿（含禁用/错误/stale/单飞/守卫静态扫描：client 源无 fetch/XMLHttpRequest/WebSocket/document.cookie/gateway URL）。包 vitest 19 文件 129 测试全绿、typecheck+build 绿、check:bundles 29/29、check:plugins 全 PASS。
- [x] 4.4 能力地图卡 UI：faces+digest+observedAt 呈现、digest 漂移 mismatch 横幅（stale 标注，不冒充新鲜）、横幅内单一 re-discovery 动作（in-flight 禁用）、禁用+原因降级态；zh/en 双语；无手写快速卡兜底、无静默陈旧回退。
  - **Owner/Scope**：卡片组件 + `src/client/locales.ts`；接入既有 pane，不加 tab/bundle/pane kind。
  - **Acceptance**：`ui-conversation` 只读边界不变；bundle 仅在需要时 additive 导出（cordis.patch.yml insert 行不变）。
  - **Validation**：`pnpm --filter @yeisme/dsh-client-ui-mcp-inspector typecheck && pnpm --filter @yeisme/dsh-client-ui-mcp-inspector build && pnpm run check:bundles`。
  - **Evidence**：`src/client/DebugCards.tsx` `CapabilityMapCard`：faces+digest(`<code>`)+observedAt 呈现、digest 漂移 mismatch 横幅（`role="alert"`、明示已渲染/当前 digest、stale 标注）、横幅内单一 re-discovery 动作（in-flight `disabled`）、禁用+原因/骨架/error+重探降级态；zh/en locale 16+15 键对称；经 `connectDocController` 接入 `renderToolsInspectorTree`（index.ts apply 创建 controller，pane 注册与 tab 结构零改动，未传时不渲染、视觉 fixture 字节不变）；无手写快速卡兜底、无 timer。`typecheck`+`build`+`check:bundles` 29/29+`check:plugins` 全 PASS。
- [x] 4.5 降级链验证：投影缺失（旧宿主）、`connect-doc-unavailable`（G4 未落地）、transport error 三态均诚实——禁用+原因 / error+重探，不渲染任何冒充新鲜的数据。
  - **Owner/Scope**：`tests/connect-doc.test.ts` + `tests/degrade-loop.spec.tsx` 增例。
  - **Acceptance**：三态各有断言；无一处把内存旧 doc 当新鲜渲染。
  - **Validation**：`pnpm --filter @yeisme/dsh-client-ui-mcp-inspector test`。

## 5. i18n 与视觉合同

  - **Evidence**：`tests/connect-doc.test.ts`（投影缺失/`connect-doc-unavailable`/transport error 三态 controller 断言）+ `tests/degrade-loop.spec.tsx` 增例（三态渲染断言：disabled 不渲染 digest/动作、error 带 `[data-map-reread]` 且不泄私有错误、stale 横幅 role=alert 保留渲染 doc、显式 re-discovery 后 digest 一致才撤横幅）；包 vitest 19 文件 132 测试全绿。无一处把内存旧 doc 当新鲜渲染（stale 状态显式标注断言）。
- [x] 5.1 双语字典：两卡全部文案进 `locales.ts` NS `mcpInspector`（zh/en 对称、key 同名配对），码名/动作/横幅/降级原因零硬编码。
  - **Owner/Scope**：`src/client/locales.ts`。
  - **Acceptance**：`en`/`zh` 键集一致；undecoded/合并态文案不暗示触发条件。
  - **Validation**：`pnpm --filter @yeisme/dsh-client-ui-mcp-inspector typecheck && pnpm run check:plugins`。
  - **Evidence**：两卡全部文案进 `locales.ts` NS `mcpInspector`：失败解码卡 39 键 + 能力地图卡 31 键，zh/en 逐键同名配对（197/197 一致）；降级原因改为 locale 中立结构码（`ConnectDocDisabledCode`/`ConnectDocErrorCode`），卡内映射字典键，owner 消息原样透传，码名/动作/横幅/降级原因零硬编码文案。`typecheck`+`check:plugins` 全 PASS；vitest 132 测试全绿。
- [ ] 5.2 视觉合同：扩展 `tests/ui-visual/tools-discovery-page.mjs` fixture 与 `tests/ui-visual/visual-tools.spec.ts`（真实 Chromium/Playwright）覆盖两卡状态矩阵（分类法码卡、undecoded、digest 漂移横幅、禁用+原因、360/560/960px）；`check:surfaces` 绿；基线仅在人工确认差异符合视觉系统后经 `test:visual:update` 更新。
  - **Owner/Scope**：`tests/ui-visual/tools-discovery-page.mjs`、`tests/ui-visual/visual-tools.spec.ts`。
  - **Acceptance**：两卡各状态有截图断言；不修改 `dsh-mcp-inspector-v1` 既有 snapshot 语义。
  - **Validation**：`node scripts/run-ui-visual-tests.mjs visual-tools.spec.ts` + `pnpm run check:surfaces` + `pnpm run test:visual`。

## 6. 验收、证据与门禁

- [x] 6.1 focused Vitest 全绿：两包新增/受影响测试文件逐一通过。
  - **Owner/Scope**：`@yeisme/dsh-client-ui-mcp-inspector`、`@yeisme/dsh-tool-hub-host`。
  - **Validation**：`pnpm --filter @yeisme/dsh-client-ui-mcp-inspector test && pnpm --filter @yeisme/dsh-tool-hub-host test`。
  - **Evidence**：两包新增/受影响测试文件逐一通过：client `failure-decode.test.ts`（27）/`remote.test.ts`（10）/`connect-doc.test.ts`（8）/`degrade-loop.spec.tsx`（4）及全包 19 文件 132 测试 exit 0；host `service.spec.ts` 9 项 exit 0。host 包全量另有 2 个 owner spec 需 `--host` 集成证据入口（环境门），已在本 change 改动前于 `.wt/` 基线 worktree 复现为同样红，分类 environmental、非本 change 引入。
- [ ] 6.2 全仓门禁：`pnpm run typecheck && pnpm run test && pnpm run build && pnpm run check:bundles` + `pnpm run check:plugins`、`pnpm run check:surfaces`、`pnpm run test:visual`；全局门红灯先分类（introduced/pre-existing/concurrent/environmental），只修本 change 引入项。
  - **Validation**：逐条记录 exit code。
- [ ] 6.3 证据脱敏落 `temp/integration-test-runs/<run-id>/`：`pnpm --filter @yeisme/dsh-client-ui-mcp-inspector run ui:acceptance`（或 `run test:integration`）跑六件套；证据不含 secret/raw prompt/private tool arguments/绝对路径/完整思维链。
  - **Validation**：evidence 目录含 command/env/exit code/redaction summary。
- [x] 6.4 `openspec validate dsh-mcp-inspector-debug-cards-v1 --strict --no-interactive` 绿 + 零阻塞核验：`openspec/changes/dsh-mcp-inspector-v1/` 零文件改动、其 3.1 external-gate 复核节奏不受本 change 影响。
  - **Validation**：validate 绿 + `git diff --stat -- openspec/changes/dsh-mcp-inspector-v1/` 为空。
  - **Evidence**：`openspec validate dsh-mcp-inspector-debug-cards-v1 --strict --no-interactive` 绿（2026-09-14 实测）；`git diff --stat -- openspec/changes/dsh-mcp-inspector-v1/` 为空（本 change 全程零触碰其文件与 L2 seam）；其 3.1 external-gate 复核节奏不受影响。归档时可原样重跑复核。
- [ ] 6.5 external-gate：Gateway `gateway_connect_doc.v1` 投影（根仓 tasks 6.4/G4，owner change 未建）落地前，能力地图卡保持 4.5 诚实降级且失败解码卡独立可用；投影落地后在真实 connect doc 上复验消费与 digest 漂移（含一次真实 re-discovery），证据落 §6.3 目录。该复验完成前本项与 4.x 对应真源勾选保持克制。
  - **Validation**：真实投影消费证据（redacted）+ 复核注记。
