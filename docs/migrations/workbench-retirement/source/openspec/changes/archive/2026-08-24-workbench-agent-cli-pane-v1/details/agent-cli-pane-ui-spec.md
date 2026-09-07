# Agent CLI Pane UI Spec

## 1. 设计意图

CLI Pane 是 Operations Orbit 中的“受控执行工作台”。视觉上保留 CLI 的高密度、可扫描和精确感，但交互上不模拟自由 terminal。用户始终看到命令身份、scope、risk、gates、Task 状态和 evidence，而不是只有一块黑色 stdout。

页面问题：

> 我准备执行的命令是否安全、当前是否获准、执行结果是否可信、下一步能否交给 Agent？

## 2. 信息架构

```text
AgentWorkbenchShell
├── AgentConversationSurface
│   ├── CommandSuggestionCard
│   └── CommandResultCard
└── AgentPaneDock / AgentPaneSheet
    └── CliPane
        ├── PaneChrome
        ├── CliCommandToolbar
        │   ├── CommandCatalogCombobox
        │   ├── ScopeBreadcrumb
        │   ├── RuntimeStatus
        │   └── RunHistoryTrigger
        ├── CliCommandDraft
        │   ├── ContextBindingStrip
        │   ├── TypedArgumentForm
        │   ├── ReadOnlyCommandPreview
        │   └── PreflightGateStrip
        ├── CliRunWorkspace
        │   ├── RunStatusHeader
        │   ├── OutputTabs
        │   └── Summary | Console | Events | Artifacts | Explain | Details
        └── CliActionBar
            └── Run | Review | Cancel | Retry | Reconcile
```

不新增第二 composer。Agent discussion 仍发生在 conversation；CLI Pane 只编辑 command intent。

## 3. Pane identity 与管理

- Pane type：`agent.cli.v1`。
- document key：tenant/workspace/session/runtime/scope 的 canonical safe key。
- 同 identity singleton；重复打开 focus existing。
- Pane 内命令切换不创建新 Pane；run history 属于同一 Pane。
- 达到 visible limit 时复用现有 replace chooser；Agent 不能自动替换。
- close 不 cancel；running Task 以 timeline attention 和 CommandResultCard 持续可见。
- scope/runtime 变化打开新 identity；若 current draft dirty，先显示“保留当前 draft / 丢弃并切换”，不把 draft 携带到新 scope。
- desktop 可 move/reorder/split/resize；tablet/mobile 同一时刻一个 Sheet。

## 4. Desktop layout

建议宽度 620px，最小 440px，最大遵循 manifest 960px。conversation 至少保留 560px。

```text
┌──────────────────────────── PaneChrome ────────────────────────────┐
│ CLI  · 发布就绪检查       staging/project-a       ● running  01:24 │
│ descriptor rev …a31f      Host ready · medium risk        [···] [×]│
├────────────────────────────────────────────────────────────────────┤
│ [⌘ Search commands…              ▾] [History 12] [Open evidence]  │
├────────────────────────────────────────────────────────────────────┤
│ Context                                                            │
│ [Project: A] [Release: candidate-42] [Evidence: run-108]            │
│                                                                    │
│ Environment                                                        │
│ [ staging ▾ ]                                                      │
│ Max age                                                            │
│ [ 24h        ]                                                     │
│                                                                    │
│ Command preview                                                    │
│ workbench-readiness  --environment  staging  --json        [Copy] │
│                                                                    │
│ ✓ descriptor  ✓ permission  ✓ version  ○ cost not required         │
├────────────────────────────────────────────────────────────────────┤
│ Summary  Console  Events  Artifacts  Explain  Details              │
│ ┌ status / key facts / effects / next action ────────────────────┐ │
│ └────────────────────────────────────────────────────────────────┘ │
├────────────────────────────────────────────────────────────────────┤
│ intent expires in 09:42                     [Cancel] [Run command] │
└────────────────────────────────────────────────────────────────────┘
```

### Density rules

- PaneChrome 44–48px；toolbar 40px；tab 36px；form field 32–36px。
- 状态/风险使用 small badge，不能做 oversized pill。
- mono 只用于 command ID、revision、ref、preview、facts key；主标签使用 UI sans。
- smoked canvas、restrained borders、低噪声 status color；不使用 gradient、hero、KPI cards 或全屏 terminal black box。

## 5. Command catalog

Catalog combobox：

- section：Recent、Project、Task & Workflow、Diagnostics、Build & Release、Admin（按权限）。
- row：icon、human label、one-line description、effect/risk、availability；stable ID 仅 secondary mono。
- filter chips：scope/effect/availability；不默认暴露 owner/provider 内部名称。
- disabled row 必须解释 `needs_contract`、permission/offline/stale，并给 recovery action。
- Enter 选择；Arrow keys 导航；Esc 关闭并 restore focus；输入法 composition 不触发快捷键。

从项目对象进入时，catalog 可预选 descriptor/context，但服务端仍需 preflight。

## 6. Typed argument form

| Schema type | Control | 约束 |
|---|---|---|
| enum | Select/segmented control | 不允许自由值 |
| boolean | Checkbox/switch | 清楚描述 effect |
| bounded integer/number | Number input | 显示 min/max/unit |
| safe text | Text/textarea | max length、redaction warning |
| object ref | Object picker/chip | 只返回 opaque ref + label |
| artifact ref | Artifact picker | permission/freshness/checksum |
| secret ref | Secret selector | 只显示 alias/availability，不显示值 |
| array | token list/repeater | item schema + max count |

- Required、error、description 不只靠 placeholder。
- Context-bound 参数显示 lock/binding source；用户可以 detach 后重新选择，但不能改 raw ref。
- Change command 时保留同名同类型 safe fields；其余字段明确清除，并 announce。
- 每次字段变化将 prepared intent 标为 dirty；debounce preflight 只做 validation，不自动 Run。

## 7. Preflight gate strip

固定顺序：Descriptor → Scope → Permission → Cost → Version → Runtime → Output contract。

每项状态：pass / attention / blocked / stale。点击展开 Details，显示 human explanation、stable reason、recovery；不显示内部 stack 或 secret。

Primary CTA：

| Condition | CTA |
|---|---|
| ready user-origin | Run command |
| Agent write proposal pending | Review proposal |
| permission gate | Resolve permission |
| cost gate | Review cost |
| stale | Re-run preflight |
| running | Cancel（若支持） |
| failed/partial retryable | Retry incomplete |
| unknown_accept | Reconcile |

## 8. Run workspace

### RunStatusHeader

- command label、Task status、origin `User` / `Agent under grant` / `Proposal accepted`。
- started/elapsed、scope、Task ref（secondary）、receipt state。
- progress 是 event-driven；没有真实 percentage 时只显示 phase/indeterminate，不制造百分比。

### Tabs

1. Summary：status、safe summary、effect、key facts、next action、error/recovery。
2. Console：bounded redacted lines；follow tail toggle；用户滚开后显示“Jump to latest”。
3. Events：timestamp、sequence、type、summary；filter phase/warning/error；virtualized。
4. Artifacts：artifact cards/rows，type/size/checksum/freshness/evidence/open action。
5. Explain：Conclusion、Key evidence、Risk、Confidence、Next action。
6. Details：command/revision、Task/Attempt/trace/receipt refs、output mode/digest、resource usage；raw JSON disclosure。

默认 Summary。失败时自动聚焦错误 heading，但不自动切到 raw Console。新 events 通过 live region 低频聚合 announce，避免逐行朗读。

## 9. History

- Desktop：toolbar popover；Pane >=720px 时可由用户展开为 220px rail。
- Tablet/mobile：drawer。
- row：status icon、command label、relative time、origin、scope short label、attention badge。
- running/unknown/approval attention 置顶，其余按 started time。
- page size 25，server cursor；不一次加载全部 stdout。
- selection 与 draft 分离；选择历史 run 不覆盖未提交 draft。
- context menu：Open result、Open evidence、Copy safe refs、Retry（若允许）；所有 action resolve shared descriptor。

## 10. Agent surfaces

### CommandSuggestionCard

```text
Agent 建议运行：发布就绪检查
Scope: staging / project-a        Risk: medium / read
依据: candidate-42, evidence-run-108
参数: environment=staging, max_age=24h
[Open in CLI] [Run] / [Review proposal]
```

- card 来源必须是 canonical suggestion/proposal ref，不能从 Agent markdown 解析按钮。
- `Open in CLI` 是 presentation activation；Run 仍执行 server validation。
- Agent rationale 限 1–3 句 bounded summary，不展示 chain-of-thought。

### CommandResultCard

- terminal status、summary、2–4 key facts、artifact count、receipt disposition。
- actions：Open CLI run、Open evidence、Use result as context。
- “Use as context” 只加入 safe result/artifact/receipt refs。

## 11. State presentation

| State | Header | Body | Footer |
|---|---|---|---|
| loading | skeleton title/status | schema skeleton + 4 rows | disabled action |
| empty | CLI icon + “选择命令” | catalog prompt | Open catalog |
| needs_contract | muted unavailable | required contracts list | View details |
| permission_required | amber badge | scope/role explanation | Resolve permission |
| stale | stale badge | retained draft + diff summary | Re-preflight |
| offline | offline badge | runtime diagnostic + last known | Retry readiness |
| queued | queued phase | queue-safe explanation | Cancel if supported |
| running | live phase | current tab + event cursor | Cancel |
| partial | partial badge | success + blockers | Retry incomplete |
| failed | error badge | stable error + trace/recovery | Retry/Fix |
| unknown_accept | warning badge | uncertainty + receipt refs | Reconcile |
| output_truncated | normal terminal state + notice | tail + artifact link | Open artifact |

Unavailable 不能只放一张悬空卡；仍显示 form/result 的结构 placeholder，帮助用户理解缺失位置。

## 12. Responsive reductions

### 1024–1439px

- conversation 常驻；CLI 为 520–720px right Sheet。
- session rail 与 Pane Sheet 互斥。
- history drawer，不展开 rail。
- tab strip horizontal scroll；Summary/Events/Artifacts 优先，Console/Details 进入 More。

### <768px

- full-screen Sheet；44px header + scroll body + sticky footer。
- context chips horizontal scroll；form 单列。
- output tabs 为 select/segmented scroll，不缩小字体。
- raw JSON/Console 默认 collapsed；artifact row 转 label/value record。
- running command 退到 conversation 后仍显示 compact activity banner。

## 13. Keyboard 与 accessibility

- `Cmd/Ctrl+K`：Pane/command palette。
- `Cmd/Ctrl+Enter`：ready intent Run；若需 confirm，打开 dialog；multiline 内保留换行语义。
- `Shift+F10`：当前 command/run context menu。
- Tab order：PaneChrome → catalog/scope/history → form → gate strip → output tabs/content → action bar。
- error summary 在 form 顶部提供 links 到字段；字段使用 `aria-describedby`。
- status chip 含文本；icon `aria-hidden`；风险不只用红黄绿。
- dialog/Sheet trap focus；desktop complementary Pane 不 trap。
- Escape 绝不等价于 cancel command。
- prefers-reduced-motion：关闭 tab slide/event pulse，仅保留即时状态变化。
- drag/move/resize 有 menu/keyboard parity 和 live announcement。

## 14. Performance budgets

- Catalog 首屏 ≤100 descriptors；更多 cursor/filter server-side。
- live event DOM ≤500 rows；总事件 cursor pagination，overscan bounded。
- Console live buffer 默认 ≤256 KiB/2,000 lines；超限 spill artifact。
- 单行渲染前截断 ≤16 KiB；移除 ANSI/control sequence。
- Pane open 不新建额外 event subscription：复用 selected Task watcher，切 tab 不重订阅。
- hidden/suspended Pane 只保留 safe summary/cursor，不保留大数组。

## 15. Visual QA snapshots

固定截图至少覆盖：

1. desktop empty catalog；
2. desktop ready typed command；
3. desktop Agent write proposal；
4. desktop running events；
5. desktop unknown_accept + Reconcile；
6. desktop output truncated + artifact；
7. tablet right Sheet；
8. mobile full-screen Sheet；
9. 200% zoom；
10. dark/light tokens（若当前产品支持两套主题）。

同时验证 keyboard-only flow、focus restore、screen-reader labels、reduced motion 和 no-horizontal-page-scroll。

