## Context

### 当前能力与缺口

| 能力 | 当前实现 | 缺口 |
| --- | --- | --- |
| P0 command catalog | `command-experience-core/P0_SEEDS` | 命令齐全，但 TUI 没有完整 presentation |
| `/` 与 `:` assist | `ui-command-experience-tui/src/assist.ts` | 只解析候选与 exact selection，没有可视列表/详情/参数步骤 |
| terminal key parser | `src/keys.ts` | 纯函数已具备，但没有完整焦点区、确认 fallback、尺寸/终端能力矩阵 |
| contribution seam | `registerCommandConsole` / `contributeCommandConsole` probe | seam 未发布时 fail-closed；没有 viewport/status/inspector 明确合同 |
| reducer | shared command reducer | 当前状态不足以表达 TUI overlay、argument cursor、confirmation phrase、receipt/Activity view |
| session hub | `/session` parser 与 Web action menu | TUI 只解析子命令，没有 selector → action → receipt renderer |
| command events | official `command/run|done` | 没有 TUI Activity 读取面 |
| session status | sibling change 定义安全 snapshot | TUI 尚无 statusline 与 Inspector |
| debug | synthetic key tests | 没有 frame snapshots、redacted event replay、fixed terminal size mode |

### 产品准入与 owner ledger

| 能力 | 准入 | canonical owner | TUI 责任 |
| --- | --- | --- | --- |
| command identity/availability/danger | `fit` | shared command directory | 排序、渲染、焦点，不复制 handler |
| session/model/permission mutation | `split-owner` | DSH owner actions | 收集 safe input、确认、显示 receipt |
| context/limits/status | `split-owner` | session/runtime/tokenMeter/provider owner | 只渲染 snapshot，不估算 |
| command Activity | `fit` | official session events | 只读 current-session timeline |
| Pane/inspect result | `split-owner` | command/Pane/host projection | TUI renderer registry；无 renderer 时禁用或安全文本降级 |
| raw terminal lifecycle | `reject-now` | official TUI host | 插件不读 stdin、不启用 raw/alternate screen/mouse |
| raw prompt/provider payload/private args | `reject-now` | owner private boundary | 不进入 frame、日志、replay、fixture |
| 解析 human CLI output 构造 TUI | `reject-now` | 无 | 必须消费 typed projection/JSON/events，不 scrape 文本 |

## Goals / Non-Goals

**Goals:**

- 常见命令在 TUI 中 1–2 个明确步骤可达，完整动作有确定的参数、确认、receipt 和恢复路径。
- TUI 与 Web 共用同一 command directory、canonical identity、owner、danger、availability 和 session status facts。
- 让 120×36、80×24、60×20 三类终端都能完成关键 flow，不依赖鼠标、颜色或 Unicode。
- 保持终端交互可测试：纯 `update`、纯 `render`、fixed-size snapshots、redacted event replay。
- 所有 mutation fail closed；terminal settlement unknown 不自动 retry。

**Non-Goals:**

- 不实现或 fork 官方 TUI runtime，不直接操作 stdin/stdout raw mode、alternate screen、signals 或 cursor restoration。
- 不把 Web Pane/Popover/Dialog 字符画照搬到终端；TUI 使用 Command Center、Inspector 和 receipt lane。
- 不为每个 Pane 插件强制实现 TUI renderer；缺 renderer 时保持 visible+disabled 或 bounded text fallback。
- 不新增 shell completion、tmux integration、terminal emulator detection 或自定义 key daemon。
- 不把 TUI screen 当成 `--json`/`--agent` 输出；机器模式仍由 owning CLI contract 管理。
- 不承诺 P1 `/clear`、`/side`、`/btw`、`/usage`、`/debug-config`、`/theme`、`/statusline` 的 owner 实现。

## Decisions

### 1. 一份 command core，Web/TUI 两种 presentation

```text
live command directory + owner capabilities + command events + status snapshot
                              │
                    shared pure command core
                              │
               ┌──────────────┴──────────────┐
               │                             │
           Web shell                     TUI shell
    Composer/Palette/Pane       input/Command Center/Inspector
```

TUI 不增加第二份 command registry。canonical command、alias、availability、danger、coverage、selectorKey、schemaKey 和 owner 均从 shared snapshot 得到。TUI 只添加 `TuiPresentationProjectionV1`，它是 descriptor/result 的安全派生视图，不拥有执行语义。

### 2. TUI 是薄壳纯状态机

```ts
type TuiCommandMode =
  | 'conversation'
  | 'slash-assist'
  | 'command-center'
  | 'argument'
  | 'selector'
  | 'confirm'
  | 'destructive-confirm'
  | 'dispatching'
  | 'receipt'
  | 'inspector'

interface TuiCommandShellStateV1 {
  mode: TuiCommandMode
  sessionRef: string | null
  inputDraft: string
  commandDraft: CommandDraftV1 | null
  candidates: readonly string[]
  cursorKey: string | null
  overlay: 'commands' | 'activity' | 'status' | 'help' | null
  selector: { query: string; cursorKey: string | null; selectedRef: string | null } | null
  confirmation: { grade: 'confirm' | 'destructive'; phrase?: string; typed: string } | null
  receiptRef: string | null
  viewport: { width: number; height: number }
}

update(state, event) -> { state, commands[] }
render(state, width, height, projections) -> Frame
```

`update` 不访问时间、网络、stdin 或 filesystem；副作用通过 command 返回给宿主。`render` 对相同 state/size/projection 必须产生相同 frame。宿主负责把 terminal key/resize/owner update 转成 event，并负责 cleanup。

### 3. 两个入口：输入区 Slash Assist 与全屏 Command Center

- 输入区在 command position 键入 `/` 打开最多 8 行的 Slash Assist；第一次发现 no-RPC。
- `:` 保持 legacy alias，列表首尾只显示一次迁移提示 `Legacy ':' prefix; use '/'`，不在每行重复。
- `Ctrl+K` 打开 Command Center。Command Center 有 `Commands`、`Recent`、`Status` 三页；左右键切页，Esc 返回原输入与 cursor。
- Commands 页提供完整目录、category filter 和 detail；Recent 页只从 current session durable `command/run|done` 派生；Status 页消费 shared status snapshot。
- Slash Assist 与 Command Center 使用相同 revision 和排序；切换入口不丢失 query。

### 4. 完整 P0 命令族与 TUI presentation

| 类别 | 命令 | TUI flow |
| --- | --- | --- |
| discovery | `/help [command]` (`/h`、`/?`) | 无参打开 help；有参打开 command detail |
| discovery | `/commands` | 打开 Command Center Commands 页 |
| discovery | `/status` | 打开 Status 页/Inspector，并记录 inspect lifecycle |
| discovery | `/plugins` | bounded list → detail Inspector |
| discovery | `/mcp`、`/skills` | 有 TUI renderer 时 list/detail；缺 renderer/surface 时 disabled+reason |
| discovery | `/pane` | 选择可 TUI 呈现的 view；Web-only view 显示 `No TUI renderer` |
| discovery | `/explorer` (`/files`)、`/git` | tree/status/diff Inspector；只调用公开 safe projection |
| session | `/agent` (`/agents`, `/subagents`) | thread selector；owner-safe refs |
| session | `/resume` (`/r`) | recent/session selector → open-session receipt |
| session | `/session` (`/sessions`) | session selector → switch/rename/archive/restore action menu |
| session | `/new` | safe owner dispatch；pending 时禁重复 |
| session | `/fork`、`/archive` | inline confirm page；archive 仍需 owner preview/receipt |
| session | `/rename <title>` | single-line argument editor，长度/字符由 owner schema 验证 |
| session | `/delete` | owner preview + typed phrase destructive gate |
| model | `/model`、`/preset`、`/reasoning` | searchable selector → owner receipt |
| model | `/permissions` | selector + effect summary + confirm |
| work | `/plan`、`/goal`、`/diff`、`/review` | bounded Inspector；可选 TUI result renderer |
| work | `/compact` | current session effect summary + confirm |
| work | `/mention` | safe mention selector，把 token 插入聊天 draft，不自动发送 |
| lifecycle | `/copy` | host clipboard/OSC52 capability 可用才执行；否则 disabled |
| lifecycle | `/feedback` | bounded argument editor → owner action |
| lifecycle | `/init` | 保留 not-applicable detail，不执行 |
| lifecycle | `/logout`、`/quit` (`/exit`) | confirm；默认 Cancel，不归类为 destructive delete |

首批深度 journey 覆盖 `/help`、`/commands`、`/status`、`/session`、`/new`、`/fork`、`/rename`、`/compact`、`/model`、`/permissions`。其余 P0 至少需要 catalog/render/disabled reason/canonical receipt 回归。

P1 候选在没有 live descriptor 与 owner handler 前不渲染为可执行项；可在 `/help roadmap` 的静态说明中列出，但不得混入 live results。

### 5. Command row 与 detail 逐层披露

Slash Assist 行：

```text
> /session    Manage sessions                         selector
  /status     Current session status                  Enter
  /mcp        MCP inspector                           unavailable
```

Command Center detail：

```text
/archive
Archive a session
owner dsh · confirm · staged
input sessionId
Unavailable: owner preview capability is missing
Result: receipt + Activity
```

紧凑行只显示 name、description 和一个最相关状态；detail 才显示 alias、owner、action kind、danger、coverage、input hint、availability reason、result presentation。detail 必须由 descriptor/capability 派生，不能保存 handler 或 raw owner data。

### 6. 结构化 command draft 与原输入恢复

```text
conversation
  → slash-assist
  → selected
  → argument | selector
  → confirm | destructive-confirm
  → dispatching
  → receipt
  → conversation | inspector
```

- 选择 command 后，输入第一段变为不可编辑 canonical token；argument/selector 在其后编辑。
- Tab 只在唯一安全前缀时补全；歧义时让按键继续交给输入区。
- selector 列表只保存 opaque safe ref；query 与选中 ref 在 session/change/reset 后清理。
- Esc 逐层返回：detail → list → selector/argument → command token → 原聊天 draft → conversation。
- raw argument 只留在当前 shell state；dispatch 或 cancel 后清理，不进 replay、receipt、Activity 或 persistence。

### 7. TUI 确认必须适应终端 modifier 不一致

| danger | 初始焦点/行为 | 明确确认方式 | 禁止 |
| --- | --- | --- | --- |
| safe | Execute | Enter | 缺参数/disabled/stale 时执行 |
| confirm | Cancel | `y`、Tab/Arrow 到 Confirm 后 Enter；宿主明确报告 modified Enter 时也可 | 初始裸 Enter 确认 |
| destructive | Cancel + phrase editor | 输入 owner-authored bounded phrase，例如 `DELETE 9F3A` 后 Enter | 仅按 `y`、本地合成 preview、无 receipt 执行 |

`Ctrl+Enter` 在不同 terminal emulator 中常退化成普通 Enter，因此 raw sequence parser 不得假装能可靠区分。若官方宿主提供 logical modified key，TUI 可接受它；否则使用显式 focus/phrase fallback。confirm 与 destructive 页面均显示 target、effect、reversible、owner 和 stale state。

### 8. Receipt lane 与 durable Activity

- input 区上方固定一行 receipt lane；pending 显示 spinner frame/文字并锁定同一 draft。
- success 默认保留到下一次用户输入或 4 秒宿主 tick 后折叠；无 tick seam 时保持到下一输入，不自行读系统时间。
- failed/partial/stale/rejected 保持到 dismiss、打开 detail 或 owner-authorized retry。
- Activity 只读 `command/run|done`，按 current session 关联 correlation/receipt ref；没有 matching done 时显示 `pending/unknown`，不得推断失败。
- Recent 页最多先显示 20 条，支持按状态过滤和打开 safe detail；完整历史仍由 owner/event source 管理。
- result 不作为 assistant/user message写进 transcript。

### 9. TUI Inspector 代替 Web Pane

TUI 增加只读 presentation registry：

```ts
interface TuiResultRendererContributionV1 {
  id: string
  schemaKey: string
  version: '1alpha1'
  render: (projection: unknown, width: number, height: number) => TuiInspectorModelV1
}
```

注册项只接收通过 strict schema 的 bounded projection；不得包含执行函数、dynamic import、URL、path 或 credential。command handler 仍由 owner/runtime 执行。

- ≥120 columns：Command Center/Inspector 可使用 42–48 列右侧 detail，主 transcript 保持可见。
- 80–119 columns：Inspector 全屏覆盖，顶部保留 title/breadcrumb，Esc 返回。
- <80 columns：单列分页；隐藏非关键 metadata，用 `More` 页显示 detail。
- 无 renderer：若 result 有 bounded safe text 则显示 pager；否则 command visible+disabled，reason 为 `No TUI renderer for <schemaKey>`。

### 10. Session statusline 与 `/status` 使用同一 snapshot

TUI 复用 `session.status.snapshot.v1alpha1`：

```text
wide:    alpha · idle | deepseek · auto · ask | ctx 88% | 7d 34% Sep 7
standard:alpha idle | ctx 88% | model deepseek | ask
compact: alpha | ctx 18% WARN
unknown: alpha | ctx ? | limits unavailable
```

- statusline 每项来自 owner snapshot，不从 token usage ledger、余额金额或 transcript length 推导。
- lifecycle `waiting_approval`、`error`、`offline` 优先于普通 context 文案。
- `/status` 打开 Status Inspector：session ref、lifecycle、model/preset/reasoning/permissions、context、最多 4 个 limit window、freshness/source 与 safe recovery action。
- context >25% neutral；10–25% warning；≤10% critical。阈值只改变 label/attribute并建议 `/compact`，不自动执行。
- `NO_COLOR=1` 或无色终端使用 `[OK]`、`[WARN]`、`[CRIT]`、`[?]`；不得只靠颜色。

### 11. 默认键位保持输入安全

| intent | default | 说明 |
| --- | --- | --- |
| Command Center toggle | `Ctrl+K` | idle 打开，open 时关闭并恢复 draft |
| navigate | Up/Down、`Ctrl+P`/`Ctrl+N` | assist/list/selector/detail action |
| first/last | Home/End | 仅列表 focus |
| execute/select | Enter | non-safe 初始 Enter 不确认 |
| complete/advance | Tab | 唯一前缀补全或切换 focus region |
| back/cancel | Esc | 逐层返回，不直接退出程序 |
| dismiss receipt | Esc 或 contextual `Ctrl+D` | `Ctrl+D` 仅 receipt focus 生效；idle 仍归宿主 EOF policy |
| page | PageUp/PageDown | transcript/Inspector 分页 |
| detail tab | Left/Right | Command Center Commands/Recent/Status |

默认不绑定 bare `j/k`，避免吞输入字符；Vim keys 只能作为显式配置。插件不拥有 `Ctrl+C`、SIGINT、quit-on-double-press 等宿主策略。

### 12. Terminal size 与退化规则

| viewport | 布局 | 候选数 | status |
| --- | --- | --- | --- |
| ≥120×30 | transcript + optional right Inspector；assist 8 行 | 8 | full |
| 80–119 或高度 20–29 | 单列；Command Center/Inspector 全屏 | 6 | standard |
| 60–79 或高度 14–19 | compact 单列；detail 分页 | 4 | compact |
| <60 或高度 <14 | minimal mode：input + 3 candidates/receipt | 3 | lifecycle/context only |

所有布局由 `render(state,width,height)` 决定，不改变 canonical reducer state。resize 往返不得丢 command draft、selector ref、receipt 或 scroll anchor。文本截断必须保留 command name 与状态后缀；宽字符使用 cell width，不按 JS string length 截断。

### 13. 可访问性、终端兼容与 motion

- ANSI color 是增强项；所有状态有文字/符号。
- 支持 ASCII fallback：`>`、`*`、`-`、`[x]`，不强依赖 box drawing、Braille spinner 或 emoji。
- 不闪烁整屏；只更新变化 region。无宿主 diff-frame seam 时仍生成完整纯 frame，由宿主决定刷新。
- screen reader/line mode 可关闭 alternate screen，输出当前 focus line、状态变化和 receipt 摘要；不得循环重绘整屏文本。
- 动画仅为低频 spinner/tick；reduced-motion/low-refresh 模式使用静态 `Pending`。
- focus 始终可从 frame 推导；不可用项可聚焦查看原因但 Enter 不执行。

### 14. 输出、日志和 debug replay 分离

Interactive TUI 不得解析 default human summary、ANSI output 或 localized prose。可接受来源只有：

1. shared typed projection；
2. owner Remote/event；
3. 若必须调用进程 CLI，则显式 `--json` 或 `--events`，并通过 schema/parser 验证。

TUI 拥有终端期间，debug/log 不写 stdout/stderr；使用宿主提供的 sidecar sink。Redacted replay event 允许：logical key、resize、focus、directory revision、safe command id、receipt status/ref、status revision。禁止：raw draft、raw prompt、argument values、provider payload、private tool args、credential、absolute path、完整 reasoning。

Debug mode SHALL 支持固定 size、关闭 alternate screen（宿主允许时）、降低 refresh、显示 event/frame counter，并从 recorded events 重放。startup/shutdown/error/panic cleanup 仍由宿主 RAII/defer/finally 负责。

### 15. Package ownership

| package | 责任 |
| --- | --- |
| `command-experience-core` | shared directory、CommandDraft、ranking、key intents、detail projection；无 terminal API |
| `ui-command-experience-tui` | TUI update/render/layout、assist、Command Center、selector、confirm、receipt、Activity、Inspector registry |
| `dsh-session-status` | session status safe snapshot；Web/TUI 共用 |
| `ui-session-status` 或 wire mirror | snapshot parser/view model；不得依赖 React 才可供 TUI 消费 |
| `dsh-command-experience` bundle | capability probe、contribution wiring、dispose；不创建 fake TUI host |
| official DSH TUI | stdin/raw/alternate screen/signal/viewport/frame/focus/cleanup owner |

## Risks / Tradeoffs

- **官方 seam 不完整。** 先定义最小 viewport/input/frame/status/inspector capability probe；缺失时 package tests 可完成，真实 TUI 不宣称 ready。
- **终端 modified Enter 不可靠。** confirm 使用默认 Cancel + explicit focus/`y` fallback；destructive 使用 typed phrase。
- **完整 P0 会造成列表拥挤。** Slash Assist 限 8/6/4 行，完整目录进入 Command Center，disabled 项保留但排序靠后。
- **Inspector renderer 可能碎片化。** 只按 schemaKey 注册安全 renderer；无 renderer 统一 fail-visible，不按 canonical command 硬编码业务。
- **status sibling change 尚未实现。** statusline 显示 unavailable；不得从现有 token ledger 临时推断。
- **screen reader 与 alternate screen 冲突。** 提供 line/debug mode，但最终 raw lifecycle 仍需官方宿主 seam。

## Migration / Compatibility / Rollback

- 现有 `CommandConsoleContribution` 字段保持；新增 renderer/status/debug capability 均 optional。
- `:` alias 继续保留并显示迁移提示，本 change 不启动移除窗口。
- 现有 `parseTerminalKey`、`applyTuiConsoleKey` 和 controller API 保留；新 API 通过新导出或 optional options 添加。
- Web command experience、Tokens、Pane 与 owner actions 不改变。
- Rollback：bundle 关闭 `tui-command-shell-v1` capability 或不注册 renderer；旧 TUI assist adapter/目录测试继续工作。状态 projection 可独立保留给 Web。

## Verification Strategy

- pure reducer/update tests：每个 mode、Escape stack、confirm/destructive、unknown settlement。
- render golden：120×36、80×24、60×20、50×12；color/no-color、Unicode/ASCII、long label/CJK width。
- key tests：synthetic sequences + logical modified events；证明裸 Enter 不确认 non-safe。
- catalog contract：完整 P0 canonical/aliases/owner/danger/coverage/availability 不漂移。
- status contract：同 snapshot 在 Web/TUI view model 数值一致，unknown 不变 0。
- integration：local official-seam fake 驱动 input → dispatch → command events → receipt/Activity；不启动真实 raw mode。
- optional upstream canary：仅在公开 seam 存在时启动官方 `dsh --profile tui`，不作为插件本地完成门。

## Open Questions

无产品级开放问题。官方 TUI 是否提供 cell-grid frame、logical modified key、status region 与 line-mode capability属于 capability probe/上游 seam 实现问题，不改变本地交互合同。
