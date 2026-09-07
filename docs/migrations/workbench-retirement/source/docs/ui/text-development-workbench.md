# Text Development Workbench UI Spec

> 状态：`active proposal`
> Surface：`domain-lens`
> Parent shell：`AgentWorkbenchShellV2`

## 1. 布局

```text
┌──────────────┬──────────────────────────────────┬─────────────────┐
│ Agent Rail   │ Document Dock                    │ Context Rail    │
│ timeline     │ editor / compare / visual lens   │ context/review  │
│ composer     │                                  │ profile/evidence│
└──────────────┴──────────────────────────────────┴─────────────────┘
```

区域身份固定：左侧 Agent、中央 Document、右侧 Context。`Create` 与 `Collaborate` 只改变权重、焦点和默认 active document，不改变区域身份：

| 有效宽度 | Create | Collaborate | Context/Session |
| --- | --- | --- | --- |
| `>=1536px` | Chat 360–400px；editor 主导；Context 336–360px | Chat 380–420px；中央 compare/Team min 640px；Context 360px | 三域常驻，Session drawer 可 pin |
| `1280–1535px` | Chat 340–380px；Document min 640px | Chat 不继续扩张；compare/Team 占中央 Document | Context 可折叠，信息不得消失 |
| `1024–1279px` | Chat + active Document | Chat + compare/Team Document | Context/Session 为互斥 Sheet |
| `<1024px` | Chat + labelled review/document Sheet | Chat + Team/Review Sheet | 正文只读，编辑/拖拽 desktop-required |

切换不得 remount editor/composer，不得重新创建 Task 或 owner subscription，也不得清空 scroll anchor、selection、pending patch 或 candidate review。

### 1.1 Create wireframe

```text
Trusted Chrome
├─ Chat rail: turn timeline + composer
├─ Document Dock
│  ├─ title / format / Working Copy status / primary action
│  ├─ document toolbar
│  └─ source-preserving editor
└─ Context rail
   ├─ Structure
   ├─ Review
   ├─ Versions
   └─ Team
```

### 1.2 Collaborate wireframe

```text
Trusted Chrome
├─ Chat rail: lead Agent + Team events
├─ Document Dock
│  ├─ candidate compare OR Team Plan
│  └─ active text remains reachable without opening another route
└─ Context rail
   ├─ selected member / hunk / version details
   └─ receipt / evidence / recovery
```

## 2. Document Dock

Document header固定显示：标题、文本类型、format、Working Copy revision、save state、latest Checkpoint、owner freshness。Raw refs仅放technical details。

Toolbar 按当前用户目标排序，不常驻五个等权主按钮：

1. 当前阶段的唯一 primary：`Create Checkpoint`、`Accept candidate`、`Submit Review` 或 `Approve & Start` 之一。
2. 当前文档操作：Compare、Find、Lens selector。
3. 低频操作：版本、导出、diagnostics、command palette，进入 overflow 或 Context deck。

正文使用CodeMirror 6 source-preserving WYSIWYM。Markdown/Fountain标记可弱化或装饰，但复制、保存和diff始终使用原始source。一个时刻只有editor body拥有主滚动。

正文与应用 chrome 使用不同排版职责：

- Workbench header、toolbar、status 与 inspector 继续使用统一 UI type scale。
- Markdown/plain text 默认至少 16px、行高约 1.65、可读行宽 72–88ch。
- Fountain 使用现有 mono token、约 15–16px 和稳定 gutter；不加载另一套品牌字体。
- 正文不包裹成大 card，不使用 paper shadow、渐变、插画背景或“写作氛围”装饰。

Save state：

- `saved`：owner已确认当前revision/digest。
- `saving`：patch已发送、等待receipt。
- `unsaved`：存在未发送或未确认buffer。
- `conflict`：owner revision drift，打开compare。
- `offline`：保留last-confirmed和内存buffer，禁止声称已保存。
- `recovery_required`：Auctra完整性检查失败，禁用mutation。

## 3. Selection actions

选中文本后在选区邻近位置显示紧凑action bar：

- `Ask`
- `Rewrite`
- `Polish`
- `Add to context`

Profile自定义动作位于overflow menu，最多四个。每个action的tooltip说明是否只问询、创建candidate或改变Working Set。没有server action manifest时不得生成按钮。

选区在Agent执行期间以低饱和anchor decoration保留；Working Copy变化导致anchor stale时，action bar关闭，candidate转入stale状态。

## 4. Candidate review

### Inline patch

- 删除使用语义danger-tint和删除线；增加使用positive-tint。
- 每个hunk显示summary、producer、base revision和accept/reject。
- Accept pending时hunk不可重复点击；unknown时只显示Reconcile。

### Document candidate

- 中央使用split compare，左侧Current Working Copy，右侧Candidate。
- 同时提供source与rendered tabs；rendered view不可编辑。
- 顶部固定显示scope、changed ranges、risk、context与usage摘要。

### Atomic change-set

- 显示document/structure members、dependencies、writer和整体impact。
- 首版只有整体Accept/Reject。
- 用户想接受部分内容时，动作是“Create derived change-set”，不是client partial apply。

## 5. Context rail

右侧领域信息只使用四个稳定 deck，避免 8–10 个平级 tab：

| Deck | 内容 | Attention 条件 |
| --- | --- | --- |
| `Structure` | Outline、Entities、Materials、Timeline/Foreshadowing 或场景结构 | selection、结构 finding、stale projection |
| `Review` | candidate、deterministic/AI findings、comments、decision impact | pending decision、conflict、unknown |
| `Versions` | Working Copy、Checkpoint、ReviewItem、Canon、recovery | unsaved、checkpoint available、review status、recovery required |
| `Team` | Profile、Plan、simulation、run、lease、receipt | plan changed、writer conflict、approval、run attention |

Agent context disclosure 保持在 Shell 既有 Context/Inspector 区域的固定分组，不另建第五个领域 deck：

1. `Project access`：project-full/web-search 与 session narrowing。
2. `Working Set`：must-use refs，可移除、refresh，不自动 attach。
3. `Actual use`：最近 turn 实际使用的 refs/ranges/count、model/tool、token/cost 和 limitations。

Role、Mode、Model Profile、Permission Profile 在 Team deck 的 Profile view 中分别显示。继承差异按 user/project/session 三列展示；deny 不可被 session 改为 allow。

## 6. Hot switch

Idle时确认新Profile后立即切换。Active时按钮进入以下可见状态：

```text
switch requested
  -> revoking old grant
  -> cancelling current attempt
  -> cancelled / partial confirmed
  -> confirming new grant
  -> continuation running
```

若cancel/side effect为unknown，流程停在`Reconcile required`；用户仍可保存待选Profile，但不能启动continuation。

## 7. Team Plan

Team Plan使用中央surface，而非小弹窗。视觉顺序：

1. 目标与输出物。
2. Roles + DAG。
3. Context/permissions/model profiles。
4. Budget/time和唯一writer。
5. Risks/blockers。
6. `Simulate`或`Approve & Start`。

Simulation使用`simulated`状态和明确的`provider calls: 0`；真实canary使用`experimental-real`。缺真实key/runtime readiness时只显示blocked和配置动作，不能以fixture替代。

## 8. 组件体系

Text Development 优先组合既有组件：

| UI 责任 | 必须复用 | feature-local 组合 |
| --- | --- | --- |
| Surface/header/toolbar | `UnifiedSurfaceFrame`、`SurfaceHeader`、`SurfaceToolbar`、`PaneChrome/Toolbar/Tabs` | `TextDevelopmentSurface` |
| 状态/空态/恢复 | `StatusChip`、`StatusBlock`、`DataState`、`SurfaceEmptyState/Skeleton`、`ActionRecovery` | `WorkingCopyStatusStrip` |
| 控件/overlay | `Button`、`IconButton`、`Tabs`、`Popover`、`DropdownMenu`、`Dialog`、`Sheet`、`Tooltip` | `TextSelectionActionBar` |
| evidence/inspector | `EvidenceBlock`、`InspectorLayout` | `TextVersionLedger`、`TextTeamPlanSurface` |
| diff | 先复用现有 Tabs/Button/Evidence 语法并清点 Screenplay/CLI/Replica | `TextCandidateReview`；两个以上调用方后才晋级 `DiffView` |

禁止新增第二套 Button/Dialog/Tabs/Status/empty state、直接 Radix import、registry 外 Lucide、局部 font stack、私有 palette 或 route-owned focus trap。通用 composite 只拥有 presentation，不能持有 Auctra/Runtime/Ordo 状态。

## 9. Structure lenses

- Novel：Outline tree、Timeline tracks、Foreshadowing links、Entity graph。
- Screenplay：Scene/Beat list、Narrative/Story Time双轨、Scene Card、Context graph。
- Self-media：Brief fields、Claim/Source graph、Channel checks、Variant list。

允许受控拖拽，但落点必须来自owner schema；拖动中显示ghost，receipt前不改变canonical order。Graph仅渲染typed nodes/edges，不提供任意shape或自由连线。

## 10. 状态矩阵

| Surface | Loading | Empty | Ready | Error/Offline | Stale/Partial | Permission/Cost | Unknown |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Editor | chapter skeleton | choose/create text | body+save state | last-confirmed+warning | conflict compare | owner gate | reconcile |
| Candidate | diff skeleton | no candidate | adaptive review | safe failure | rebase required | accept impact | reconcile only |
| Context | object skeleton | prepare context | access+workset+usage | last-confirmed | stale refs | scope confirmation | refetch |
| Team | plan skeleton | choose template | plan/sim/run | owner recovery | partial members | plan approval | reconcile only |

保存状态额外遵循：`saving` 超过 400ms 才持续显示；`saved` 低强调更新且不弹 toast；`conflict/offline/recovery_required` 立即替换 saved 并提供一个真实恢复动作。Screen reader 只播报阶段变化，不播报每个 patch。

## 11. Responsive 与无障碍

- Desktop：完整editor、split compare、结构拖拽、右Context rail。
- Tablet：一个主document；Agent和Context为互斥Sheet；保留diff decision。
- Phone：正文只读、对话、findings、diff、comment、accept/reject；编辑与拖拽显示desktop-required。
- 所有动作支持键盘；selection action bar进入/退出不抢走editor selection。
- Diff不能只靠颜色；增加/删除有符号、文本或accessible label。
- 200% zoom无双向页面滚动；Sheet使用focus trap、Escape、scroll lock与focus restore。
- `prefers-reduced-motion`时取消宽度spring和pending ghost动画，保留状态变化。

## 12. 交互控件清单

| Control | Primitive | 状态 | 键盘/焦点 | 数据与验收 |
| --- | --- | --- | --- | --- |
| Posture switch | `SegmentedControl` | Create/Collaborate/disabled | Arrow/Enter；不移动 editor focus | dispatch existing layout action；不 remount |
| Document selector | `Combobox` | loading/ready/empty/stale | typeahead、Escape、return focus | owner list projection；未知 ref 不打开 |
| Checkpoint primary | `Button` | enabled/pending/blocked/unknown | Enter/Space；pending 禁重复 | exact revision/digest/action ref |
| Selection actions | `Popover` + `Button/IconButton` + `DropdownMenu` | open/stale/disabled/running | 保留 selection；Escape 先关 bar | server manifest，最多 4 custom actions |
| Candidate compare | `Tabs` + diff composition | loading/inline/split/unified/stale/unknown | hunk/line 导航、decision focus | owner-normalized immutable diff |
| Profile editor | `Select/Combobox/Switch` | inherited/override/denied/pending | label 完整，错误关联 | user→project→session，deny wins |
| Team Plan | central Surface + read-only graph | draft/simulated/blocked/ready/running/unknown | node keyboard selection，图不编辑 | Ordo plan revision/digest |
| Mobile Review | `Sheet` | closed/open/loading/decision | trap、Escape、scroll lock、return | 与桌面相同 action identity |

## 13. 用户旅程

| 步骤 | 用户动作 | 用户应感受到 | UI 证据 |
| --- | --- | --- | --- |
| 1 | 打开项目/章节 | 立刻知道自己在哪里，正文是否安全 | 标题、format、Working Copy revision、save state |
| 2 | 连续编辑 | 保存安静，不干扰写作 | 无成功 toast；owner receipt 更新低强调状态 |
| 3 | 选中文本请求 Agent | 动作含义和影响清楚 | Ask 与 candidate-producing action 分开说明 |
| 4 | 审阅候选 | 当前正文不会被偷偷替换 | base revision、diff、provenance、单一 decision |
| 5 | 创建 Checkpoint/送审 | Working Copy、Checkpoint、Canon 区别明确 | Versions ledger 与 receipt |
| 6 | 运行 Team simulation | 能看懂谁做什么、谁能写、哪里会阻塞 | Plan DAG、writer、budget、blocked reasons |
| 7 | 断线/冲突/重启 | 知道已确认到哪里以及如何恢复 | last-confirmed、buffer、reconcile/recovery action |

## 14. 视觉验收与设计评审

现有三张 Eikona reference 继续只校准构图：图 02 用于 Dock/Pane 密度，图 01 用于 conversation/run 信息层级，图 03 用于 diff/review/evidence。Text Development 不复制其中的代码 IDE 语义、头像、品牌色或 task 状态。

固定截图至少覆盖：

- 1536×960 Create：中文长章节、saved、Structure deck。
- 1440×960 Collaborate：document candidate split compare、Review deck。
- 1280×800 Team Plan：Context 折叠、单 writer、simulation blocked/ready。
- 1024×768：editor + Context Sheet、conflict compare。
- 390×844：只读正文、unified diff、decision Sheet、desktop-required。
- 200% zoom、zh-CN/en-US/pseudo、reduced motion、keyboard、Axe、长标题、47 字符 ref。

设计审查由初始约 7/10 提升到计划级 9/10：信息架构、状态、用户旅程、组件准入、响应式和 a11y 已具体化；尚不能达到 10/10 的原因是没有批准的新 mockup、CodeMirror prototype 和真实 owner/browser evidence。实现后必须再运行视觉 QA，不能用 snapshot 更新替代评审。
