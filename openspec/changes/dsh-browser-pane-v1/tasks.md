## 0. 规格冻结

- [x] 0.1 将能力归类为 `split-owner`，冻结 Harness Plugins、Browser Automation Owner 与 DSH Core 的职责。
- [x] 0.2 冻结 package paths、公开 identifiers、`browser.open` discovery、optional capabilities、Pane registration、data budgets 与 additive `0.1.0-rc.1` 兼容策略。
- [x] 0.3 冻结 Agent observe → human takeover → human input → release 流程、排他 control lease、viewport attachment 与 failure matrix。
- [x] 0.4 完成终稿编辑后，通过 strict OpenSpec validation 与文档 diff checks。

## 1. Host contract 与 fake Provider

- [x] 1.1 创建 `packages/host/dsh-browser-host/`，package 为 `@yeisme/dsh-browser-host@0.1.0-rc.1`，配置 strict ESM typecheck/test/build scripts 与 experimental API markers。 （done 2026-08-31: 包骨架落地——strict tsconfig（noUncheckedIndexedAccess/exactOptionalPropertyTypes/verbatimModuleSyntax）、typecheck/test/build 三脚本、tsdown ESM 输出、`BROWSER_PANE_EXPERIMENTAL_API` v0.1 实验标记常量；TSC ✅/build ✅/test 骨架就绪（1.4 负例起填充）。lockfile 已同步（78 projects）。）
- [ ] 1.2 实现 `BrowserAutomationProviderV1`、`BrowserPaneHostV1`、`dsh.browserPaneHost`、binding/probe/session-discovery/snapshot/reconcile types、`BrowserViewportLeaseV1`、`BrowserControlLeaseV1` 与 typed input/ack types。
- [ ] 1.3 为 exact context/provider/session/version/digest/generation/page/epoch binding、64 KiB event payload 与 domain collection budgets 实现 strict validators。
- [ ] 1.4 增加负例 fixtures，覆盖 cookie/header/Authorization/secret/token/credential、raw/signed URL、userinfo/query value、absolute path、raw DOM/page/screenshot/download bytes、raw prompt、provider payload、private arguments 与完整思维链泄漏。
- [ ] 1.5 实现 safe projection adapter 与 Typert `browserPane` Remote/event contribution，覆盖 `probe`、`listSessions`、`snapshot`、`dispatch`、`reconcile`、`openViewport`、`closeViewport`；禁止 timer polling。
- [ ] 1.6 实现 deterministic fake Provider，覆盖 pages、Agent activity、receipts、unknown/reconcile、evidence/download candidates、generation reset 与排他 control lease。
- [ ] 1.7 固定 host wire parity 与 source-independence tests；package 不得导入具体 browser service 或 DSH private API。

聚焦验证：

```bash
pnpm --filter @yeisme/dsh-browser-host run typecheck
pnpm --filter @yeisme/dsh-browser-host run test
pnpm --filter @yeisme/dsh-browser-host run build
```

## 2. Client Browser Pane

- [ ] 2.1 创建 `packages/client/ui-browser-pane/`，package 为 `@yeisme/dsh-client-ui-browser-pane@0.1.0-rc.1`，只消费 `@yeisme/dsh-browser-host`、Pane Workbench/public UI surfaces、React 与已批准 DSH peers。
- [ ] 2.2 基于 `PaneEventEnvelopeV1` 实现 bounded reducer/controller，覆盖 snapshot、duplicate、gap、reset、invalidate、receipt、late event 与 context/session/generation/page/epoch changes。
- [ ] 2.3 实现 local phases 与 Provider status gating；`search_only`、`needs_contract`、`unavailable` 不得渲染 live controls 或 fake page state。
- [ ] 2.4 实现非 singleton `dsh.browser` view：内部 page Tabs、navigation toolbar、safe location display/editor、video viewport、control indicator 与 activity/evidence/download/receipt drawer。
- [ ] 2.5 在 `dsh.browserViewportTransport` 下实现 `BrowserViewportTransportV1` 与 fake Transport，提供 synthetic `MediaStream`、本地 non-bearer control lease、input acknowledgements、resize、ended/stalled events 与幂等 detach。
- [ ] 2.6 实现 `browser.control.takeover` / `browser.control.release` UI 与排他 lease state machine；禁止 dual control、input replay 与 optimistic control changes。
- [ ] 2.7 实现 ephemeral navigation draft 与 Host rejection handling；full target 不得进入 projection、restore state、receipt、logs、telemetry、evidence 或 error summary。
- [ ] 2.8 实现 owner-authored navigation/history/reload/stop/Tabs/download/evidence actions，不做 local effect 或 automatic retry。
- [ ] 2.9 实现 Pane Tab switch/unmount、page/context/generation/epoch switch、HMR 与 dispose teardown；停止 media tracks 并移除全部 observers/listeners。
- [ ] 2.10 增加 390/768/1440 layouts、keyboard/focus/screen reader、reduced motion 与全部 failure/recovery states 的 component tests。

聚焦验证：

```bash
pnpm --filter @yeisme/dsh-client-ui-browser-pane run typecheck
pnpm --filter @yeisme/dsh-client-ui-browser-pane run test
pnpm --filter @yeisme/dsh-client-ui-browser-pane run build
```

## 3. 可安装 bundle

- [ ] 3.1 创建 `packages/bundle/dsh-browser-pane/`，package 为 `@yeisme/dsh-browser-pane@0.1.0-rc.1`，包含 host/client faces 与 local-only component factory。
- [ ] 3.2 注册 plugin id `dsh-browser-pane`、`browser.open` / `/browser`、Pane kind `dsh.browser`、optional automation/viewport capabilities、Typert `browserPane` contribution 与幂等 disposer。
- [ ] 3.3 bundle 与 Pane Workbench 存在时注册 diagnostic Browser launcher；只有 compatible Provider probe 成功后才发布 live action descriptors。
- [ ] 3.4 增加 bundle README，覆盖安装、capability states、Agent/human control、限制、排障、回滚与 privacy boundaries。
- [ ] 3.5 增加 bundle tests，覆盖 definition schema、capability probe、local factory selection、Remote parity、HMR/dispose，以及禁止 iframe、arbitrary fetch、具体 Provider dependency 和 private DSH API。

聚焦验证：

```bash
pnpm --filter @yeisme/dsh-browser-pane run typecheck
pnpm --filter @yeisme/dsh-browser-pane run test
pnpm --filter @yeisme/dsh-browser-pane run build
```

## 4. Integration evidence 与最终门禁

- [ ] 4.1 增加 integration runner，使用真实 bundle、Pane Registry、Typert Remote/events、fake Provider 与 fake viewport Transport。
- [ ] 4.2 覆盖完整流程：打开已有 session、Agent activity、viewport attach、takeover grant、sequenced human input、Agent input rejection、release、generation reset 与 bundle dispose。
- [ ] 4.3 覆盖 failure paths：search-only、Provider missing、permission denial、contract mismatch、event gap、action timeout、viewport stall/end、lease expiry/revoke 与 stale callbacks。
- [ ] 4.4 通过仓库 runner 把每次 integration run 写入 `temp/integration-test-runs/<run-id>/`，包含 `summary.json`、`command.txt`、`stdout.log`、`stderr.log`、`env.json` 与 `artifacts/`；失败保留证据和原始退出码，并脱敏全部敏感字段。
- [ ] 4.5 在稳定 candidate 上先运行 focused package gates，再运行 repository typecheck/test/build、bundle conformance、strict OpenSpec validation 与 diff checks。

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

- [ ] 5.1 将 v0.1 completion verdict 记录为 Browser Pane consumer/fake-provider conformance，不扩大为真实浏览器运行时验收。
- [ ] 5.2 接入真实 Provider 前，另建 owner OpenSpec，覆盖 process/session lifecycle、network/SSRF/egress、credential injection、media transport、downloads、evidence retention、authorization、operations 与 rollback。
- [ ] 5.3 每个具体 Provider adapter 都必须 optional 且可移除；缺失或回滚后 Pane 返回 `needs_contract`，不得删除 owner data。

## Completion criteria

- 第 1–4 节 implementation 与 verification tasks 全部完成。
- 不要求 official DSH merge、`dsh web` boot、live credential、production network 或真实 Browser Automation Provider。
- Host-to-browser projection boundary 不传 raw URL 或敏感 host facts。
- 所有 effects 都有 Owner receipt/projection 或 sequenced input acknowledgement。
- 关闭或 dispose bundle 后，不残留 subscription、media track、observer、listener 或 stale-generation mutation。
