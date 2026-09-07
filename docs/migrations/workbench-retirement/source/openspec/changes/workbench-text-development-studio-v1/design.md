## Context

Workbench 的 `/agent` 已是唯一主入口，左侧 Agent/Chat、中央 Document Dock、右侧 Context rail 和 Proposal Authority 均已存在。`workbench-agent-chat-canvas-convergence-v2` 正在收敛真实 Conversation Runtime，`workbench-auctra-screenplay-room-v1` 已提供剧本 Lens 原型。当前缺少的是长期文本开发所需的通用 editor document、Working Copy 状态、选区 Agent、candidate compare、场景 Lens 与 Ordo Team control UI。

Text Development 必须是现有 Shell 内的 `domain-lens`，不是新的 `/studio` 主壳。Browser 只消费 server-authored projection/action；Auctra 保持正文 owner，Conversation Runtime 保持 Pi/Context/search owner，Ordo 保持 Team owner。

## Goals / Non-Goals

**Goals:**

- 在一个持续挂载的 Shell 中完成写作、选区 Agent、candidate 审阅、Checkpoint、结构编辑和 Team Plan。
- 以 source-preserving WYSIWYM 支持 Markdown、plain text、Fountain，不引入另一份富文本 document model。
- 小说达到 60 分钟可日用；剧本复用 Screenplay Room；自媒体具备共享合同和 fixtures。
- 全部 mutation 通过 WorkbenchClient/BFF/Task或Proposal/Owner receipt，状态 truthful、可恢复、可审计。

**Non-Goals:**

- 不创建独立 Studio route、第二个 docking engine、browser-local capability 或 owner 私有 iframe。
- 不让 Agent 自动写 Canon、自动 checkpoint、自动接受 review 或运行多个重叠 writer。
- 不在首版提供多人实时协同、移动端完整编辑、任意画布节点或任意用户脚本。
- 不在 Workbench 内实现 provider、web crawler、Pi adapter、Auctra persistence 或 Ordo scheduler。

## Decisions

### 1. Text Development 是 registered domain-lens document

新增 `agent.text-development.v1alpha1` document kind，由现有 Pane/document registry、layout reducer、UnifiedSurfaceFrame 与 context rail 承载。它可以成为中央主文档，但不计作第二个 shell；桌面可与 Review/Evidence/Run Pane 分屏，继续遵守最多 4 Pane、split depth ≤ 2。

布局姿态：

- `Create`：Agent rail 使用现有 compact width token；Document Dock 为主；Context rail 保持标准宽度。
- `Collaborate`：Agent rail 使用现有 expanded width token；Document Dock 打开 compare/Team Plan；Context rail 保持原区域。
- 切换只 dispatch 既有 layout reducer action，不改变 document/session/Task/owner subscription identity。

### 2. Editor 使用 CodeMirror 6 最小组合

首版依赖仅包括 `@codemirror/state`、`@codemirror/view`、`@codemirror/commands`、`@codemirror/lang-markdown`。Plain text 使用基础 state；Fountain 使用项目内轻量 line decoration/diagnostic，不引入完整富文本框架或第二个 AST owner。

Editor state 只保留当前 viewport buffer、selection、undo history 和 pending client patch。Auctra projection 包含 `workingCopyRef`、`unitRef`、`format`、`revision`、`contentDigest`、`body`、`lineEnding`、`checkpointRef?`、`allowedActions`。非显式 document-open projection 不得携带正文。

Autosave 在最后输入 750ms 后发送增量 patch，并在 blur、document switch 和受控 unload 前 flush。UI 状态固定为 `saved | saving | unsaved | conflict | offline | recovery_required`；只有 owner receipt 才能显示 saved。Auctra unavailable 时可保留内存 buffer并明确 unsaved，但不写 IndexedDB/localStorage 形成第二份持久化正文。

### 3. Workbench SDK 使用 additive text client

在既有 `WorkbenchClient` 增加 `readonly textDevelopment: WorkbenchTextDevelopmentClient`，不修改其它 client 签名。主要方法：

- `openWorkspace`、`openWorkingCopy`、`watchWorkingCopy`
- `applyHumanPatch`、`createCheckpoint`、`submitCheckpoint`
- `listCandidates`、`compareCandidate`、`acceptCandidate`、`rejectCandidate`
- `applyStructureIntent`
- `getEgressReceipt`
- `previewTeamPlan`、`simulateTeamPlan`、`startTeamRun`、`cancelTeamRun`、`reconcileTeamRun`

所有 mutation request 含 exact owner refs、expected revision/digest、idempotency key 和 server-issued action/approval ref。Transport/SDK 对 unknown field、unsafe URL/path、raw credential/provider/process input fail closed。

### 4. Selection-first 由精确 anchor 驱动

`TextSelectionAnchorV1alpha1` 绑定 `workingCopyRef + unitRef + revision + contentDigest + fromUtf16 + toUtf16 + selectedDigest`。默认操作为 `Ask`、`Rewrite`、`Polish`、`Add to context`；Profile 可追加最多四个由 server manifest 提供的 Lens action。按钮不得从 prompt 文本或 client capability hint 动态生成。

`Ask`/`Rewrite`/`Polish` 先将 anchor 与当前 Working Set 交给 Conversation Runtime seal turn intent；`Add to context` 只更新 pending selection，仍需用户显式 prepare/refresh Context Pack。

### 5. Candidate review 按影响范围自适应

- `inline_patch`：单文档小范围，editor decoration + hunk accept/reject。
- `document_candidate`：大范围或全文，中央 split compare，可切换 source/rendered view。
- `atomic_change_set`：跨文档或结构变更，Review Pane 显示成员、依赖和整体 accept；禁止 partial apply，除非 owner contract 明确提供新的派生 change-set。

Accept 经 Proposal Authority/TaskService 调用 Auctra `candidate.apply`，只更新 Working Copy。stale candidate 禁用 accept并要求 refresh/rebase。`unknown_accept` 只显示原 operation reconcile。

### 6. Structure Lens 只发送 typed intents

共享 Lens：Document、Outline、Entities、Materials、Review。Novel 增加 Timeline/Foreshadowing；Screenplay 复用双 Timeline/Scene/Beat；Self-media 增加 Brief/Claims/Channel Checks。拖拽只产生 server-declared intent，例如 `outline.move`、`timeline.event.move`、`entity.relation.upsert`、`foreshadowing.link`、`scene.move`、`claim.source.link`，并在 owner receipt 前保持 pending ghost。

### 7. Context、Profile 和 egress 可见但不重复授权

Profile Sheet 分开显示 Role、Mode、Model Profile、Permission Profile。Project-full scope 在项目级确认后覆盖普通 read/chat；Working Set 显示 must-use refs 和 retrieval preview。每个 turn 结束后，Context rail 展示 source-labelled egress receipt：使用的 refs/ranges/count、model/tool profile、token/cost 和限制，不展示 raw prompt/provider payload。

Profile 层级为 user default → project override → session narrowing，deny wins。`plan` mode 禁用所有 mutation。切换按钮在 idle 时直接确认新 Profile/Grant；active 时执行 revoke → cancel → known outcome → continuation。unknown/mutation pending 时按钮变为 reconcile-only。

### 8. Team UI 是 Ordo projection/control 的薄壳

默认模板：`solo-assist`、`novel-sprint`、`screenplay-pass`、`self-media-pack`。Advanced override 只编辑 Ordo schema 允许的 role slots、mode/model profile refs、permission profile、Context、预算和依赖；Workbench 不允许任意 runtime id、command 或 prompt body。

Team Plan 在中央 compare surface 呈现角色/依赖图、预计成本、输出物、risk 和唯一 writer。一次批准后由 Ordo start；simulation 使用明显的 `simulated` 状态，real canary 使用 `experimental-real`，缺 key/readiness 时 truthful blocked。

### 9. Deterministic 与 AI checks 分层

每次 owner-confirmed patch 后自动运行确定性检查：编码/格式、source parse、broken refs、重复 ID、结构不变量。AI 检查只在项目 Profile 触发条件、Checkpoint 或用户手动运行时调用，用于连续性、角色声音、伏笔、claims/source 与渠道约束；结果是 findings/candidate，不是 hard Canon gate。

### 10. 性能策略

目标 fixture 为 100 万中文字、约 500 章、数千实体。Browser 只挂载 active document、当前 compare 和虚拟化 outline/entity/timeline；全文搜索与 context compilation 在 owner/runtime 完成。禁止每次 keystroke 序列化全书、重算全图或把整项目正文放入 Workbench Task/event/evidence。

### 11. 四个 Context deck 取代八个平级标签

Text Development 不把 Document、Outline、Entities、Materials、Review、Version、Context、Profile、Evidence 和 Team 全部放成一排标签。右侧只保留四个稳定 deck：

| Deck | 内容 | 默认出现条件 | 不承担 |
| --- | --- | --- | --- |
| `Structure` | Outline、Entities、Materials 与场景 Lens | 文档已打开 | Review decision、Team run |
| `Review` | candidates、findings、comments、decision 与 impact | 有 candidate/finding 或用户打开 | Canon truth、自动接受 |
| `Versions` | Working Copy、Checkpoint、ReviewItem、Canon 与 recovery | 文档已打开 | browser-local 版本历史 |
| `Team` | Profile、Plan、simulation、run、evidence | Ordo descriptor 存在 | scheduler、writer authority |

Project access、Working Set 与 actual egress 是 Agent conversation 的 context disclosure，继续放在 shared Context/Inspector 的固定分区，不与领域 Lens 竞争第五个 deck。手机和平板把 deck 变成有标签 Sheet，阅读顺序和 action identity 不变。

### 12. 组件准入按“复用、局部组合、晋级”三层处理

新 UI 先复用现有 design system，不为 Text Development 创建第二套 atoms：

| 需求 | 直接复用 | 允许的 feature-local composition | 何时晋级全局 composite |
| --- | --- | --- | --- |
| 标题、状态、技术元数据 | `SurfaceHeader`、`StatusChip` | `WorkingCopyStatusStrip` | 第二个非文本领域也需要相同版本晋级语法 |
| loading/empty/error/recovery | `SurfaceSkeleton`、`SurfaceEmptyState`、`StatusBlock`、`ActionRecovery` | 无 | 不新增同义组件 |
| 选区动作 | `Button`、`IconButton`、`Popover`、`DropdownMenu`、`Tooltip` | `TextSelectionActionBar` | 不晋级，除非其它编辑器复用同一 anchor contract |
| candidate diff | `Tabs`、`Button`、`EvidenceBlock` | `TextCandidateReview` | inline/split/unified diff 被 Screenplay、CLI、Replica 至少两个面复用时晋级 `DiffView` |
| 版本链 | `PaneToolbar`、`StatusChip`、`DataState` | `TextVersionLedger` | 仅在其它 owner 也具有 Working Copy→Checkpoint→ReviewItem→Canon 语法时晋级 |
| Team Plan | `InspectorLayout`、`Tabs`、现有 read-only React Flow/workflow subgraph | `TextTeamPlanSurface` | Ordo 通用 consumer 形成第二个真实调用方时再抽象 |

全局 composite 不持有 Auctra、Conversation Runtime 或 Ordo 状态。Feature-local composition 使用 discriminated union 表达状态，不能靠成组 boolean props 形成隐式状态机。Text Development 不得增加 design-system registry 外的直接 `lucide-react`、私有 palette、裸 Radix import 或新 modal/focus trap。

### 13. 布局权重由有效宽度决定，不固定扩张 Agent rail

`Create`/`Collaborate` 只改变默认权重，不能让三栏在 1440px 互相挤压：

| 有效宽度 | Create | Collaborate | Context/Session |
| --- | --- | --- | --- |
| `>=1536px` | Chat 360–400；Document flex；Context 336–360 | Chat 380–420；compare/Team 主文档 min 640；Context 360 | 三域可见，Session drawer 可 pin |
| `1280–1535px` | Chat 340–380；Document min 640 | Chat 不再扩张；Team/Review 使用中央 document，Context 320–344 | Context 可折叠但不静默消失 |
| `1024–1279px` | Chat + active document | Chat + compare/Team document | Context 与 Session 互斥 Sheet |
| `<1024px` | Chat + labelled document/review Sheet | Chat + Team/review Sheet | editor 只读，结构拖拽 desktop-required |

Document prose viewport 默认保持约 72–88ch 的可读行宽；Markdown/plain text 正文至少 16px，Fountain 使用现有 mono token。外围 UI 继续使用 Workbench type scale，不因“写作产品”引入独立品牌字体或大标题。

### 14. 长时间使用优先安静保存与可恢复性

- `saving` 只在 400ms 以上等待时持续显示，避免每次键入闪烁；`saved` 更新为低强调文本，不弹 success toast。
- screen reader 的保存播报节流，只播报 `saved`、`conflict`、`offline`、`recovery_required` 等阶段变化，不播报每个 patch。
- 未确认 buffer、owner-confirmed Working Copy、Checkpoint 和 Canon 必须同时有文字标签，不能只靠绿/黄/红或图标区分。
- selection action bar 不夺走编辑器选区；Escape 先关闭 action bar，再由第二次 Escape 交还上层 Sheet/Dialog。
- candidate accept、Checkpoint、Submit Review 和 Team Start 在同一 surface 默认最多一个视觉 primary action；其它动作降为 secondary/overflow。
- 任何 posture、deck、compare 或 Team Plan 切换都必须保留编辑器实例、scroll anchor、selection summary 和未确认 patch queue。

## UI Contract

- Surface classification: `domain-lens`
- Primary user question: “我正在编辑什么、是否已安全保存、Agent/Team 提议了什么、下一步是否会改变正文？”
- First / second / third visual priority: active text and save state / candidate or Team Plan / context, permissions and evidence
- Page/Pane pattern: existing AgentWorkbenchShellV2 + central registered document + shared Context rail
- Shared primitives/composites reused: UnifiedSurfaceFrame、SurfaceHeader/Toolbar、PaneChrome/Toolbar/Tabs、Button、IconButton、Popover、DropdownMenu、Dialog、Sheet、Tooltip、StatusChip、DataState、SurfaceEmptyState/Skeleton、ActionRecovery、EvidenceBlock、InspectorLayout
- Cards that earn existence: candidate summary、Team Plan、permission/cost gate；正文与 Outline 不包成卡墙
- Primary scroll owner: editor/compare body；Agent timeline 与 Context rail 各自保持既有滚动 owner
- Domain-specific visual allowance: source decorations、diff marks、timeline tracks、entity/claim edges；外围 chrome 不变

### State Matrix

| Feature | Loading | Empty | Ready/Running | Error/Offline | Partial/Stale | Permission/Cost | Unknown |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Working Copy | editor skeleton | select/create document | body + save state | last-confirmed + unsaved warning | conflict compare | owner action gate | reconcile open/apply |
| Agent candidate | structured placeholder | no candidate | inline/document/change-set diff | safe failure + retry if known | stale/rebase | accept impact | reconcile only |
| Context | object skeleton | prepare context | working set + egress receipt | last-confirmed | stale refs | project/session scope | refetch/reconcile |
| Team | plan skeleton | choose template | plan/simulation/run | owner recovery | partial members | one approval/cost | reconcile only |

### Responsive

| 有效宽度 | 主组合 | 编辑/比较 | Context/Team |
| --- | --- | --- | --- |
| `>=1536px` | Chat + Document + Context | 完整 editor 与 split compare | 四个 deck 常驻 |
| `1280–1535px` | Chat + Document；Context 可折叠 | 完整 editor；compare 保持双栏或自适应 50/50 | Team Plan 进入中央 document |
| `1024–1279px` | Chat + active document | editor 可用；compare 可上下堆叠 | Context/Session 互斥 Sheet |
| `<1024px` | Chat + labelled Sheet/list | 正文只读、统一 diff；编辑/拖拽 desktop-required | Review/Team decision Sheet |
| `200% zoom` | 按有效宽度进入上述模式 | 无页面级双向滚动 | action 不被裁切 |

Sheet focus trap、Escape、scroll lock 和 focus restore 使用既有组件；drag 都有 menu/keyboard 等价路径。

## Risks / Trade-offs

- [CodeMirror 与 React 状态重复] → EditorView 独占 buffer/undo，React 只持 owner revision、save state 和 selection summary。
- [Autosave 状态误报] → 只有 Auctra receipt 进入 saved；browser fetch success 不等于 owner apply 成功。
- [全文授权不易理解] → Profile Sheet 持续显示 project-full badge，Working Set 与 actual egress receipt 分开呈现。
- [Team surface 过早显得成熟] → simulation/real 使用不同状态、颜色语义和 evidence label，real 默认关闭。
- [现有 Screenplay Room 与新 Lens 重复] → 复用其 typed projection/components；新 change 只提供共享 host 和合同，不复制双时间线实现。

## Migration Plan

1. 新 document kind、SDK client 和 capability flag default-off；无 Auctra descriptor 时不进入 palette ready 状态。
2. 先实现小说 active document + Working Copy save/checkpoint + inline candidate，保持现有 `/agent` 默认布局。
3. 接入 Conversation Runtime project-full/egress/hot-switch；reference adapter 仍仅 dev/test，不能自动 fallback。
4. 将现有 Screenplay Room 注册到共享 Text Development host；增加 Self-media fixtures。
5. 接入 Ordo plan/simulation，最后以独立 flag 开放 real canary。
6. 通过 60 分钟 proof、responsive/a11y/performance/security evidence 后晋级 Novel local Beta。

Rollback：关闭 `agent.text-development.v1alpha1` registry/capability 和相关 action descriptors；旧 Agent/Spatial/Screenplay 路径保持可用。Auctra owner state不删除，browser cache 和 editor instance安全释放。无 breaking surface 或 deprecation window。

## Open Questions

无产品级未决项。实现时 CodeMirror 包的具体 patch version 由 lockfile 与兼容测试冻结，不改变本文合同。
