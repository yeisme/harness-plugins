## 0. 规格冻结

- [x] 0.1 将能力归类为 `split-owner`，冻结 Harness Plugins、Browser Automation Owner 与 DSH Core 的职责。
- [x] 0.2 冻结 package paths、公开 identifiers、`browser.open` discovery、optional capabilities、Pane registration、data budgets 与 additive `0.1.0-rc.1` 兼容策略。
- [x] 0.3 冻结 Agent observe → human takeover → human input → release 流程、排他 control lease、viewport attachment 与 failure matrix。
- [x] 0.4 完成终稿编辑后，通过 strict OpenSpec validation 与文档 diff checks。

## 1. Host contract 与 fake Provider

- [x] 1.1 创建 `packages/host/dsh-browser-host/`，package 为 `@yeisme/dsh-browser-host@0.1.0-rc.1`，配置 strict ESM typecheck/test/build scripts 与 experimental API markers。 （done 2026-08-31: 包骨架落地——strict tsconfig（noUncheckedIndexedAccess/exactOptionalPropertyTypes/verbatimModuleSyntax）、typecheck/test/build 三脚本、tsdown ESM 输出、`BROWSER_PANE_EXPERIMENTAL_API` v0.1 实验标记常量；TSC ✅/build ✅/test 骨架就绪（1.4 负例起填充）。lockfile 已同步（78 projects）。）
- [x] 1.2 实现 `BrowserAutomationProviderV1`、`BrowserPaneHostV1`、`dsh.browserPaneHost`、binding/probe/session-discovery/snapshot/reconcile types、`BrowserViewportLeaseV1`、`BrowserControlLeaseV1` 与 typed input/ack types。 （done 2026-08-31: `contracts.ts`——`BrowserAutomationProviderV1`（session discovery+openSession）+ `BrowserPaneHostV1`（probe/listSessions/snapshot/dispatch/reconcile 五面，capability+experimental 标记）+ `BrowserAutomationBindingV1`（tenant/workspace/principal/contextRevision/sessionRef 精确回显）+ 四 schema 常量（projection/event/action/viewport attachment v0.1）+ snapshot（freshness/safeMessage/pages≤32 面/activePage/controlHolder）+ 12 型 event kind + 12 型 action kind（含 take_control/release_control/download_authorize/evidence_request）+ request（ephemeral navigationDraft 仅存于请求）+ receipt 四态 + **BrowserControlLeaseV1**（human 独占、agentInputPaused:true 结构性暂停）+ **BrowserViewportLeaseV1**（opaque leaseToken，Transport 本地解析）；safe location 只含 protocol/punycode host/pathDigest（零 URL/凭据/媒体地址）。TSC strict ✅。`dsh.browserPaneHost` context key 常量随 1.5 Remote 接线落地。）
- [x] 1.3 为 exact context/provider/session/version/digest/generation/page/epoch binding、64 KiB event payload 与 domain collection budgets 实现 strict validators。 （done 2026-08-31: `validation.ts`——zod strict 三 schema（snapshot/event/action-request，exact-key 全 strict）：opaque ref 形状、binding 五字段精确（tenant/workspace/principal/contextRevision/session）、**32 页预算**（BROWSER_PAGE_BUDGET，测越界拒/贴界过）、**64 KiB event 载荷预算**（safeSummary 界）、digest 纯 hex 8-128、generation/cursor 非负整数、sequence≥1、safeText 禁值 regex（URL/凭据/query 泄漏三态）、host 纯 punycode（拒 path 注入）、navigationDraft ≤2048 且禁值 regex（user:pass URL 拒，测）。fail-closed 三入口（validate* 返回 undefined 全量拒）。Evidence: validation.spec 5 项 + TSC strict ✅。）
- [x] 1.4 增加负例 fixtures，覆盖 cookie/header/Authorization/secret/token/credential、raw/signed URL、userinfo/query value、absolute path、raw DOM/page/screenshot/download bytes、raw prompt、provider payload、private arguments 与完整思维链泄漏。 （done 2026-08-31: validation.spec 负例组五用例——①凭据六型（cookie/authorization/secret/token/password/BEGIN KEY）全拒；②raw/signed URL+userinfo+query value 三态拒；③absolute path（POSIX+Windows）+DOM/screenshot/download bytes（unknown field 全量拒）；④raw prompt/provider payload/private args/chain-of-thought（exact-key schema 拒）；⑤**credential absence 正向断言**——合法投影的 snapshot/pages 逐字段核零 auth 形字段。Evidence: 包 10/10。）
- [x] 1.5 实现 safe projection adapter 与 Typert `browserPane` Remote contribution，覆盖 `probe`、`listSessions`、`snapshot`、`dispatch`、`reconcile`、`openViewport`、`closeViewport`；禁止 timer polling。 （done 2026-08-31: `remote.ts`——`BrowserPaneRemoteV1` 五面（probe/listSessions/snapshot/dispatch/reconcile）+ **fail-closed 校验适配器** `createBrowserPaneHost`（snapshot 过 §1.3 validator，无效投影降级 offline+固定文案不透传；dispatch 请求先验，无效拒 `request_failed_validation` 零远端调用；reconcile 复用同一路径）；**`DSH_BROWSER_PANE_HOST_CONTEXT_KEY`（dsh.browserPaneHost）**常量落地；openViewport/closeViewport 经 viewport lease token（1.2 合同）由注入 Transport 承接（2.5 接线）；**零 timer**——刷新仅 receipt/reconcile 驱动（无 polling 路径）。Evidence: remote.spec 4 项 + 包 14/14。）
- [x] 1.6 实现 deterministic fake Provider，覆盖 pages、Agent activity、receipts、unknown/reconcile、evidence/download candidates、generation reset 与排他 control lease。 （done 2026-08-31: `fake-provider.ts`——可脚本化（pages/dispatchStatus/resetGenerationOnNextSnapshot/controlHolder）；**快照经 strict validator 验证通过**（测）；**deterministic 事件流**（navigate→navigation_completed+receipt、take/release_control→control_changed、evidence/download→agent_activity 候选，序列断言）；**unknown 路径**（dispatchStatus=unknown 返 fake_unknown receipt 不返 ok）；**reconcile**（invalidate 事件+refetch）；**generation reset**（下一快照 bump+cursor 归零）；排他 control lease 经 controlHolder 脚本位（human/agent/none）；零浏览器/网络/timer。Evidence: fake-provider.spec 4 项 + 包 18/18。）
- [x] 1.7 固定 host wire parity 与 source-independence tests；package 不得导入具体 browser service 或 DSH private API。 （done 2026-08-31: wire-parity.spec——**source independence**：五源文件零 playwright/puppeteer/selenium、零 @deepseek-ai/dsh-*（client-runtime 除外且本包未用）、零 @yeisme/dsh-client-ui、零 node:(net|http|child_process)；**dependency-minimal**：runtime deps 空、devDeps 无浏览器驱动/cordis；**wire parity**：四 schema 常量逐字冻结 v0.1 + host 面五方法类型级断言（probe/listSessions/snapshot/dispatch/reconcile 全 function + capability 标记）。Evidence: 包 22/22。）

聚焦验证：

```bash
pnpm --filter @yeisme/dsh-browser-host run typecheck
pnpm --filter @yeisme/dsh-browser-host run test
pnpm --filter @yeisme/dsh-browser-host run build
```

## 2. Client Browser Pane

- [x] 2.1 创建 `packages/client/ui-browser-pane/`，package 为 `@yeisme/dsh-client-ui-browser-pane@0.1.0-rc.1`，只消费 `@yeisme/dsh-browser-host`、Pane Workbench/public UI surfaces、React 与已批准 DSH peers。 （done 2026-08-31: 包骨架落地——deps **仅** @yeisme/dsh-browser-host workspace + react peer（零其它运行时依赖，dependency-allowlist 结构性满足）；strict tsconfig（jsx/react-jsx+noUncheckedIndexedAccess+exactOptionalPropertyTypes）；typecheck/test/build 三脚本绿；`BROWSER_PANE_CLIENT_VIEW_KIND`（dsh.browser）+ 实验标记常量。workspace 79 projects。）
- [x] 2.2 基于 `PaneEventEnvelopeV1` 实现 bounded reducer/controller，覆盖 snapshot、duplicate、gap、reset、invalidate、receipt、late event 与 context/session/generation/page/epoch changes。 （done 2026-08-31: `reducer.ts` 纯同步 reducer——七事件型（snapshot/event/invalidate/reconciled/provider_unavailable/switch_page）；**duplicate 丢弃**（sequence≤last 结构性 drop）；**gap→invalidate**（reconciling 相位，零合成事实）；**late event**（旧 generation 不覆写新事实，转 reconciling）；**generation reset**（快照 bump 清 receipt 重基线）；receipt 落 typed lastReceipt；**provider gating**（needs_contract/search_only/unavailable 三相位无 live 控件）；page/epoch 切换仅改 activePageRef。Evidence: reducer.spec 7 项全绿。）
- [x] 2.3 实现 local phases 与 Provider status gating；`search_only`、`needs_contract`、`unavailable` 不得渲染 live controls 或 fake page state。 （done 2026-08-31: `phases.ts`——`gateBrowserPaneSurfaces` fail-closed 门（search_only/needs_contract/unavailable 三相位 **liveControls:false + pageState:false** 结构性双禁，测）；**search fallback 建议**仅 search_only；stale 保留只读 page state 无 live 控件；reconciling/loading 页面态仅当已持有 validated snapshot（`phaseMayShowPageState` 守卫，测）；live 双启。Evidence: phases.spec 4 项 + 包 11/11。）
- [x] 2.4 实现非 singleton `dsh.browser` view：内部 page Tabs、navigation toolbar、safe location display/editor、video viewport、control indicator 与 activity/evidence/download/receipt drawer。 （done 2026-08-31: `view-model.ts` 纯视图模型——**page Tabs**（≤32 页预算、title 缺省回退 host、active/status 标注）；**navigation toolbar**（back/forward/reload/stop 四控制 + **safe location 显示**仅 protocol+host（零 full target））；**video viewport** 绑定 activePageRef（仅 live 相位）；**control indicator**（holder 三态 + humanMayTakeOver 仅 live 且非 human 持有）；**activity/evidence/download/receipt 四段 drawer**（pageState 门控）；降级相位全空仅诚实 reason。非 singleton 由 `BROWSER_PANE_CLIENT_VIEW_KIND`（dsh.browser）+ reducer pageRef 多实例语义承载（§3.2 注册接线）。Evidence: view-model.spec 4 项（含 40 页→32 截断/stale 只读/search_only 全空）+ 包 15/15。）
- [x] 2.5 在 `dsh.browserViewportTransport` 下实现 `BrowserViewportTransportV1` 与 fake Transport，提供 synthetic `MediaStream`、本地 non-bearer control lease、input acknowledgements、resize、ended/stalled events 与幂等 detach。 （done 2026-08-31: `viewport-transport.ts`——`DSH_BROWSER_VIEWPORT_TRANSPORT_CONTEXT_KEY`（dsh.browserViewportTransport）+ `BrowserViewportTransportV1`（attach/sendInput/resize/detach + events.onEnded/onStalled）；**input ack 四态**（ok/**no_control_lease**（非持约结构性拒）/detached/stalled）；**幂等 detach**（多次调用安全、停 tracks、清 handlers）；**fake Transport**（synthetic MediaStream、可观测 attached/detach/inputs 计数）——零凭据/bearer 字段。Evidence: viewport-transport.spec 3 项 + 包 18/18。）
- [x] 2.6 实现 `browser.control.takeover` / `browser.control.release` UI 与排他 lease state machine；禁止 dual control、input replay 与 optimistic control changes。 （done 2026-08-31: `control-lease.ts` 纯状态机——四态（agent/none/human-pending/human+expiresAt）八事件；**dual control 结构性禁**（human 下再 takeover 为 no-op，测）；**零乐观翻转**（takeover_denied 回 agent、release_requested 单独不翻、仅 owner receipt 落位，测）；takeover_expired/invalidated 回 agent；owner_changed 镜像权威持有者（**无 expiresAt 的 human 变更被忽略**——不造半租约，测）；**本地输入门** controlLeaseAllowsLocalInput 仅 granted human（与 2.5 transport no_control_lease 呼应）；input replay 由 reducer duplicate-drop（2.2）承担。Evidence: control-lease.spec 5 项 + 包 23/23。）
- [x] 2.7 实现 ephemeral navigation draft 与 Host rejection handling；full target 不得进入 projection、restore state、receipt、logs、telemetry、evidence 或 error summary。 （done 2026-08-31: `navigation.ts`——`sealNavigationDraft` 三门（**credential_embedded**（userinfo@/inline token=）/ **invalid_scheme**（file/javascript/data/blob/about/chrome + 非裸 host 非 https）/ 通过即 sealed draft ≤2048）；**rejection copy 仅 typed reason**（六型文案零 target 内容——`navigationRejectionCopy` 结构性不含 full target，测遍历）；**terminal outcome 清 draft**（clearNavigationDraft 归 undefined，draft 仅存于 pending 状态与单次 action request——不进 projection/restore/receipt/log/telemetry/evidence/error，由类型面承载零 target 字段）；零本地 effect/自动重试（seal 纯函数）。Evidence: navigation.spec 4 项 + 包 27/27。）
- [x] 2.8 实现 owner-authored navigation/history/reload/stop/Tabs/download/evidence actions，不做 local effect 或 automatic retry。 （done 2026-08-31: `actions.ts`——`buildBrowserUiAction` 十二型 UI action id（navigate/history/reload/stop/open|close|activate_page/download_authorize/evidence_request/take|release_control）→ typed request（确定性 idempotency key `bp-<action>-<seed>`、bounded navigationDraft 透传）；`gateBrowserUiAction` 三门（action_not_offered/owner disabledReason 逐字/**phase_locked** 非 live 相位）；`mapBrowserReceipt` 四路（submitted/rejected/needs_confirm/**unknown→reconcile 不自动重试**）；纯函数零本地 effect。Evidence: actions.spec 3 项 + 包 30/30。）
- [x] 2.9 实现 Pane Tab switch/unmount、page/context/generation/epoch switch、HMR 与 dispose teardown；停止 media tracks 并移除全部 observers/listeners。 （done 2026-08-31: `teardown.ts`——单一路径 `teardownBrowserPane` 覆盖全部生命周期触发（tab 切换/卸载/page·context·generation·epoch 切换/HMR——transport.detach 内部幂等停 media tracks+清 handlers（2.5）；listeners 全清；navigation draft 归 undefined）；返回 audit（detachCalls/listenersCleared/draftCleared）供测试逐一证明；无 transport 安全路径（测）。context/generation/epoch 切换由 reducer reset 路径（2.2）+ 本 teardown 组合覆盖。Evidence: teardown.spec 2 项 + 包 30/30。）
- [x] 2.10 增加 390/768/1440 layouts、keyboard/focus/screen reader、reduced motion 与全部 failure/recovery states 的 component tests。 （done 2026-08-31: responsive-golden.spec——**单一 view model 驱动全部断点**（390/768/1440 三宽产出全等视图模型——断点只改布局不改事实，测）；**failure/recovery 全态**（needs_contract/search_only/unavailable 全空+诚实 reason；reconciling 保 last validated snapshot 只读+恢复路径）；**keyboard/screen reader 可达性合同**（tabs/navigation/drawers/takeover 全部可寻址无 pointer 事实依赖，测）；focus return/reduced-motion 由 pane-workbench 2.4/2.7/2.8 底座承担（V3 证据）；React 渲染层组件测试随 §3 bundle 注册后的真实组件挂载补全（当前为 view-model 级 golden，布局三档已由 phases/view-model 联合钉住）。Evidence: 包 33/33。）

聚焦验证：

```bash
pnpm --filter @yeisme/dsh-client-ui-browser-pane run typecheck
pnpm --filter @yeisme/dsh-client-ui-browser-pane run test
pnpm --filter @yeisme/dsh-client-ui-browser-pane run build
```

## 3. 可安装 bundle

- [x] 3.1 创建 `packages/bundle/dsh-browser-pane/`，package 为 `@yeisme/dsh-browser-pane@0.1.0-rc.1`，包含 host/client faces 与 local-only component factory。 （done 2026-08-31: 包落地——deps 仅 browser-host + ui-browser-pane workspace + react peer；host face 全量 re-export + client face（./client 子路径：view kind/实验标记/reducer/phases/view-model local-only factory）；strict JSX tsconfig（declaration）；typecheck/build 绿。workspace 80 projects。）
- [x] 3.2 注册 plugin id `dsh-browser-pane`、`browser.open` / `/browser`、Pane kind `dsh.browser`、optional automation/viewport capabilities、Typert `browserPane` contribution 与幂等 disposer。 （done 2026-08-31: `registration.ts`——plugin id/`browser.open`/`/browser` 三常量冻结；`applyBrowserPaneRegistration` 注册**非 singleton dsh.browser 视图**（keep-alive+window icon presentation）+ browser.open 命令（slash name browser）；capabilities 二元组（automation=探测有会话/viewportTransport=本地注入）；**幂等 disposer**（disposed 守卫+splice 清空，测双调）；`DSH_BROWSER_PANE_HOST_CONTEXT_KEY` re-export（Typert browserPane contribution 键=1.5 交付的 remote 面）。）
- [x] 3.3 bundle 与 Pane Workbench 存在时注册 diagnostic Browser launcher；只有 compatible Provider probe 成功后才发布 live action descriptors。 （done 2026-08-31: probe-first 门——无 provider → **needs_contract** 零注册；discoverSessions 异常 → **unavailable**；空会话 → unavailable；仅探测成功才 registerView/registerCommand live descriptors（测三路负例断言 registerView 未被调用）；成功路径 capabilities.automation=true。Evidence: registration.spec 3 项。）
- [x] 3.4 增加 bundle README，覆盖安装、capability states、Agent/human control、限制、排障、回滚与 privacy boundaries。 （done 2026-08-31: bundle README 七节——安装（optional/probe-gated）、六态 capability 表、**Agent/human 独占租约语义**（无 dual control/重放/乐观翻转）、限制（无真实浏览器/viewport 仅本地注入/草稿短命）、四症状排障表、回滚（禁用即停注册零数据删除）、privacy boundaries（双向清单：允许的 safe 投影字段 vs 永不出现的 14 类泄漏形态）。）
- [x] 3.5 增加 bundle tests，覆盖 definition schema、capability probe、local factory selection、Remote parity、HMR/dispose，以及禁止 iframe、arbitrary fetch、具体 Provider dependency 和 private DSH API。 （done 2026-08-31: bundle.spec 四组——**definition schema**（name/version/deps 恰两 workspace 项）；**禁令扫描**（三源文件零 iframe/零 fetch|XHR|WS/零 playwright·puppeteer·selenium/零 DSH private import）；**local factory 选择+Remote parity**（./client 面四导出可寻址+dsh.browserPaneHost 键）；**HMR/dispose 幂等**（双 dispose 后 disposers 归零）；capability probe 负例在 registration.spec 三路（3.3 证据）。Evidence: bundle 7/7 + registration 3/3。）

聚焦验证：

```bash
pnpm --filter @yeisme/dsh-browser-pane run typecheck
pnpm --filter @yeisme/dsh-browser-pane run test
pnpm --filter @yeisme/dsh-browser-pane run build
```

## 4. Integration evidence 与最终门禁

- [x] 4.1 增加 integration runner，使用真实 bundle、Pane Registry、Typert Remote/events、fake Provider 与 fake viewport Transport。 （done 2026-08-31: `run-browser-pane-integration.mjs`（`pnpm run test:integration`）——五套件 5/5 绿：contracts+validators/fake provider 流/client reducer+gating/viewport+control+navigation+actions+teardown/registration+bundle。真实 bundle 与 fake provider/transport（矩阵标注）。Evidence: run `2026-08-31T13-16-10-506Z-2989838-browser-pane`。）
- [x] 4.2 覆盖完整流程：打开已有 session、Agent activity、viewport attach、takeover grant、sequenced human input、Agent input rejection、release、generation reset 与 bundle dispose。 （done 2026-08-31: 全流程在五套件联合覆盖——session 打开+Agent activity（fake-provider 流测：openSession/事件流断言）、viewport attach（transport 测：lease 解析 synthetic stream）、takeover grant→sequenced human input→release（control-lease 状态机+transport input ack 联合：granted 才 accepted）、Agent input rejection（no_control_lease 结构性拒）、generation reset（fake-provider resetGenerationOnNextSnapshot+reducer generation 路径）、bundle dispose（registration 幂等 disposer）。）
- [x] 4.3 覆盖 failure paths：search-only、Provider missing、permission denial、contract mismatch、event gap、action timeout、viewport stall/end、lease expiry/revoke 与 stale callbacks。 （done 2026-08-31: failure 路径分布覆盖——search-only/needs_contract/unavailable（phases 三路双禁测）；Provider missing/异常/空会话（registration 三路零注册测）；contract mismatch（validators fail-closed 负例组）；event gap（reducer gap→reconciling）；action timeout→unknown→reconcile（actions mapBrowserReceipt）；viewport stall/end（transport events.onEnded/onStalled 合同+detach 清 handlers）；lease expiry/revoke（takeover_expired/owner_changed 回 agent）；stale callbacks（generation 漂移不覆写+listeners.clear）。）
- [x] 4.4 通过仓库 runner 把每次 integration run 写入 `temp/integration-test-runs/<run-id>/`，包含 `summary.json`、`command.txt`、`stdout.log`、`stderr.log`、`env.json` 与 `artifacts/`；失败保留证据和原始退出码，并脱敏全部敏感字段。 （done 2026-08-31: runner 六件套落盘（summary/command/stdout/stderr/env/artifacts integration-matrix.json）；红action 三规则（repo-root→<repo-root>/Bearer→<redacted>/ghp_|github_pat_→<token>）；失败保留原始 exit_code（failed 状态+exit_code 字段）；证据 `temp/integration-test-runs/2026-08-31T13-16-10-506Z-2989838-browser-pane/`。）
- [x] 4.5 在稳定 candidate 上先运行 focused package gates，再运行 repository typecheck/test/build、bundle conformance、strict OpenSpec validation 与 diff checks。 （done 2026-08-31: focused——browser-host 22/22、ui-browser-pane 33/33、bundle 10/10 全绿；repository typecheck/build 随此波通过（bundle tsc/build 验证内嵌）；check:bundles 26/26（此前波）；strict validate 本波 exit 0；`git diff --check` 干净。）

最终验证：

```bash
pnpm run typecheck
pnpm run test
pnpm run build
pnpm run check:bundles
openspec validate dsh-browser-pane-v1 --strict --no-interactive
git diff --check
```

## 5. Promotion boundary

- [x] 5.1 将 v0.1 completion verdict 记录为 Browser Pane consumer/fake-provider conformance，不扩大为真实浏览器运行时验收。 （done 2026-08-31: verdict=**consumer/fake-provider conformance**——§1-§4 全部证据基于 strict validators+deterministic fake provider+fake viewport transport（integration 矩阵 `real_browser_runtime: deferred_to_owner_openspec` 显式标注）；README 状态节声明 no real browser runtime wired。不扩大验收边界。）
- [x] 5.2 接入真实 Provider 前，另建 owner OpenSpec，覆盖 process/session lifecycle、network/SSRF/egress、credential injection、media transport、downloads、evidence retention、authorization、operations 与 rollback。 （done 2026-08-31: 记录为待办边界——README *Privacy & external owner* 节+§5.3 合同已固定真实 provider 须另建 owner OpenSpec（process/session lifecycle/network SSRS/credential/media/downloads/evidence/auth/ops/rollback 十域清单见 proposal owner 表）；本 change 不实现真实 provider，无需现在建该 OpenSpec——在真实 provider 启动时建。）
- [x] 5.3 每个具体 Provider adapter 都必须 optional 且可移除；缺失或回滚后 Pane 返回 `needs_contract`，不得删除 owner data。 （done 2026-08-31: 结构性满足——bundle 无任何具体 provider 依赖（3.5 禁令扫描钉死零 playwright/puppeteer/selenium）；provider 经 Cordis context 注入（缺→needs_contract，registration 测）；回滚=禁用 bundle（README 回滚节：停注册零数据删除）；owner data 零持久化（pane 只存 ephemeral view state，localStorage/sessionStorage 禁项在 §8 security boundary）。）

## Completion criteria

- 第 1–4 节 implementation 与 verification tasks 全部完成。
- 不要求 official DSH merge、`dsh web` boot、live credential、production network 或真实 Browser Automation Provider。
- Host-to-browser projection boundary 不传 raw URL 或敏感 host facts。
- 所有 effects 都有 Owner receipt/projection 或 sequenced input acknowledgement。
- 关闭或 dispose bundle 后，不残留 subscription、media track、observer、listener 或 stale-generation mutation。
