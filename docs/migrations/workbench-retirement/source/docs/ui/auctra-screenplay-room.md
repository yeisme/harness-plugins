# Workbench Auctra Screenplay Room UI

状态：`implemented / approved`。实现由 [workbench-auctra-screenplay-room-v1](../../openspec/changes/workbench-auctra-screenplay-room-v1/proposal.md) 追踪；Auctra provider 合同由 [auctra-screenplay-room-v1](../../../../cli/auctra/openspec/changes/archive/2026-09-05-auctra-screenplay-room-v1/proposal.md) 拥有（已归档，29/29）。Auctra capability 已于 2026-09-05 双半场真实 loopback canary 后晋级 `approved`（消费侧 run `20260905035934-804f088e` exit 0）；UI 状态机仍以运行时协商为准——offline/permission_required/needs_contract 分支保留给未配置/降级场景。

## Owner-fit

这是 split-owner 专业工作区：

| 内容 | Owner |
| --- | --- |
| structure/Beat、Scene Card/Contract、screenplay order、story time、正文 draft、review、Story Graph、visual metadata、receipt | Auctra |
| Screenplay Room selection、viewport、semantic zoom、layout、context rail、typed action presentation | Workbench |
| Agent proposal/decision、Task dispatch、unknown reconcile | Workbench ProposalAuthority / TaskService |

Workbench 不保存 Auctra canonical state，不读取 `.auctra/**`、SQLite 或 owner token，不解析 human CLI output，也不 iframe Auctra Viewer。

## 入口与主布局

Screenplay Room 位于：

```text
/agent
  → Spatial Focus
    → Creative Production
      → Screenplay Room
```

它是 closed `creativeSurface=screenplay_room` 专业子模式，不是 `/screenplay` 新页面，也不是普通窄 Pane。Agent conversation/composer、当前 session、Task/Proposal 和单一 context rail 始终保留。

桌面默认布局：

```text
┌──────────────── Screenplay Room toolbar ────────────────┐
│ profile · search · semantic zoom · fit · undo · status │
├─────────────────────────────────────┬───────────────────┤
│ Narrative order track               │ Scene             │
│ episode/act → sequence → scene      │ Graph             │
│               ↳ beat sub-track      │ Review            │
├─────────────────────────────────────┤ Evidence          │
│ Story time track                    │ shared rail       │
│ anchors · range · before/after      │                   │
└─────────────────────────────────────┴───────────────────┘
```

`>=1440px` 可并排显示 Scene/Graph context；`1024–1439px` 使用单 tabbed context rail；`<1024px` 进入 review-only list/Sheet，不挂完整拖拽或正文 editor。

## 双时间轴

上轨是观众看到的叙事顺序，下轨是故事世界内时间。两者共享 Scene selection、horizontal viewport 和四级语义缩放，但写入完全分开：

- 上轨移动：Auctra structure mutation；
- 下轨修改：Auctra story-time mutation；
- Scene order 不能推导 story time；
- flashback、simultaneous、range、unknown 都是合法状态；
- 时间冲突显示 finding，不自动重排 Scene。

语义缩放层级：

1. 项目/季或全片：集/幕、Scene 数、blocker/review 趋势；
2. 集/幕与 Sequence：Scene 紧凑卡；
3. Scene：功能、人物/地点、story time、状态变化和 review；
4. Beat：选中 Scene 的场内节奏、turn 与 state change。

## Scene 卡

主时间线必须克制。默认 Scene 卡只显示：

- ordinal、标题、scene function；
- primary character 与 location；
- story-time label；
- 一条 state delta；
- review/freshness、blocker count；
- optional authorized thumbnail。

goal/obstacle/stakes/turn、knowledge、setup/payoff、evidence 和技术 refs 进入 context rail。卡片不能铺满背景图，也不能用颜色单独表达状态。

图片是内容证据：accepted 图片可以进入 40–56px thumbnail；candidate 只在 detail/asset context 中带候选标识；缺图时使用文字首字母和 semantic icon，不显示假人物头像。

## 结构编辑与恢复

拖动过程只产生 ghost placement：

```text
idle → dragging → submitting → confirmed
                        ├→ version_conflict
                        ├→ unknown_accept
                        ├→ offline/permission/needs_contract
                        └→ failed
```

`confirmed` 只来自 Auctra receipt/refetch。pointer-up、HTTP dispatch 或 Workbench Task created 都不等于保存成功。

- `version_conflict`：保留本地 intent 摘要，提供 compare/refetch，不静默 rebase；
- `unknown_accept`：只允许 reconcile original operation，不创建新 idempotency key；
- undo：只有 Auctra 返回 current reversible mutation 时启用；
- 每个 drag 操作都有 Move menu、parent/position selector 和 archive/restore 的非拖拽等价路径。

## Scene Card 与专注写作

Scene tab 编辑 Auctra Scene Card draft；Scene Card 与正文拥有独立 revision/dirty 状态。保存 Scene Card 不保存正文，提交 Scene Card 只创建 pending Scene Contract review。

打开正文后进入 focus writing：中央变为单场 Fountain/plain-text editor，顶部保留压缩 timeline strip、Scene identity、body version、save state 和返回动作；Graph/Review/Evidence 仍在 context rail。

正文使用 Auctra `text.draft.open/save/submit`。冲突时保留浏览器 buffer 并提供 compare；离开未保存正文时必须警告，不能宣称 reload 后已恢复。

## Context Graph

选中 Scene 后，Graph tab 首先显示直接人物、地点、知识、义务、setup/payoff 和状态变化。用户可以按 domain、hop、search 或“查看全局”继续加载。全量可达不等于首屏全显。

图谱选择会高亮已加载的 Scene occurrences，但不会：

- 移动 Scene 或 Beat；
- 改 story time；
- 自动 attach composer context；
- 创建 Task、Proposal 或 owner mutation。

只有用户点击“加入上下文”才把 safe refs 交给 Agent composer。

## Agent proposal

Agent 结构/时间/Scene Card/正文建议只显示 ghost/diff。用户显式进入 Review 并接受后，ProposalAuthority 重载 current capability、basis、target version 和 Auctra descriptor，再让 TaskService 调用 owner。

presentation-only intent 可以 focus/highlight，但不能写入、抢 keyboard focus 或自动附加 Context Pack。

## 统一视觉与图标

Screenplay Room 复用 Workbench design tokens、SurfaceHeader/Toolbar、StatusBlock、EmptyState、RecoveryAction、context rail、中文 locale 和 secondary mono metadata。

新增业务语义必须进入受控 icon registry，例如：

```text
screenplay.episode / screenplay.act / screenplay.sequence
screenplay.scene / screenplay.beat
story.character / story.location / story.knowledge
story.obligation / story.setup / story.payoff
state.timeConflict
```

Server 只能返回稳定 icon token/media role，不能返回 React component、Lucide name、SVG path、HTML、CSS、URL 或 event handler。

## 状态与移动端

所有状态按“用户影响 → 一个真实主动作 → technical details”呈现。ready 时不显示告警；同一 Auctra 问题只由当前 Scene surface 给出主解释，其它区域使用 compact indicator。

移动端提供：可搜索 Scene order、story-time summary、Scene detail、Graph summary、pending review 与 approve/reject/reconcile。创建、拖拽、Scene Card 写入和正文 editor 明确显示“需要桌面端”，而不是隐藏或挂载一个不可用 Canvas。

## 验收

第一版必须用短剧与电影真实 fixture 覆盖：

- 一个 Scene 完整闭环；
- episode/act/sequence/scene/beat；
- flashback、simultaneous、unknown time；
- Scene drag、非拖拽 move、archive/restore、undo；
- Scene Card/body 独立保存与 review；
- Context Graph direct-first 与全量渐进展开；
- version conflict、offline、permission、needs_contract、unknown_accept；
- 1440×960、1024×768、390×844、200% width、keyboard、reduced motion、Axe 和 zero page overflow。

实现验证命令：

```bash
openspec validate workbench-auctra-screenplay-room-v1 --strict --no-interactive
bun run typecheck
bun test
bun run --cwd apps/web test
bun run test:contract
bun run test:integration
bun run web:e2e
```

fixture UI 通过不能晋级 owner capability。只有真实 Auctra loopback read/events、selected mutation、receipt/status/reconcile 和 rollback evidence 完整后，对应 operation 才能从 `needs_contract` 翻转。
