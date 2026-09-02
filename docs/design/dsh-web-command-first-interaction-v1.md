# DSH Web 命令优先交互体验 V1

> 状态：UI/交互规格完成；实现由 `openspec/changes/dsh-web-command-first-interaction-v1/` 跟踪。

> TUI 同源交互由 `docs/design/dsh-tui-command-first-interaction-v1.md` 与 `openspec/changes/dsh-tui-command-first-interaction-v1/` 跟踪；两者共享命令目录、owner 合同、session status projection 与 durable command events。

## 1. 产品结论

DSH Web 采用“命令优先的混合壳”：聊天与 Composer 是高频入口，复杂对象仍在 Pane 中完成。参考 Codex 的价值是低干扰、快速扫描、键盘优先和反馈可预测，不是复制其皮肤或删掉 DSH 的 session、Pane、Agent、Ordo、MCP 与插件能力。

V1 首批深度验证会话与上下文命令：`/status`、`/session`、`/new`、`/fork`、`/rename`、`/compact`、`/model`、`/permissions`。当前 P0 的 discovery/session/model/work/lifecycle 五类命令仍全部出现在同一实时目录；“首批”只代表完整交互 journey 的焦点，不代表隐藏其他命令。工作区工具和 Agent/Ordo 继续使用同一壳，但不进入首批完成门。

## 2. 体验原则

1. **一个事实源，多种入口。** `/`、`Ctrl/Cmd+K`、Composer controls 和 Header status 不得维护不同命令或状态。
2. **先就地，后展开。** 参数、普通确认和短 receipt 留在 Composer；富结果才进入 Pane preview。
3. **未知必须诚实。** context、quota、reset 缺 owner 数据时显示 unknown/unsupported，不显示假 0、假 100% 或估算日期。
4. **当前会话优先。** 首屏先回答“这个会话还能否继续、当前是什么配置、下一步需要什么”。跨会话总量进入详情。
5. **键盘与鼠标同语义。** Enter、Escape、Tab、Arrow、`Ctrl/Cmd+Enter` 和 focus return 在所有 overlay 中一致。
6. **能力不可用不等于消失。** 命令和动作保留可见，给出原因与恢复路径；没有 dead button。
7. **不污染对话。** command result 不进入模型消息；短反馈在 receipt lane，耐久记录在 Activity。

## 3. 信息架构

```text
DSH Web Shell
├─ Session Header
│  ├─ session title / safe ref
│  └─ Session Status Capsule
│     ├─ Status Popover
│     └─ Session Status Pane
├─ Conversation
│  ├─ message list + message actions
│  └─ Composer
│     ├─ Slash Assist
│     ├─ Command Token / Argument / Selector
│     ├─ Inline Confirmation
│     ├─ Receipt Lane
│     ├─ 1–3 Suggestion Chips
│     └─ Model / Preset / Reasoning / Permissions Controls
├─ Global Command Palette
├─ Activity Pane
└─ Pane Workbench
   └─ Preview Tab → Pinned Tab
```

## 4. 低保真线框

### 4.1 Desktop：Composer Slash Assist

```text
┌─────────────────────────────────────────────────────────────────────┐
│ Session title                              [● Context 88%]          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│                         Conversation                                │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│ ┌─ Slash Assist ──────────────────────────────────────────────────┐ │
│ │ /status      当前会话状态                         Enter         │ │
│ │ /session     切换、重命名、归档                   → selector     │ │
│ │ /compact     压缩上下文                           confirmation   │ │
│ │ /model       选择模型                             → selector     │ │
│ │ /mcp         MCP Inspector unavailable           disabled       │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│ [ /sta|                                                         ]  │
│ [Model: DeepSeek] [Reasoning: Auto] [Permissions: Ask]      [Send] │
└─────────────────────────────────────────────────────────────────────┘
```

Slash Assist 最多 8 行；exact match、当前会话相关命令和 recent command 优先。disabled 行可聚焦、可读原因，但不能执行。

### 4.2 Desktop：结构化命令与 Receipt

```text
┌─────────────────────────────────────────────────────────────────────┐
│ [ /compact ]  Compress current conversation context                 │
│ Target: session:01d0…     Effect: owner compaction, no auto retry   │
│ [Cancel]                                  [Confirm Ctrl/Cmd+Enter]  │
├─────────────────────────────────────────────────────────────────────┤
│ Pending… waiting for owner receipt                                  │
│ or                                                                  │
│ Failed · stale context · Re-read status                     [Open]   │
├─────────────────────────────────────────────────────────────────────┤
│ [Model] [Reasoning] [Permissions]                     [Activity 3]  │
└─────────────────────────────────────────────────────────────────────┘
```

成功 receipt 4 秒后折叠；错误、partial 和 stale 保持，直到用户处理或 dismiss。

### 4.3 Desktop：Session Status Popover

```text
                         [● Context 88%]
                                │
┌─────────────────────────────────────────────────┐
│ Status                                   Close  │
│ session:01d05840…                        Copy   │
│ DeepSeek · Default · Auto · Ask                  │
│                                                 │
│ Context                                         │
│ █████████████████░░░  88% remaining             │
│ 31,436 used / 258K                              │
│                                                 │
│ 7-day limit                                     │
│ ███████░░░░░░░░░░░░  34% remaining             │
│ Resets Sep 7                                    │
│                                                 │
│ [Compact] [Model] [Permissions] [Details]       │
└─────────────────────────────────────────────────┘
```

当 limit/reset 不可用时，该行显示 owner safeMessage；余额金额只在 Tokens 详情展示，不能换算成 limit 百分比。

### 4.4 Global Palette

```text
┌────────────────────── Command Palette ──────────────────────┐
│ Search commands, panes, sessions…                           │
├─────────────────────────────────────────────────────────────┤
│ Current                                                     │
│ /status       Current session status                ⌘       │
│ /compact      Compact context                       confirm  │
│ Recent                                                      │
│ /model        Select model                           →       │
│ Workspace                                                   │
│ /pane         Open a workspace pane                  →       │
│ /mcp          Inspector unavailable                  reason  │
└─────────────────────────────────────────────────────────────┘
```

Palette 是完整搜索面，不代替 Composer slash；关闭后焦点回到原 trigger。

### 4.5 Narrow screen

```text
┌──────────────────────────────┐
│ Session         [Status 18%] │
├──────────────────────────────┤
│ Conversation                 │
│                              │
├──────────────────────────────┤
│ /status                      │
│ /session                     │
│ /compact                     │
│ ──────────────────────────── │
│ [/com|]                      │
│ [Model] [Permissions] [•••]  │
└──────────────────────────────┘
```

<768px 时菜单/selector/status detail 使用全宽 Sheet；触控目标至少 44px，不依赖 hover。

## 5. 命令行为矩阵

| 命令族 | 例子 | 选择后 | 确认 | 结果 |
| --- | --- | --- | --- | --- |
| inspect | `/status`、`/plan`、`/goal` | 立即执行 | 无 | Popover/Pane preview + Activity |
| selector | `/session`、`/model`、`/preset` | command token + selector | 依 action danger | owner receipt |
| safe lifecycle | `/new`、`/rename` | 参数完整后执行 | 无 | inline receipt |
| reversible mutation | `/fork`、`/compact`、`/archive`、`/permissions`、`/logout`、`/quit` | 显示 target/effect | inline `Ctrl/Cmd+Enter` | receipt + recovery |
| destructive | `/delete` | owner preview | blocking AlertDialog | durable terminal receipt |
| navigation | `/pane`、`/files`、`/git` | selector/unique match | 无 | Pane preview → Pin |

Codex 风格别名只在语义完全一致时添加；DSH canonical name、owner 和 receipt 语义保持主导。

### 5.1 当前 P0 Slash 命令族

| 类别 | 命令 | 用户预期 | 细节/降级 |
| --- | --- | --- | --- |
| discovery | `/help`、`/commands` | 发现命令、键位与用法 | `/help <command>` 展开同一 command detail；不另建帮助真源 |
| discovery | `/status`、`/plugins` | 查看当前状态或已加载插件 | 只读；短结果就地，丰富状态进入 Popover/Pane |
| discovery | `/mcp`、`/skills`、`/pane`、`/explorer` (`/files`)、`/git` | 打开已安装检查器或 Pane | 缺 surface 时保留 disabled 行与安装/恢复原因 |
| session | `/agent` (`/agents`, `/subagents`)、`/resume` (`/r`) | 选择 thread/session | command token + owner selector；不在 client 合成列表 |
| session | `/session` (`/sessions`) | switch/rename/archive/restore 中枢 | 先选 session，再显示目标可用动作；不嵌套 delete |
| session | `/new`、`/rename` | 新建或改名 | 参数完整后 safe dispatch，等待 owner receipt |
| session | `/fork`、`/archive` | 可逆/可恢复 mutation | inline confirmation；archive 仍需 owner preview/receipt gate |
| session | `/delete` | 删除 owner target | destructive AlertDialog；缺 preview/receipt 时 staged/disabled |
| model | `/model`、`/preset`、`/reasoning`、`/permissions` | 调整当前运行配置 | 与 Composer controls 同一 selector；逐项显示 unavailable reason |
| work | `/plan`、`/goal`、`/diff`、`/review` | 查看/进入工作与审阅表面 | owner inspect 或 Pane preview；不把结果写进模型历史 |
| work | `/compact`、`/mention` | 压缩上下文或插入安全 mention | compact 需 inline confirm；mention 只接受 owner-safe ref |
| lifecycle | `/copy`、`/feedback` | 本地复制或提交反馈 | local/owner action 分开；feedback 失败保留 receipt |
| lifecycle | `/init` | Codex 对照项 | 在 DSH 继续显示 not-applicable 解释，不假装可执行 |
| lifecycle | `/logout`、`/quit` (`/exit`) | 退出身份或当前 client surface | 均为 confirm；不是 destructive delete |

P1 候选 `/clear`、`/side`、`/btw`、`/usage`、`/debug-config`、`/theme`、`/statusline` 只进入后续探索账本。没有 live descriptor、owner handler 和验证证据前，不在目录里放可点击占位。

### 5.2 命令行与详情层级

紧凑 Slash Assist 每行只承担扫描：canonical name、单行 description，以及 shortcut、selector、confirm 或 disabled reason 中最重要的一项。全局 Palette 和 `/help <command>` 再展开：

- aliases 与 canonical identity；
- category、input hint、owner 和 action kind；
- `safe` / `confirm` / `destructive`；
- available、disabled、staged、not-applicable 及原因；
- 结果会留在 inline、打开 selector/Popover、进入 Pane preview 还是 AlertDialog。

所有详情从 live descriptor 与 capability probe 派生。不得把 handler、动态 import、远程 URL、raw owner payload 或 credential 暴露给 DOM。

## 6. Component Tree

```text
CommandFirstConversationShell
├─ SessionHeader
│  └─ SessionStatusCapsule
│     ├─ SessionStatusPopover
│     └─ SessionStatusSheet (responsive)
├─ ConversationViewport
├─ ComposerShell
│  ├─ SlashAssistPopover
│  │  ├─ CommandSearchField
│  │  ├─ CommandGroup
│  │  └─ CommandRow
│  ├─ CommandDraftBar
│  │  ├─ CommandToken
│  │  ├─ ArgumentEditor / CommandSelector
│  │  └─ InlineConfirmation
│  ├─ CommandReceiptLane
│  ├─ SuggestionChipRow
│  └─ ComposerControlBar
├─ GlobalCommandPalette
├─ CommandActivityPane
└─ SessionStatusPane
   ├─ StatusSummary
   ├─ ContextMeter
   ├─ ProviderLimitList
   ├─ RuntimeSummary
   └─ Tokens / Activity DeepLinks
```

## 7. Interactive Control Inventory

| id | primitive | 状态 | 键盘 / 焦点 | 数据 / 失败行为 |
| --- | --- | --- | --- | --- |
| `slash-assist` | anchored listbox/Popover | closed/open/loading/empty | Arrow、Home/End、Enter、Escape；关闭回 Composer | live directory；disabled 行显示原因 |
| `global-palette` | Dialog + listbox | closed/open/search/no-results | `Ctrl/Cmd+K`、Arrow、Enter、Escape；focus trap/return | 同一 directory revision |
| `command-token` | removable token/button | selected/argument/invalid/disabled | Backspace/Escape 取消，Tab 进入下一步 | UI-only draft；不持久化 raw args |
| `command-selector` | searchable selector | loading/ready/empty/error | Arrow、Enter、Escape；返回 token | owner safe refs；错误不合成选项 |
| `inline-confirm` | inline action bar | ready/stale/pending | `Ctrl/Cmd+Enter` 确认，Escape 取消 | target/effect/owner preview |
| `destructive-confirm` | AlertDialog | preview/confirming/error | 裸 Enter 不确认；focus trap | preview + receipt capability 必需 |
| `receipt-lane` | inline status | pending/success/partial/error/stale | 可聚焦；success 折叠，error 保持 | official command lifecycle |
| `activity-trigger` | button/badge | idle/unread/open | Enter/Space 打开 Pane/Dialog | session command events |
| `status-capsule` | button + status text | ready/warning/critical/unknown | Enter/Space 打开，Escape 返回 | session status snapshot |
| `status-popover` | Popover/Sheet | loading/ready/partial/error | focus scope、Escape、outside close | 同一 status view model |
| `context-meter` | progress + text | neutral/warning/critical/unknown | 非独立交互；screen reader 读百分比/未知 | owner context only |
| `quick-action` | Button | available/disabled/pending | Enter/Space | 复用 command directory/gate |
| `composer-control` | compact selector trigger | ready/disabled/open | Enter/Space、Arrow、Escape | `/model` 等同源 selector |
| `suggestion-chip` | Button | visible/selected/hidden | Tab/Arrow；点击只填草稿 | owner/client safe suggestion |
| `pane-preview` | Pane view | preview/pinned/orphaned/error | Pane 既有 keymap | public `openView()` only |

## 8. Visual System

- 使用现有 `ui-visual-kit` tokens；不新增硬编码深色、渐变、玻璃、发光或大阴影。
- 基础字号沿用 host；命令、状态正文 12–13px，主要数值 14–15px，safe ref/shortcut 使用 mono。
- spacing 只用 4/8/12/16/24；普通控制 radius 6–8px，浮层最大 10px。
- Capsule 不是装饰 badge：必须包含状态文字；warning/critical 同时使用 icon/shape/ARIA。
- 普通 hover/focus/open transition 120–180ms；最多 8px 位移；reduced motion 关闭位移。
- Popover 宽 360–400px；Slash Assist 对齐 Composer 文本区；Palette desktop 宽 560–680px；right Pane 建议 340–420px。

## 9. 状态事实与降级

| 信息 | owner/source | ready | 不可用时 |
| --- | --- | --- | --- |
| session identity/lifecycle | DSH session owner | safe ref + state | unknown/offline + reason |
| model/preset/reasoning/permissions | runtime owner | safe labels | 单项省略，不猜默认 |
| context used/limit/remaining | tokenMeter + model metadata | exact counts/ratio | unavailable；不读 process ledger 推导 |
| Provider limit/reset | Provider/runtime adapter | bounded window | unsupported/unavailable + safeMessage |
| token usage history/balance | existing token usage owner | Tokens detail | 保持旧入口/旧 fallback |
| quick actions | command directory | available/disabled | disabled + reason，无假按钮 |

Context presentation threshold：remaining >25% neutral；10–25% warning；≤10% critical。阈值只影响 UI，不会自动执行 `/compact`。

## 10. 验收标准

- 高频会话命令从 Composer 或 Palette 1–2 次交互可达。
- Slash 与 Palette 对同一命令显示相同 canonical identity、availability、danger 和 disabled reason。
- Enter、Escape、Tab、Arrow、`Ctrl/Cmd+Enter` 在 assist/selector/confirm/receipt 中无歧义；关闭 overlay 后焦点精确返回。
- command result 不进入模型历史；页面刷新后 Activity 可从 durable events 恢复。
- status capsule、Popover、Pane 的 current session/context/limit 数值一致；unknown 不伪装为 ready。
- Pane result 默认 preview，用户交互或 Pin 后持久；Pane seam 缺失时诚实降级。
- 1440×960、1024×768、390×844 无重叠、截断、滚动锁错误或不可达控制。
- 所有 visible controls 具备 loading/empty/error/disabled/focus 状态和至少一个失败路径测试。
- `prefers-reduced-motion` 下功能、焦点、状态与内容不丢失。
- DOM、日志、截图与 evidence 不含 credential、raw prompt、provider payload、private args、absolute path 或完整 reasoning。

## 11. 边界与后续

V1 不移除旧 Tokens 或旧 Command Menu；它们是兼容 fallback。工作区工具命令和 Agent/Ordo 命令在共享壳稳定后分批迁移，每批独立补 scenario/evidence，不用“命令数量”替代体验验收。
