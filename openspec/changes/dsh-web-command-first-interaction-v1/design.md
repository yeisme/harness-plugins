## Context

### 当前状态

DSH Web 已经存在完成度较高但彼此割裂的交互单元：

| 能力 | 当前 owner / surface | 当前缺口 |
| --- | --- | --- |
| slash 实时目录与 P0 命令 | `command-experience-core` + 官方 commands runtime | `/` 与全局菜单未形成同一条 Composer 主路径 |
| Web Command Menu / selector / confirm / receipt | `ui-command-experience-web` | 主要以 Modal 呈现，选中后行为差异不够可见 |
| Session Hub、model/preset/reasoning/permissions | DSH owner actions | 当前值与 Composer 距离远，命令和按钮互不解释 |
| 下一步建议 | `ui-next-step-suggestions` | 常驻 Dock 信息量偏大，容易与命令菜单竞争 |
| token usage / balance | `dsh-token-usage` + `ui-token-usage` | 是进程账本，不等于当前上下文容量，也没有 Provider 周期限额/reset |
| Pane Workbench | `ui-pane-workbench` | 已具备 preview/pinned 基础，但 command result 未统一使用该生命周期 |
| durable command events | 官方 `command/run|done` | 缺少统一 Activity 读取与恢复入口 |

用户提供的 Codex 状态截图只作为信息层级参考：会话身份、上下文余量、周期限额和 reset time 在一个安静表面里可快速扫描。DSH 不复制截图的具体字体、颜色或像素值；本地 `ui-visual-kit`、`ui-surface` 和 DSH primitives 仍是唯一视觉权威。

### 产品准入与 capability ledger

| 能力 | 准入 | canonical owner | 本 change 责任 |
| --- | --- | --- | --- |
| slash / Palette presentation | `fit` | Harness client UI；目录仍由 commands owner 提供 | 双入口投影、排序、焦点与状态机 |
| session/model/preset/permission mutation | `split-owner` | DSH owner actions | 只触发 typed action 并渲染 receipt |
| context used/limit/remaining | `split-owner` | DSH tokenMeter + model/runtime owner | Host 安全投影；浏览器不估算 |
| Provider quota/reset | `split-owner` | Provider/runtime owner | 只渲染 owner-provided bounded windows |
| token history / balance | `fit` | 现有 dsh-token-usage | 复用并从状态详情深链，不改账本语义 |
| command Activity | `fit` | 官方 session command events | 只读 timeline/Pane，不建第二日志 |
| Pane layout / preview / pin | `fit` | Pane Workbench | 使用公开 `openView()`，不读 reducer 私有状态 |
| 自由插件命令 handler | `split-owner` | 各插件 / commands runtime | 目录只投影 descriptor，不复制 handler |
| raw prompt、provider payload、credential、绝对路径 | `reject-now` | owner 私有边界 | 不进入 wire、DOM、日志或证据 |
| Codex 像素级复刻、纯 Chat-first 重构 | `reject-now` | 无 | 明确非目标 |

### 约束

- 插件不得 patch DOM、vendoring DSH core 或创建第二个 session/task/runtime owner。
- `token.usage.snapshot.v1alpha1` 保持“进程级消费账本”语义；不能用其累计总量推导当前 context remaining。
- 现有 `token-usage-open`、`workspace.token-usage`、命令 descriptor、Pane `openView()` 和插件 hotplug 行为保持兼容。
- 官方 seam 缺失时必须 probe-first、fail-visible；上游需求只进入 `upstream-prs/` 通道。
- Open Design 当前解析到 compatibility wrapper，不作为原生设计证据；设计以仓库实现和用户参考图为准。

## Goals / Non-Goals

**Goals:**

- 让高频会话动作在 1–2 次可预测交互内完成，且鼠标与键盘路径语义一致。
- 形成一条完整交互主干：发现 → 参数 → 确认 → dispatch → 即时反馈 → durable Activity → Pane handoff。
- 让 `/` 与 `Ctrl/Cmd+K` 使用同一目录和 reducer，而不是维护两套命令真源。
- 让当前会话的身份、运行配置、context remaining、Provider limit/reset 和恢复动作可在三秒内扫描。
- 保持复杂工具的 Pane 优势：命令是入口，Pane 是深度操作区。
- 为 unavailable/stale/partial/permission-denied 提供明确原因和恢复路径。
- 保持视觉克制、语义 token、低干扰 motion、完整 focus/reduced-motion 行为。

**Non-Goals:**

- 不删除、重命名或静默 repurpose 现有 slash、Tokens、Pane 或 Remote surface。
- 不把每个插件命令都提升为一等常驻控制；目录仍按上下文和 capability 收敛。
- 不在浏览器计算 tokenizer、Provider 配额或 session canonical state。
- 不把所有 command result 写进模型对话历史，也不让 Toast 成为唯一 receipt。
- 不在 V1 同时迁移工作区工具与 Agent/Ordo 全部命令族；第一批只验会话与上下文主路径。
- 不新增 cmdk、Motion 或另一套 design system 依赖；复用现有 primitives。

## Decisions

### 1. 采用命令优先的混合壳

```text
User input / shortcut
        │
        ├─ type "/" ───────► Composer Slash Assist
        │
        └─ Ctrl/Cmd+K ─────► Global Command Palette
                               │
                    shared live command directory
                               │
                      structured command draft
                               │
                 selector / argument / confirmation
                               │
                     owner action or local inspect
                               │
             inline receipt ──┼── durable Activity
                               └── Pane preview → Pin
```

Composer 是 session-scoped 高频入口；全局 Palette 承担跨 Pane、跨工具和完整搜索。二者只改变 presentation scope，不改变 command identity、availability、danger、selector、receipt 或 handler owner。

替代方案“所有命令都放 Modal”会打断输入；“所有命令都只在 Composer”会削弱跨 Pane 导航与全局发现，因此拒绝。

### 2. 一份目录，两种排序投影

两种入口消费同一 revisioned directory snapshot。排序必须确定性：

1. exact canonical/alias match；
2. 当前上下文可执行且与 active session/surface 匹配；
3. 当前 session 的最近成功命令（最多 5 个，仅从 durable command events 派生）；
4. descriptor `order`、稳定 category、canonical name。

Composer assist 默认显示最多 8 行，优先会话/模型/当前 Pane 命令；全局 Palette 显示完整分组并提供搜索。不可用命令保持可见并附原因，不因排序而隐藏。第一次 `/` 发现继续保持 no-RPC。

### 2.1 当前 P0 命令族全部进入新壳，首批 8 条只是实现焦点

新壳不得把“first-support”误解为“只剩 8 条命令”。当前 `P0_SEEDS` 的 canonical command 与 alias 全部继续由 live directory 投影：

| 类别 | 当前 canonical command / alias | 新壳中的默认形态 |
| --- | --- | --- |
| discovery | `/help` (`/h`, `/?`)、`/commands`、`/status`、`/plugins`、`/mcp`、`/skills`、`/pane`、`/explorer` (`/files`)、`/git` | 帮助/搜索、只读 inspect 或 Pane navigation；缺 surface 时保留 disabled reason |
| session | `/agent` (`/agents`, `/subagents`)、`/resume` (`/r`)、`/session` (`/sessions`)、`/archive`、`/delete`、`/new`、`/fork`、`/rename` | selector、typed owner action、preview/confirmation 与 receipt |
| model | `/preset`、`/model`、`/reasoning`、`/permissions` | 与 Composer controls 共用 selector 和 owner action |
| work | `/compact`、`/plan`、`/goal`、`/diff`、`/review`、`/mention` | current-session action、inspect 或 Pane preview |
| lifecycle | `/copy`、`/feedback`、`/init`、`/logout`、`/quit` (`/exit`) | local action 或 owner action；`/init` 继续显示 not-applicable 解释 |

V1 浏览器完成门聚焦 `/status`、`/session`、`/new`、`/fork`、`/rename`、`/compact`、`/model`、`/permissions`，因为它们可覆盖 inspect、selector、argument、safe、confirm、receipt 和状态联动。其余 P0 必须通过目录/兼容回归，保持原 `coverage`、owner 与可用性语义；不得为了减少 UI 数量而隐藏 staged、conditional 或 not-applicable 行。

`/clear`、`/side`、`/btw`、`/usage`、`/debug-config`、`/theme`、`/statusline` 仍是既有账本中的 P1 候选，不属于本 change 的实现承诺。未来进入 P0 时继续走同一 descriptor、owner 与证据门，不在 UI 中预埋无 handler 的可点击占位。

### 2.2 命令行必须在执行前解释“会发生什么”

Slash Assist 的紧凑行至少显示 canonical name、短 description 与一种关键状态（shortcut、selector、confirm 或 disabled reason）。Palette 与 `/help <command>` 可展开同一 derived detail：

```ts
interface CommandDetailProjectionV1 {
  canonicalName: string
  aliases: readonly string[]
  description: string
  category: string
  inputHint?: string
  actionKind: 'local' | 'inspect' | 'navigation' | 'owner-action'
  owner: 'client' | 'dsh' | 'host'
  danger: 'safe' | 'confirm' | 'destructive'
  availability: { state: 'available' | 'disabled' | 'hidden'; reason?: string }
  coverage: 'equivalent' | 'adapted' | 'staged' | 'conditional' | 'not-applicable'
  expectedPresentation: 'inline' | 'selector' | 'popover' | 'pane-preview' | 'dialog'
}
```

该 projection 只能由现有 descriptor、capability probe 和本地 presentation mapping 派生；不能携带 handler、动态 import、远程 URL、raw owner payload 或 credential。命令详情不是新的执行合同，只用于帮助用户预判参数、风险、owner 与结果去向。

### 3. 命令草稿是 UI composition state，不是新的命令合同

客户端增加纯 reducer 状态，不持久化 raw args：

```text
idle
  → assist
  → selected
  → argument | selector
  → confirmation-inline | confirmation-blocking
  → dispatching
  → receipt-pending
  → receipt-success | receipt-error
  → idle
```

`CommandDraftV1` 只保存 canonical command id、当前步骤、safe selected refs 和用户仍可见的 draft 文本。它不进入 localStorage、Pane persistence 或 owner request；dispatch 时继续由现有 adapter 构造 typed request。

Escape 逐层回退：关闭 nested selector → 回到 selected command → 恢复原 Composer draft → 关闭 assist 并把焦点还给 Composer。Enter 只执行当前明确步骤；歧义前缀、disabled item 和缺参数状态均不得 dispatch。

### 4. 风险确认采用三档矩阵

| danger | 行为 | 键盘 | 示例 |
| --- | --- | --- | --- |
| `safe` | 参数完整后立即 dispatch | Enter | `/status`、`/session switch`、`/model` |
| `confirm` | Composer 上方 inline confirmation，显示 target/effect | `Ctrl/Cmd+Enter` 确认，Escape 取消 | `/fork`、`/compact`、`/archive`、`/permissions`、`/logout`、`/quit` |
| `destructive` | owner preview + receipt capability 必需；AlertDialog 明确确认 | 裸 Enter 不确认 | `/delete` |

任何 stale/unknown/permission-denied/preview-missing 状态都 fail closed。插件不得把 destructive descriptor 降级为 safe，也不得自行递归删除。

### 5. 即时 receipt 与 durable Activity 分层

- `dispatching/pending` 固定显示在 Composer receipt lane，防止重复提交。
- `success` 保留 4 秒后折叠为 Activity affordance；用户 hover/focus 时暂停折叠。
- `error/partial/stale` 保持可见，直到用户 dismiss、retry（仅 owner 明确允许）或打开恢复路径。
- durable Activity 只读取官方 `command/run|done` 事件，按 current session 展示状态、canonical command、safe summary、reason code、receipt/evidence ref 和 next action。
- command result 永不作为 user/assistant message 注入模型；需要富内容时打开 Pane。

Activity 使用 `workspace.command-activity` singleton navigator Pane。不存在 Pane seam 时，点击 Activity affordance 打开 bounded dialog fallback；关闭后零渲染。

### 6. command result 默认进入 preview Pane

inspect/navigation command 的 result descriptor 可声明 `presentation.viewKind`、safe `resourceKey` 和 preferred region。shell 只调用公开 `paneWorkbench.openView()`：

- 默认 `retention: preview`，复用当前 group 的 preview Tab；
- 用户在 Pane 内编辑、执行 mutation、拖拽或显式 Pin 后提升为 pinned；
- 同一 singleton/resourceKey 复用已打开 view；
- Pane 缺失时显示 bounded fallback，不伪造 docking。

command shell 不读取 Pane layout、split tree 或 active group 私有状态。

### 7. 新建独立的 session status 安全投影

不扩张 `tokenUsage` 为万能接口。新增 Host Remote `sessionStatus`，V1 只读当前指定 session：

```ts
interface SessionStatusSnapshotV1 {
  schemaVersion: 'session.status.snapshot.v1alpha1'
  revision: number
  generatedAt: string
  freshness: 'fresh' | 'stale' | 'unknown'
  status: 'ready' | 'partial' | 'unavailable'
  session: {
    sessionRef: string
    label: string
    lifecycle: 'idle' | 'running' | 'waiting_approval' | 'error' | 'offline' | 'unknown'
  }
  runtime?: {
    providerId?: string
    modelLabel?: string
    presetLabel?: string
    reasoningLabel?: string
    permissionLabel?: string
  }
  context: {
    status: 'ready' | 'stale' | 'unavailable' | 'unsupported'
    usedTokens?: number
    limitTokens?: number
    remainingRatio?: number
    updatedAt?: string
    source: 'token-meter' | 'owner-projection' | 'none'
    safeMessage: string
  }
  limits: readonly {
    id: string
    label: string
    scope: 'rolling' | 'calendar' | 'account' | 'unknown'
    status: 'ready' | 'stale' | 'unavailable' | 'unsupported'
    remainingRatio?: number
    resetAt?: string
    safeMessage: string
  }[]
}
```

约束：

- `snapshot({ sessionRef })` 必须校验 safe opaque ref；返回 bounded label、最多 4 个 limit window。
- context 必须来自官方 tokenMeter/model context metadata 或明确 owner projection；Host 可做纯算术归一化，但浏览器不得从 process ledger 猜测。
- Provider limit/reset 只接受 owner adapter 的明确投影；余额金额不等于 remaining ratio，二者不得互相推导。
- 缺任一来源时保留 partial/unavailable 与 safeMessage；不得填 0、100% 或虚构 reset time。
- wire 禁止 raw prompt、provider payload、credential、URL、absolute path、PID、private tool arguments 和完整 reasoning。

### 8. 状态中枢使用一份 view model、三层表面

```text
Session Header
┌──────────────────────────────────────────────┐
│ session title       [● Context 88%]          │
└──────────────────────────────────────────────┘
                              │ click / /status
                              ▼
┌──────── Session status popover (360–400px) ─┐
│ session ref                         Copy     │
│ model · preset · reasoning · permissions    │
│ Context   ███████████████░░  88% remaining  │
│ 7-day     ██████░░░░░░░░░░  34% · Sep 7    │
│ [Compact] [Model] [Permissions] [Details]   │
└──────────────────────────────────────────────┘
                              │ Details
                              ▼
                 workspace.session-status Pane
```

- capsule 优先显示需要用户处理的 lifecycle（approval/error/offline），否则显示 context remaining；unknown 不使用 positive tone。
- Popover 只显示 current session、runtime summary、context、最多 2 个最相关 limit 和 4 个 quick action。
- details Pane 展示全部 bounded limits、freshness/source、现有 token usage detail 入口和 current-session Activity deep link；不复制历史账本。
- `/status` 执行 owner inspect 并打开同一 Popover；Header seam 缺失时降级为 details Pane，再缺失则返回安全文本 result。
- 现有 `token-usage-open` 与 `workspace.token-usage` 保持原行为，作为完整消费账本和余额详情入口。

### 9. context warning 是渐进式、非阻断 UI policy

- `remainingRatio > 0.25`：neutral；
- `0.10 < remainingRatio <= 0.25`：warning，并在建议区加入 `/compact`；
- `remainingRatio <= 0.10`：critical，保留 `/compact` 与“查看详情”，但不自动 compact；
- unavailable/unsupported：neutral unknown + safeMessage；
- 仅真实 owner error 可以产生 blocking error，普通阈值变化不得弹 Modal。

阈值只影响 presentation；compact 是否可用仍由 command availability 决定。

### 10. Composer controls 与建议共用一条低噪声 dock

桌面 Composer footer 常驻 model/preset、reasoning、permissions 当前值；点击打开与 slash selector 相同的数据与 reducer。宽度不足时保留 model + permissions，其余进入 overflow；所有控制仍能通过 slash 到达。

下一步建议只在 `turn/end` 且 Composer draft 为空时显示 1–3 个 chip：点击仅写入草稿；用户开始输入、切 session 或执行命令即收起。现有多选/并行能力放进“展开建议”，不得常驻争夺首屏。

### 11. 视觉、响应式与 motion 使用现有系统

- posture：engineering tool、calm、compact、low-saturation、non-marketing。
- 字体：现有 UI font；session ref、token count、shortcut 使用现有 mono token。
- spacing：4/8/12/16/24；普通 radius 6–8px；Popover/Palette 可用 10px，不新增胶囊泛滥。
- color：只用 `ui-visual-kit` semantic background/border/text/tone；状态必须同时有文字/shape/ARIA。
- motion：120–180ms opacity + 最多 8px translate；支持 `prefers-reduced-motion`；无 bounce、glow、layout shift。
- 1024px+ 使用 anchored assist/popover + right Pane；768–1023px Palette 可居中、status details 用 right Sheet；<768px 所有 overlay 全宽、控制 hit target ≥44px、Pane details 用全屏 Sheet。

### 12. ownership 与 package 组织

| 模块 | 责任 |
| --- | --- |
| `command-experience-core` | 纯目录投影、context ranking、CommandDraft reducer、键盘意图 |
| `ui-command-experience-web` | Composer assist、Palette、selector、confirm、receipt lane、Activity adapter |
| `dsh-session-status` | Host safe snapshot、来源 probe、revision/freshness、redaction |
| `ui-session-status` | capsule、Popover、Pane、context warning view model |
| `ui-token-usage` | 继续拥有消费账本/余额详情；只被深链或组合，不改语义 |
| `ui-next-step-suggestions` | 提供 1–3 suggestion projection 与展开面 |
| `ui-pane-workbench` | preview/pin/open lifecycle；不接收 command canonical state |
| `dsh-command-experience` bundle | 组合以上 units；缺任一 optional seam 时逐项降级 |

## Risks / Trade-offs

- [官方 Composer/Status seam 不完整] → 每个 surface 单独 capability probe；旧 Modal、Tokens、safe text result 保留为真实 fallback；需要 core seam 时走 `upstream-prs/`。
- [两个命令入口产生状态漂移] → 目录/reducer/keymap 只在 core 定义一次；Web 仅传 presentation scope。
- [状态百分比误导用户] → context 与 quota 分开建模，要求 source/freshness/safeMessage；未知永不显示绿色或伪 0/100。
- [Header 新胶囊与 Tokens 按钮重复] → V1 保留兼容入口；视觉上将 Tokens 降为 detail action，但不删除。任何移除必须另开 deprecation change。
- [Activity 与对话流重复] → result 不进入模型消息；Activity 只读 command events，Composer 只显示短生命周期 receipt。
- [上下文排序不稳定] → 固定排序优先级和 tie-break；recent 只取 current session durable events，不引入隐式个性化。
- [Popover/Palette/Panes 争夺焦点] → nested overlay 优先处理 Escape，关闭后精确返回 trigger/Composer；组件测试覆盖完整键盘旅程。
- [首批范围继续膨胀] → V1 只把会话/上下文命令做成 first-support；工作区工具与 Agent/Ordo 只接共享壳，不作为 V1 完成门。

## Migration Plan

1. 先添加纯 core reducer/ranking 与新 `session.status.snapshot.v1alpha1` types/tests，不改变现有入口。
2. 添加 Host status Remote 与 Client status surfaces；所有来源 optional，默认 unavailable。
3. 在 capability gate 后启用 Composer slash assist、全局 Palette 与 receipt lane；旧 Command Menu 保留 fallback。
4. 接入 first-support 命令：`/status`、`/session`、`/new`、`/fork`、`/rename`、`/compact`、`/model`、`/permissions`。
5. 接入 Activity Pane、Pane preview/pin、建议 chip 和 responsive substitution。
6. 通过 fixed viewport screenshot/interaction evidence 后，才允许其他命令族迁移。

回滚：移除/禁用新增 bundle units 或 capability flag。旧 command menu、Tokens button、`workspace.token-usage`、Pane `openView()` 与 owner action adapters 不变，因此无需数据迁移或 reverse migration。无 deprecation window；本 change 不移除旧 surface。

## Verification

- core：目录排序、CommandDraft 状态机、keymap、danger gate、Escape draft restore 的纯测试。
- component：Composer assist、Palette、selector、inline confirm、AlertDialog、receipt lane、suggestion chips、status capsule/Popover/Pane 的 loading/empty/error/disabled/stale 测试。
- contract：Host/Client status wire parity、strict redaction、bounded limits、安全 refs、旧 token usage shape 保持不变。
- integration：真实 commands runtime + session event + Pane fake/real seam，验证 result 不进入模型历史、Activity 可恢复、preview 可 Pin。
- browser：1440×960、1024×768、390×844；覆盖 slash open、Palette、status Popover、warning/critical、destructive confirmation、Pane fallback、reduced motion 和 focus return。
- evidence：每次 integration/e2e 写入 `temp/integration-test-runs/<run-id>/`，保留 summary、command、stdout/stderr、env 与 screenshots，按仓库规则脱敏。

## Open Questions

无产品决策待定。官方 tokenMeter/context metadata 与 Provider limit adapter 的具体可用方法属于实施期 capability probe；probe 结果只决定 ready/unsupported/fallback，不改变本设计。
