# DSH TUI 命令优先交互体验 V1

> 状态：TUI UI/交互规格完成；实现由 `openspec/changes/dsh-tui-command-first-interaction-v1/` 跟踪。共享 session status projection 来自 sibling change `dsh-web-command-first-interaction-v1`，TUI 不另建事实源。

## 1. 产品结论

DSH TUI 应成为 Web 命令优先体验的同源终端表面，但不复制 Web 的 Popover、Dialog 和 Pane。终端采用：

- 输入区 Slash Assist：当前会话内快速命令；
- `Ctrl+K` Command Center：完整搜索、Recent Activity、Status；
- 结构化 command token/selector/argument；
- receipt lane：即时 pending/error/recovery；
- Inspector：终端中的只读详情，而不是字符版 Web Pane；
- statusline：持续显示 session/lifecycle/context。

当前完整 P0 命令族继续可发现；首批深度 journey 聚焦 `/help`、`/commands`、`/status`、`/session`、`/new`、`/fork`、`/rename`、`/compact`、`/model`、`/permissions`。

## 2. 核心原则

1. **同一命令真源。** Web/TUI 不维护两套 canonical names、owner、danger 或 availability。
2. **终端不是 Web 字符画。** 用 Command Center、Inspector、statusline 和分页适应终端。
3. **输入优先。** 普通聊天字符不得被全局键位吞掉；裸 `j/k` 不默认导航。
4. **默认取消。** 非 safe command 的初始 Enter 不提交。
5. **未知必须诚实。** context、quota、renderer、owner receipt 缺失时显示原因，不猜状态。
6. **结果不污染对话。** receipt/Activity/Inspector 与模型 transcript 分开。
7. **可脱离 raw mode 测试。** update/render 纯函数、固定尺寸 golden、事件回放。

## 3. 信息架构

```text
TUI Command Shell
├─ Statusline
│  └─ current session / lifecycle / context / runtime
├─ Transcript Viewport
├─ Optional Inspector Region
├─ Receipt Lane
├─ Slash Assist / Selector / Confirmation
├─ Input Editor
└─ Command Center (Ctrl+K)
   ├─ Commands
   ├─ Recent Activity
   └─ Status
```

## 4. 线框

### 4.1 Wide 120×36：Slash Assist + statusline

```text
 alpha · idle | deepseek · auto · ask | ctx 88% | 7d 34% Sep 7
───────────────────────────────────────────────────────────────────────────────────────────────────────────────
 Assistant  The focused checks passed. You can review the diff next.



───────────────────────────────────────────────────────────────────────────────────────────────────────────────
  /status       Current session status                                      Enter
> /session      Manage sessions                                             selector
  /compact      Compact conversation context                                confirm
  /model        Select the active model                                     selector
  /mcp          Inspect MCP servers                                          unavailable
───────────────────────────────────────────────────────────────────────────────────────────────────────────────
❯ /ses█
  ↑↓ navigate  Tab complete  Enter select  Esc close  Ctrl+K command center
```

### 4.2 Wide：Command Center + detail

```text
┌ Commands ───────────────────────────────────────┬ Command detail ───────────────────────────────────────────┐
│ Search: arch█                                   │ /archive                                                   │
│                                                │ Archive a session                                          │
│ SESSION                                        │                                                            │
│ > /archive     Archive a session      confirm │ owner       dsh                                            │
│   /session     Manage sessions        selector│ danger      confirm                                        │
│                                                │ coverage    staged                                         │
│                                                │ input       sessionId                                      │
│                                                │ result      receipt + Activity                             │
│                                                │ unavailable owner preview capability is missing            │
├────────────────────────────────────────────────┴────────────────────────────────────────────────────────────┤
│ ←→ Commands / Recent / Status   ↑↓ select   Enter open   Esc return                                          │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 4.3 `/session` selector → action menu

```text
┌ Select session ─────────────────────────────────────────────────────────────────────────────────────────────┐
│ Search: refactor█                                                                                           │
│                                                                                                             │
│ > refactor auth flow        session:…91A2       idle        current                                        │
│   release preparation       session:…0CE4       archived                                                   │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

┌ Session actions: refactor auth flow ───────────────────────────────────────────────────────────────────────┐
│ > Switch          safe                                                                                    │
│   Rename          safe                                                                                    │
│   Archive         confirm                                                                                 │
│   Restore         unavailable · session is not archived                                                   │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 4.4 Confirm 与 destructive

```text
Confirm /compact
Target      session:…91A2
Effect      Compact current conversation context
Reversible  owner-defined

> [Cancel]    [Confirm]

y confirm · Tab/←→ move · Enter selected action · Esc back
```

```text
[DANGER] Delete session
Target      release preparation · session:…0CE4
Effect      Owner-authored deletion; recovery may be unavailable

Type DELETE 0CE4 to confirm: DELETE ____

Enter submit only after exact match · Esc cancel
```

Confirm 初始 focus 永远在 Cancel。`Ctrl+Enter` 只有在官方宿主能提供可靠 logical modifier 时才作为快捷方式；raw terminal sequence 不可靠时使用 `y` 或显式移动 focus。Destructive 不接受单个 `y`。

### 4.5 Receipt lane

```text
───────────────────────────────────────────────────────────────────────────────────────────────────────────────
Pending  /fork · waiting for owner receipt                                                        [locked]
❯
```

```text
Failed   /permissions · permission policy changed since preview
Action   Re-open selector                                      [Enter]   Dismiss [Esc]
❯
```

pending 阻止同一 draft 重复提交；failed/partial/stale/rejected 保持，success 在宿主 tick 或下一次输入后折叠到 Recent。

### 4.6 `/status` Inspector

```text
┌ Status ─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Session       refactor auth flow · session:…91A2 · idle                                                     │
│ Runtime       deepseek · default · auto · ask                                                              │
│                                                                                                             │
│ Context       [##################--] 88% remaining       31,436 used / 258K                                 │
│ 7-day limit   [#######-------------] 34% remaining       resets Sep 7                                       │
│                                                                                                             │
│ Freshness     fresh · token-meter / provider-owner                                                         │
│ Actions       [Compact] [Model] [Permissions] [Tokens]                                                     │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Enter action · PageUp/PageDown · Esc return                                                                 │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

余额金额不换算为 quota；缺 context/limit 时显示 `? / unavailable / unsupported`。

### 4.7 Standard 80×24

```text
alpha idle | ctx 18% WARN | model deepseek | ask
────────────────────────────────────────────────────────────────────────────────
Conversation


────────────────────────────────────────────────────────────────────────────────
> /compact   Compact conversation context                         confirm
  /commands  List available commands                              Enter
  /copy      Copy current selection                               disabled
  /feedback  Send product feedback                                argument
────────────────────────────────────────────────────────────────────────────────
❯ /com█
↑↓ select  Tab complete  Enter  Esc  Ctrl+K
```

Command Center 和 Inspector 在该宽度使用全屏页面，不与 transcript 并列。

### 4.8 Compact 60×20 / Minimal

```text
alpha | ctx 8% CRIT
────────────────────────────────────────────────────────────
Conversation


────────────────────────────────────────────────────────────
> /compact          confirm
  /commands         Enter
  /copy             disabled
  /feedback         argument
────────────────────────────────────────────────────────────
❯ /co█
↑↓ Tab Enter Esc
```

小于 60 列或高度不足 14 行时，只保留 input、3 个候选/receipt 和最高优先级 status；详情进入分页。

## 5. 常见命令设计

| 类别 | 命令 | TUI 交互 | 结果/降级 |
| --- | --- | --- | --- |
| discovery | `/help [command]` (`/h`、`/?`) | 帮助列表或 command detail | 同 live directory，不维护静态第二份帮助 |
| discovery | `/commands` | Command Center Commands 页 | `Ctrl+K` 同一 surface |
| discovery | `/status` | Status Inspector | snapshot 缺失显示 unavailable |
| discovery | `/plugins` | list → detail | bounded plugin metadata |
| discovery | `/mcp`、`/skills` | list/detail Inspector | 缺 TUI renderer 时 disabled+reason |
| navigation | `/pane` | 选择可 TUI 呈现的 view | Web-only view 不伪造 |
| navigation | `/explorer` (`/files`)、`/git` | tree/status/diff Inspector | 只读 safe projection |
| session | `/agent` (`/agents`, `/subagents`) | thread selector | safe refs；不合成 thread |
| session | `/resume` (`/r`) | session selector | owner open receipt |
| session | `/session` (`/sessions`) | selector → switch/rename/archive/restore | 不嵌套 delete |
| session | `/new` | safe immediate | pending 防重复 |
| session | `/fork`、`/archive` | confirm 默认 Cancel | archive 需 owner preview |
| session | `/rename <title>` | single-line argument | owner schema 校验 |
| session | `/delete` | typed phrase destructive gate | preview/receipt 缺失则 staged |
| model | `/model`、`/preset`、`/reasoning` | searchable selector | owner receipt |
| model | `/permissions` | selector + effect + confirm | stale policy fail closed |
| work | `/plan`、`/goal`、`/diff`、`/review` | Inspector | 无 renderer 用 bounded text/disabled |
| work | `/compact` | confirm | status critical 也不会自动执行 |
| work | `/mention` | selector → 插入 draft | 不自动发送 |
| lifecycle | `/copy` | host clipboard/OSC52 capability | 不可用时 disabled |
| lifecycle | `/feedback` | bounded argument → owner action | receipt 保留失败原因 |
| lifecycle | `/init` | command detail | not applicable，不执行 |
| lifecycle | `/logout`、`/quit` (`/exit`) | confirm 默认 Cancel | 不归类为 destructive delete |

P1 `/clear`、`/side`、`/btw`、`/usage`、`/debug-config`、`/theme`、`/statusline` 没有 owner contract 前不进入 executable results。

## 6. Keymap

| 动作 | 默认键位 | 作用域 |
| --- | --- | --- |
| 打开/关闭 Command Center | `Ctrl+K` | conversation/center |
| 上下移动 | Up/Down、`Ctrl+P`/`Ctrl+N` | list/selector/action |
| 首尾 | Home/End | list |
| 选择/执行 | Enter | safe/当前 focus action |
| 补全/下一区域 | Tab | unique prefix/focus |
| 返回/取消 | Esc | 逐层返回 |
| 翻页 | PageUp/PageDown | transcript/Inspector |
| Center 页面 | Left/Right | Commands/Recent/Status |
| 关闭 receipt | Esc；contextual `Ctrl+D` | receipt only |

裸 `j/k` 默认关闭；`Ctrl+C`、EOF、signal 与应用退出策略属于官方宿主。

## 7. Component / State Tree

```text
TuiCommandShell
├─ SessionStatusLine
├─ TranscriptViewport
├─ InspectorRegion
│  └─ TuiInspectorModel
├─ CommandOverlay
│  ├─ SlashAssistList
│  ├─ CommandCenter
│  │  ├─ CommandsPage
│  │  ├─ RecentPage
│  │  └─ StatusPage
│  ├─ SelectorList
│  ├─ ArgumentEditor
│  ├─ ConfirmPanel
│  └─ DestructivePhrasePanel
├─ CommandReceiptLane
└─ InputEditor
```

```text
Terminal Event
      ↓
update(state, event)
      ↓
new state + host commands
      ↓
render(state, width, height, projections)
      ↓
Frame
```

## 8. 状态与终端退化

| 情况 | 显示 | 行为 |
| --- | --- | --- |
| command disabled | `disabled · reason` | 可聚焦，不执行 |
| owner stale | `[STALE]` + reconcile | mutation 禁用 |
| receipt unknown | `pending/unknown` | 不自动 retry |
| renderer missing | `No TUI renderer` | bounded text 或禁用 |
| context unknown | `ctx ?` | 不读 ledger 猜测 |
| no color | `[OK]/[WARN]/[CRIT]/[ERR]` | 语义不丢 |
| ASCII only | `>`, `-`, `[x]` | 不依赖 emoji/box drawing |
| screen reader/line mode | focus/status/receipt 行式输出 | 不循环倾倒整屏 |

## 9. Debug 与安全

TUI debug mode支持固定宽高、降低刷新、event/frame counter、关闭 alternate screen（宿主允许时）和 redacted replay。

可以记录：logical key、resize、focus、directory/status revision、canonical command、receipt status/ref。

禁止记录：raw draft、raw prompt、argument values、confirmation phrase、provider payload、credential、private tool arguments、absolute path、完整 reasoning。

TUI 持有终端时日志必须写宿主 sidecar，不写 stdout/stderr。若必须消费进程 CLI，只能用明确的 `--json` 或 `--events` typed output，不解析人类 summary。

## 10. 验收标准

- 完整 P0 command 与 aliases 在 TUI 中保持 canonical contract；无 handler 的 P1 不出现为可执行项。
- 常见命令 journey 在 1–2 个明确选择步骤内进入 argument/selector/confirmation/dispatch。
- confirm 初始 Enter 不提交；destructive 必须匹配 owner phrase。
- command result 不进入模型 transcript；Recent 可从 `command/run|done` 恢复。
- 120×36、80×24、60×20、50×12 完成关键 flow，无不可达输入/确认/receipt。
- resize 往返不丢 draft、selector、receipt 或 scroll anchor。
- statusline 与 `/status` 使用同 revision；unknown 不显示假百分比/reset。
- color/no-color、Unicode/ASCII、CJK width 和 line mode 均可读。
- update/render snapshot/replay 可在不进入 raw mode 的测试中复现。
- frame、日志、replay、fixture 与 evidence 不含敏感或模型内部内容。

## 11. 上游与回滚

官方 TUI 必须拥有 raw mode、alternate screen、signal、cursor、viewport、frame flush 和 cleanup。插件只通过 capability seam交付 state/render contribution；seam 缺失时 fail-closed。

全部新增 surface 为 additive。关闭 `tui-command-shell-v1` renderer capability 即可回滚到现有 assist adapter；`:` alias、Web command experience、owner actions 和 session status projection均不受影响。
