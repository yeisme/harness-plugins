## 1. Shared core 与兼容合同

- [x] 1.1 在 `command-experience-core` 增加 TUI 可复用的 `CommandDraftV1`、command detail、context ranking 与纯 key intents；现有 descriptor/reducer exports 保持兼容。
- [x] 1.2 为完整 P0 catalog 增加 TUI contract test：canonical、aliases、owner、actionKind、danger、coverage、availability、disabled/not-applicable reason 均不漂移。
- [x] 1.3 定义 additive `TuiCommandShellStateV1`、logical events、side-effect commands 与 frame/Inspector model；raw args 不进入持久化类型。
- [x] 1.4 定义 optional `TuiResultRendererContributionV1` 与 strict bounded projection schema；unknown/credential/path/URL 拒绝测试。

## 2. Pure update/render 与布局

- [x] 2.1 实现纯 `update(state,event)`，覆盖 conversation、assist、center、argument、selector、confirm、destructive、dispatching、receipt、inspector 与 session reset。
- [x] 2.2 实现纯 `render(state,width,height)`，覆盖 wide/standard/compact/minimal、Unicode/ASCII、color/no-color 与 CJK cell width。
- [x] 2.3 补 120×36、80×24、60×20、50×12 golden frames；resize 往返不丢 draft、selection、receipt、scroll anchor。
- [x] 2.4 保持插件不读 stdin、不切 raw/alternate screen、不捕获 signal；lifecycle 只通过官方宿主 seam。

## 3. Slash Assist、Command Center 与详情

- [x] 3.1 实现 input-anchored `/` assist 与 `:` migration hint，按 viewport 限 8/6/4/3 行，首次 discovery no-RPC。
- [x] 3.2 实现 `Ctrl+K` Command Center，Commands/Recent/Status 三页、query/category、Left/Right、focus return 与原 draft 恢复。
- [x] 3.3 实现 command detail：aliases、input、owner、danger、coverage、availability reason、expected presentation；detail 不含 handler/private data。
- [x] 3.4 将 `/help [command]` 与 `/commands` 接到同一 Command Center/detail projection，不创建静态第二目录。

## 4. 参数、选择器与风险确认

- [x] 4.1 实现 canonical command token、single-line argument editor、owner-safe selector 与逐层 Escape；raw args/session refs按 scope 清理。
- [x] 4.2 完成 `/session` selector → switch/rename/archive/restore action menu，与 `/resume`、`/agent` selector 同源。
- [x] 4.3 实现 safe/confirm/destructive：confirm 默认 Cancel + explicit `y`/focus；destructive typed owner phrase；裸 Enter 不确认 non-safe。
- [x] 4.4 覆盖 stale/unknown/permission-denied/preview-missing/receipt-unavailable fail-closed 与 settlement unknown 不自动 retry。

## 5. Receipt、Activity 与 Inspector

- [x] 5.1 实现 receipt lane：pending 防重复、success tick/next-input 折叠、failed/partial/stale/rejected 保持和 safe recovery action。
- [x] 5.2 实现 Recent Activity，从 current session `command/run|done` 恢复最多 20 条，canonical correlation 与 pending/unknown 对账。
- [x] 5.3 实现 Inspector renderer registry与 bounded safe-text fallback；wide right detail、standard fullscreen、compact pagination。
- [x] 5.4 验证 command result 不写入模型 transcript，raw prompt/provider payload/private args 不进入 frame、Activity 或 renderer fixture。

## 6. Session statusline 与 `/status`

- [x] 6.1 复用 `session.status.snapshot.v1alpha1` parser/view model；若 sibling status package 未 ready则 unavailable，不做 ledger 推算。
- [x] 6.2 实现 wide/standard/compact/minimal statusline，lifecycle 优先、context threshold、no-color/ASCII 与 screen-reader line model。
- [x] 6.3 实现 `/status` Inspector：runtime/context/最多 4 limits/freshness/source/next actions，并保持与 statusline 同 revision。
- [x] 6.4 将 `/compact` quick action送入正常 confirm flow；Tokens/Balance 只 deep-link owner detail，不换算 quota。

## 7. 常见命令 journeys

- [x] 7.1 深度覆盖 `/help`、`/commands`、`/status`、`/session`、`/new`、`/fork`、`/rename`、`/compact`、`/model`、`/permissions` 的 success/disabled/stale/owner-error。
- [x] 7.2 覆盖 `/plugins`、`/mcp`、`/skills`、`/pane`、`/explorer`、`/git`、`/plan`、`/goal`、`/diff`、`/review` 的 renderer ready/absent 降级。
- [x] 7.3 覆盖 `/agent`、`/resume`、`/archive`、`/delete`、`/preset`、`/reasoning`、`/mention`、`/copy`、`/feedback`、`/init`、`/logout`、`/quit` 的 canonical identity和 danger gate。
- [x] 7.4 验证 P1 候选无 live descriptor/handler 时不出现在 executable results。

## 8. Debug、集成证据与文档

- [x] 8.1 实现 redacted event/frame replay、fixed-size、low-refresh、event/frame counter 与宿主 sidecar sink；日志不写 TUI stdout/stderr。
- [x] 8.2 增加 local official-seam fake integration runner，证据写入 `temp/integration-test-runs/<run-id>/`，覆盖 key → dispatch → event → receipt/Activity。
- [x] 8.3 更新 TUI package README 和 slash cookbook，说明安装、键位、完整 P0、确认差异、status、debug、降级和真实可运行命令。
- [x] 8.4 若官方 viewport/frame/status/logical-key seam 缺失，创建最小 `upstream-prs/<slug>/`；插件完成门继续是本地 typed probe 与 fail-visible contract。
- [x] 8.5 运行相关 package tests/typecheck/build、bundle conformance、golden/replay/redaction checks 与 `openspec validate dsh-tui-command-first-interaction-v1 --strict --no-interactive`。
