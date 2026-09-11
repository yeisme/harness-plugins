## 2026-09-11 末: sonora 1.1/1.2 合同冻结 + 遗漏注记补齐（c1e48ed 已推）

- dsh-sonora-audio-studio-v1 0→2/15：1.1 owner HEAD 2c59817 合同复检（相对 09-08 基线零变更、七面 digest、未跟踪 workspace.go 在途排除）；1.2 consumer/UI Contract 冻结核对（脚手架复用实证）。2.x/5.x 实现任务留 studio lane owner（ui-creator-studio 是其实现面——此前会话已建 auctra/eikona 组件）。
- ecosystem 2.2/3.1/3.2、productivity 3.2/3.3 补当日注记。至此全部活跃 change 的开任务都有当日处置：url-session 22/23、sonora 2/15、19+7 外部门注记、其余并行/用户/owner 门。
## 2026-09-11 午后: spec 推进波——url-session 5/23→22/23 + 全仓外部门 rc.2 复检（本会话）

- `dsh-url-session-v1` 三提交（e86a6eb/48f914d/884eb42，已推）：§3 客户端接线（sessions seam adapter+probe、History push/replace/popstate 反向、缺失空态 embed conversation.input.dock、会话头部复制/新标签 Menu、query-alias 夹具）；§4 bundle 转发+README；§5 upstream-prs/frontend-static-history-fallback（Config 开关默认 false+serveStatic shouldFallback+web-app 前传，矩阵 7/7，staging 管道幂等接入）；§6 upstream-prs/url-session-web-resume（--resume flag+resumeUrlSuffix，链式 12/12）+ /yeisme-url 命令（host yeisme-commands，Agent.id 即 SessionId，webServer probe）+ pane-protocol ArtifactRefV1 可选 sessionUrl（窄豁免 inspectSafeJson）；§7 门（7.3 按 acceptance 留开：staging session 首帧格式漂移无法建 live 证据）。
- 外部门复检：npm next 前移 0.1.5-rc.2（temp/alpha-grep-0911 六包）；dsh-terminal rc.2 首现官方 interactive PTY backend API（行式 send/read/signal，无 raw VT/resize/duplex）——terminal-parity-audit 补 rc.2 节；其余 seam 全 0 命中；19 任务注记。dogfood 第 11/14 天（六检查器 0 findings）。
- 坑：ui-url-session 包加 React 后 katex css 三处都要 inline/neverBundle（vitest server.deps.inline + 两级 tsdown）；官方 Menu 的 disabled 是原生属性不是 aria-disabled、Button 不收 ref（用 span/vk-btn button 包）；@deepseek-ai/schemastery z.string().optional() 不存在（非 required 即可选）；pane-protocol inspectSafeJson 全量拒 http(s) 字符串——加安全 URL 字段必须窄豁免；上游 staging 系列 chained patch 要先 reset 再按序 apply 生成；Bash cwd 每调用重置（用 git -C/绝对路径）。
## 2026-09-11: dsh-explorer-live-watch-v1 — 目录树 live watch 落地（本会话）

- 用户确认推翻 09-09「等上游 fs-watch」注记，owner 侧交付真实 watch：`watch-registry.ts`（chokidar@^4 新依赖，按 workspace realpath 引用计数、`OpaqueFileRefRegistry.mint` 确定性铸造 ref、registry 生命周期单调 sequence 跨 watcher 重启不回退、每 generation 512 环形缓冲、恒忽略 .git——gitignore 命中路径照发因树以 ignored 标志列出）+ `fs.watch.streamV1` SSE（唯一 GET 方法、sessionId query fence、cursor/since 重放/15s 心跳/close→release）+ 浏览器 host `watch()`（懒单例 EventSource、形状校验丢弃、error 以最新 cursor 受管重连、末位退订 close）+ apply.ts runtime 广告 `fileWatch` + explorer 头部活度徽标（data-file-watch=live/ondemand）与「刷新」按钮（视图级 reconcile_apply 重读）。
- 验证：file-host 67/67、desktop-workbench 61/61、pane-workbench 本 lane 绿、六检查器 PASS、bundles 29/29、dsh:workbench --check、pane-menus visual 5/5。真机：真实 webServer 403 fence 两验；完整浏览器 live 目视留 dogfood（session 首帧 header 格式漂移：官方 loader 对旧 session 报 corrupt zstd——上游问题，默认 home boot 也被它崩掉）。
- **reveal-in-tree 未做**：会话中途发现并行 search-center lane 已落地完整链路（reveal-channel/reveal-navigation + runtime.revealResource 绑 fs.revealV2 + tree-ui 消费 + revealExplorerResource 面），change spec/tasks 已如实撤销该项防双实现。**先查 git status/diff 再立任务，并行 lane 可能已做完。**

### 坑
- 桌面 bundle 消费 node-only 新导出必须重 build dsh-file-host（desktop-workbench 对着 lib/types typecheck）；再下游（ui-pane-workbench 的并行 search 类型）也可能要先 build 其 lib 才 typecheck 得过——按依赖顺序补 build 即可解。
- EventSource 自带重连会用旧 since 重放产生重复：必须 onerror → close → 以最新 cursor 主动重开。
- 树列表以 ignored 标志**列出** gitignored 条目——「树看得见」≠「未忽略」，watch ignore 集只排除 .git 才与列表一致。
- ui-pane-workbench/visual 直接 `playwright test` 不起 fixture 服务器（invalid URL）：用 `pnpm run test:visual -- visual-<name>.spec.ts`（runner 支持 spec 文件名过滤）。
- 并行 lane 遗留红（非本 lane）：dsh-projection.spec（dsh-session rc.6 × dsh-llm rc.1 多实例 CallId 运行时导出缺失）、region-chrome（其 chrome/shared.ts 在途）。
## 2026-09-10: dsh-file-preview-dispatch-v1 — per-file 预览分派面落地（本会话）

- OpenSpec change `dsh-file-preview-dispatch-v1` 全任务勾选（strict valid）：新内容视图 `desktop.preview`（singleton:false，每文件一 Tab）+ `FilePreviewDispatchPane`（ui-desktop-workbench）接通 rich-media 预览平台 registry（首个生产消费者）；openFile 路由改为 classify：text/image 留 `desktop.file`，audio/video/pdf/table/document/archive/binary/未知二进制全部进 `desktop.preview`（hex 兜底取代「二进制文件不支持文本预览」死路）。
- rich-media：format-kinds 增音视频（mkv/flac/opus/…）与归档（zip/jar/tar/gz/7z/rar）行；新渲染器 `yeisme:audio/video`（MediaPlaybackRenderer+allowBlobUrl）、`yeisme:archive`（zip 中央目录 ranged 读取，locateZipEocd/parseZipCentralDirectory 新 additive API）、`yeisme:binary-hex`（256B hex，family 阶段 priority 140 压过 archive 的 130；zip 仍走 exact 阶段命中 archive）。媒体库回归纯库 + 侧栏「媒体」按钮（补 dsh-web-render-preview 冻结 Requirement 的实现缺口）。explorer 树行按扩展出 image/audio/video/pdf/archive/code/document 图标（presentation-only）。
- 验证：四包 typecheck/test/build 绿（rich-media 187、ui-desktop-workbench 72、desktop-workbench 45、pane-workbench explorer 全绿）；check:bundles 29/29；dsh:workbench --check 通过；openspec 166/166。

### 跨 lane 事故与修复（重要）

- 本会话误用 `git stash` 做归因实验，把并行会话 397 文件 in-flight 波全部卷入 stash；pop 被 pnpm-lock 冲突挡住后恢复（保新 lockfile），但 92 个 tracked 文件（ui/host/bundle 的 token-usage + selection-annotation 全套）从工作树丢失（` D`），导致 surface 门「unclassified」、visual 服务器 ENOENT 崩溃、78 fixture boot 失败。经 `git checkout --` 从 HEAD 恢复 + 补建两个新包 surface 分类/dynamicStyle allowlist + 补 build 后：visual 90/126（剩 36 全是并行 lane fixture boot：selection-actions 27 + tools 9）、check:plugins 只剩 dsh-context SAFEPROJ 2 findings（并行 lane 未跟踪 fork 包）。**教训：共享仓有活跃并行会话时绝不用 stash；归因用 worktree。**
- 并行 lane 依赖图混杂（dsh-session 19 实例、dsh-llm 10 实例）：dsh-session@rc.6 × dsh-llm@rc.1 组合运行时缺 `CallId` 导出 → ui-pane-workbench dsh-projection.spec 失败 + rich-media media-node.tsx 类型崩（SessionEventMap 增强跨实例失效）。media-node 已本地加宽（narrowMediaRefEvent 判别联合，运行时不变）；dsh-projection.spec 留给并行 lane 对齐版本后自愈。
## 2026-09-07 PM: spec advance — in-flight wave committed, tools-location 7/8, followups 2/4, url-session codec, seven studio changes authored

- In-flight 138-file wave committed as 9 units (archives x4 → specs; workbench retirement + canvas program; url-session protocol; creative workspace impl; search owner wiring; browser pane view split; tools-location design; G21 day7; katex vitest fix). Tree clean after.
- Archived `dsh-session-tools-workspace-v2`: MODIFIED block had to re-include legacy scenarios (宽容器正常目录/中窄容器) by name with V2 semantics — openspec 1.6.0 MODIFIED drops unnamed scenarios.
- `dsh-tools-location-command-ux-v1` 2/8→7/8: consume official `ToolResultNode.callView` (presentation vocabulary in @deepseek-ai/dsh-tools) as owner safe summary (title/description/kind/locations only; rawInput/diffs/cwd never projected); reveal lifecycle marker (success replaces, failure keeps details + reason) in shared viewState `revealedCall`; 3.3 main-thread serial integration stays open.
- `dsh-pane-workspace-followups-v1` 1/4→2/4: real SemanticFileEditor two-pane unsaved-body independence + remount no-swap/no-leak/save-own-entry tests (editor.spec 5/5; evidence editor-renderer-independence-2026-09-07T16-52-07). 1.1 watch/gap、1.2 dirty-conflict 仍开。
- `dsh-url-session-v1` 3/23→5/23: new `packages/client/ui-url-session` codec package (path>query, /s/ strict single segment, percent-decode once, file:// empty-host normalize, builder throws on userinfo/invalid id) 33/33; surface catalog classified excluded (codec-only until §3 UI).
- Authored 7 creative-studio program changes (eikona/anatomia/scaena/auctra/sonora studios + creative-workflow + cross-owner-journeys) from dsh-creative-studio-contracts.md + program doc; all strict-valid; `openspec validate --all` 160/160 (was 153/7 skeletons). Skeleton dirs only had .openspec.yaml.
- External recheck 09-07: upstream published 0.1.3-alpha.2 (five key tarballs grep: GitTypedActions/rendition/PreviewResource/ArtifactRef/standingFactsFor/mcp-inventory/fs-watch all 0 hits); apiproxy next still 0.1.1-rc.2; @yeisme/dsh-agent-composition-preview still 404 → 14 gated tasks re-annotated.
- Fixes: dsh-mcp-inspector vitest inline katex css (ui-primitives Menu import); file-host `authorization` field → `revealGrant` (safe-projection-audit exact-match sensitive names); .gitattributes for migration snapshots + upstream-prs patches (whitespace=-trailing-space).
- Gates: typecheck 0, full test green, check:plugins 6/6 zero findings, check:bundles 27/27, test:visual 106/106 (tools 360/560/960+200%).

# harness-plugins memory

## 2026-09-07: parallel subagent advance (search owner + G21 day 7 + seam recheck)

- Dispatch: 3 children, parallel, no overlapping write leases. Root integrated; no commit/push.
- Search 3.7: wired current-profile `ctx.sessions.list` as `PaneConversationSearchHostV1` (`packages/client/ui-pane-workbench/src/conversation-search-host.ts` + `client.ts` inject, owner-provided host wins). Empty list = available+empty; missing seam = unavailable. Vitest 399/399 + typecheck green. 3.7 stays `[ ]` (`live_query=not_verified`, `mock_query=verified`). Evidence `temp/integration-test-runs/workspace-search-conversation-owner-2026-09-07T04-23-26-839Z-2293966/`. Host-chain not re-run.
- G21 4.3: day 7/14 recorded. `pnpm run check:plugins` exit 0, six checkers 0 findings (`temp/toolchain-runs/2026-09-07T040407631Z-toolchain`). Interactive `pnpm dsh:dev` not observed in-session. Checkbox still `[ ]` until 2026-09-14.
- External recheck: local installed `@deepseek-ai/*` still 0.1.2-rc.1; awaited seams still 0 hits. Explorer could not live-fetch npm/upstream HEAD. 14 remaining active changes still external/user-gated. Do not treat current-profile session list as long-term history.

## 2026-09-06 PM: spec goal session — search 5.2–5.5, two closes, external rechecks

- `dsh-workspace-search-experience-v1` 20→24/25: 5.2–5.5 done. New host-chain runner `scripts/run-workspace-search-host-chain.mjs` (self-boots official dsh web profile + 32 bundles, 13/13 checks incl. identity-across-filter, honest unavailable history, singleton relaunch, theme tokens). Six gates green (surfaces/visual 92/plugins 0 findings/typecheck/build/bundles 27/27). Delivery doc `docs/delivery/dsh-workspace-search-experience-2026-09-06.md` + Agent Note `.agents/notes/proposed/architecture/2026-09-06-workspace-search-experience.md`. Only 3.7 (live history owner) stays open.
- Unified-host search entry implemented: `workspace.search` launcher command + `isUnifiedHostCatalogView` (search pane registers in host catalog because the unified host resolves renderers through its catalog; file-preview stays out). Commit d9ca1df.
- Closed `dsh-tools-pane-migration` + `dsh-full-plugin-ui-acceptance` with per-requirement tasks.md evidence and archived (strict 140/140). Patch verify for remove-plugins-settings re-run green (run 2026-09-06T16-09-15).
- run-web-plugin-acceptance.mjs: optional capability-probe 404s (`/api/*/capabilities`) now classified as `unavailable_owner_services`, not browser errors — the 07:23 token-usage pane's honest probe was failing the boot gate.
- External rechecks 2026-09-06: upstream released 0.1.3-alpha.1 (HEAD `d347e70390`, 9,080 paths) but every awaited seam still 0 hits; npm next 0.1.2-rc.1, host-apiproxy 0.1.1-rc.2, @yeisme trio 404. 43 tasks annotated. Dogfood day 6/14 recorded (zero findings).
- Remaining 15 active changes: all open tasks are external-gated (upstream seams/npm/PAT) or the 09-14 dogfood window; none actionable in-repo without owners moving.
- Pitfall: profile resolves bundles through `packages/bundle/*/lib` (bundle build inlines client code) — rebuilding only `packages/client/*` does NOT reach the booted host; rebuild the bundle layer too.

## 2026-09-06: archive completed DSH changes + workspace search 2.7

- Archived Complete changes (specs synced, `--all --strict` 140/0): `dsh-session-insights-and-status`, `dsh-web-composer-references-theme-v1`, `dsh-selection-conversation-actions-v1`, `dsh-adaptive-pane-docking`, `dsh-unified-multi-pane-workbench`.
- Left active: `dsh-tools-pane-migration` and `dsh-full-plugin-ui-acceptance` (No tasks.md; implementation exists but no checkbox closeout). Remaining incomplete changes are mostly `[external-gate skipped]`.
- Advanced `dsh-workspace-search-experience-v1` 19→20/25: task 2.7 stage-A evidence. Overlay now injects `REGION_STYLES` via `.pwr-root`. History owner still missing; 3.7 stays open (`live_query=not_verified`). Evidence `temp/integration-test-runs/workspace-search-stage-a-2026-09-06T10-05-35-478Z-1677358/`.
- Still open on search: 3.7 live history, 5.2 Playwright host chain, 5.3 surfaces/visual/plugins, 5.4 upstream-prs, 5.5 delivery packet.

## Active change: dsh-session-insights-and-status

- Kimi session `session_d053cb5b-1d96-4c73-b883-5253da6b240e` implemented tasks 1.1–4.3, then hit a 5-hour provider quota on 4.4/4.5.
- 2026-09-05 closeout: 4.4/4.5 recorded. Protocol gates (typecheck/test/build/check:bundles/check:surfaces/check:plugins + OpenSpec strict) passed. `pnpm run test:visual` 27 failures in concurrent dirty `visual.spec.ts` fixtures were classified concurrent+environmental; owned `visual-status.spec.ts` 17/17 passed.
- Evidence: `temp/integration-test-runs/full-plugins-2026-09-05T18-51-57-898Z-1270300/` and `temp/integration-test-runs/ui-visual-2026-09-05T18-20-23-203Z-462829/`.
- Unverified owners remain: `upstream-prs/session-history-usage-identity/` and `upstream-prs/session-trajectory-locator/`. Do not claim full-session usage is verified on real DSH.

## Constraints

- Do not treat repo-wide visual snapshot drift on concurrent dirty packages as an introduced failure of this change.
- Do not update unrelated visual baselines to green a global `test:visual` run.
- Additive query schema `session.insights.snapshot.v1alpha1`; keep `snapshot()` / `refreshBalance()` signatures.

## 2026-09-07: vendor dsh-pentest (pentest-mode tab plugin) + tab-development guide

- Vendored upstream `howmp/dsh-pentest` @ `5d24ba7` (MIT, v0.1.0-rc.26) as self-contained bundle `packages/bundle/dsh-pentest/` (release shape: `lib/` prebuilt + `preset/` + patch; excluded upstream per-package build outputs / lockfile / process docs). Provenance + upgrade flow: `packages/bundle/dsh-pentest/YEISME-VENDORED.md`. User web profile install verified (`--dump-config` rows + boot smoke errors=0).
- Vendored-bundle carve-outs now first-class: `.gitignore` negation keeps the pinned `lib/` in git (no local build); declaration-lint treats any bundle dir with `YEISME-VENDORED.md` as record-only (upstream patches legally use full cordis grammar: id-override rows without `name`, multiple top-level inserts — the repo-converged parser fail-louds on them otherwise). Regression tests in `declaration-lint.spec.ts` (26/26 toolchain suite green).
- New extraction doc `docs/plugin-tab-development.md`: tab/pane/overlay seam selection, two package shapes, host four registration points (tools / systemPrompt.section / sessionProjections / storageDomain), per-session `conversation.view` tab pattern (sessions.list ancestry + cycle guard), pane + honest-degradation pattern (capability probe + disabledReason), visualization window-view rules, preset-root registration. Skill source: root `.skills/yeisme/project-development/dsh-tab-plugin-development/` (target: `agent/harness-plugins.txt`, synced).
- Constraint: do not rename the vendored package or rewrite its patch into the repo-converged grammar — byte-fidelity vs upstream is the upgrade mechanism; changes go through the YEISME-VENDORED.md upgrade flow instead.
