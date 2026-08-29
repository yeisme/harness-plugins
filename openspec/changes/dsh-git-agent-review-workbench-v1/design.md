## Context

当前 Git Pane 已具备 `Merge/Staged/Changes/Untracked`、紧凑目录树、语义色、响应式 master/detail diff 和基础 typed stage/unstage/commit。Host 侧已有 `GitTypedActionsCapabilityV1`、`GitStatusProjectionCapabilityV2`、`GitDiffWindowCapabilityV1`、Branch/Remote/Worktree gate，但投影只有计数，无法支持 revision 绑定审查、10k 文件窗口、提交预检或 Review Queue。

本变更同时触及公共 TypeScript API、Git 副作用、Ordo owner evidence、密集 React UI 和 integration evidence。所有新增 surface 均为 additive；旧 V1/V2 保留并作为 runtime fallback。

### UI Spec

- 产品姿态：engineering tool、high-density、calm、低饱和、非营销。
- 页面模式：审批队列使用 approval queue；Changes 使用 artifact browser + diff inspector；History 使用 table + inspector。
- 视图：`review / changes / history / branches / worktrees / remotes / stashes / tags`，可见中文，协议 id 保持英文。
- 密度：desktop row 28px；coarse pointer 至少 44px；Inspector 宽屏右侧、窄屏全宽 Sheet。
- token：只使用 visual-kit 的 background/foreground/border/accent/success/warning/error/info 语义 token；状态始终配 `M/A/D/R/!`、文本或图标。
- 响应式：`<560px` tabs 收敛为可搜索 View Selector；`<760px` diff 默认 unified，宽 Pane 默认 side-by-side，允许切换并按 workspace 保存。
- 状态：loading、empty、error、stale、offline、partial、selected、reviewed、feedback、disabled、approval、Undo、secret-risk。
- 控件：View Selector、repository/worktree selector、group disclosure、file/hunk review、stage/unstage/discard、commit preflight、feedback、Pause/Resume、queue/history selection、compare pin。
- 键盘：`Ctrl/Cmd+Shift+G` 打开 Git，`F7/Shift+F7` 导航差异，`Ctrl/Cmd+Enter` 确认 preflight；binding 冲突时禁用并显示重映射原因。
- 视觉黑名单：无渐变、glass、装饰阴影、随机色、card 堆叠、大标题空状态或只靠颜色表达状态。

## Goals / Non-Goals

**Goals:**

- 提供完整且可测试的 additive capability 类型、probe、校验和 fallback。
- 让 Changes 完成 Agent review → feedback → revision reconcile → stage → verification → commit 的安全闭环。
- 让 Review Queue、History/Compare、Branch/Remote、Worktree、Stash/Tag 在同一个 Pane 内按 owner capability 渐进出现。
- 保持 stale 安全窗口可读、mutation fail-closed、receipt 可 reconcile、diff 原文 local-only。
- 通过 owner window 与浏览器虚拟化达到极端规模验收，不把完整快照放入 React state。

**Non-Goals:**

- 不在 Harness Plugins 中实现 Git CLI、任意 argv、repository canonical store、Ordo scheduler/lease/review ledger。
- 不由浏览器猜测 generated/secret/binary，不持久化 diff 原文、绝对路径、credential 或 owner payload。
- 不自动 stage、自动 retry timeout、自动 Pause Agent、自动释放 Ordo lease 或默认 Force Push。
- 不预先引入数据库/SearchIndex；只有 owner native rev-walk 基准失败后才提出独立 additive capability。

## Decisions

### 1. 单 Pane、能力驱动默认视图

`GitPane` 只维护一个入口和一组 presentation state。检测到 `GitReviewEvidenceCapabilityV1` 且 queue 可用时默认 `review`，否则保持 `changes`。每个视图独立 probe；缺失时显示 unavailable 原因，不渲染死按钮。

替代方案是新增 Git Beta Pane，会造成双入口、状态分叉和迁移成本，因此拒绝。

### 2. Git 与 Ordo 只以 opaque worktreeRef join

Git status/diff/history/mutation 由 Git owner 发布；reviewed/feedback/verification/lease/Agent/task/Pause/Resume 由 Ordo 发布。浏览器仅以 `repositoryRef + worktreeRef + revision + opaque refs` 组合，不创建跨 owner canonical row。

普通 worktree 不要求 Ordo gate；Agent worktree 在 Ordo offline 时仍可读 Git/diff，但 review mutation、Commit 和 Discard 禁用。

### 3. 所有投影采用 window + snapshot/subscribe/cursor

新增 status/history/review queue 均返回 bounded window、total、cursor、freshness 和 next cursor。subscribe event 必须携带 sequence/cursor/revision；gap、expired cursor 或断线时保留最后安全窗口并标记 stale，停止 mutation，重新 snapshot 后原位恢复 selection/scroll。

浏览器不轮询 Git，也不将 10k 文件或 1M commit 完整快照存入 React state。现有 Changes V1 仅作为缺少窗口能力时的小仓库 fallback。

### 4. Revision 绑定审查与 readiness gate

reviewed 记录绑定 `worktreeRef + fileRef + hunkRef + revision`。revision 改变后旧 reviewed 立即失效。文件 reviewed 是全部当前 hunks reviewed 的派生状态，不单独持久化。

Agent worktree commit readiness 需要：无冲突、revision 稳定、全部 hunks reviewed、verification passed、feedback resolved、Ordo online。用户可提交非空理由形成 override evidence；Git owner 仍执行最终 preflight。

### 5. Mutation V2 是 preflight/execute/reconcile，而非直接命令

`GitMutationActionsCapabilityV2` 接收 typed intent，包含 repository/worktree、expected revision、target refs、preview digest、idempotency key。Stage All/Unstage All 只作用当前 worktree并预览数量；Commit 永不自动暂存。

Discard 先由 owner 创建 backup receipt，再显式确认 execute；Undo receipt 最多保留 24 小时或至 owner 显式清理。timeout/unknown 不自动重试，只查询 receipt reconcile。

### 6. Commit preflight 使用 Inspector/Sheet

preflight 展示 staged count/refs、branch、author、signing、hooks、verification、digest、risk 和 allowed actions。Agent message suggestion 可编辑，但 commit 必须由用户显式确认；`Ctrl/Cmd+Enter` 只确认当前有效 preflight。

### 7. Diff 只在本地窗口渲染

`GitDiffWindowCapabilityV2` 返回 unified/side-by-side window、hunks、loaded/total、base/target/current revision、generated/binary/secret-risk 与 allowed actions。patch/diff text 不进入日志、evidence、localStorage 或 compare session。secret-risk 阻止未确认 share/export。

### 8. 后续视图复用同一 window/inspector 模式

- Review Queue：risk-first，冲突 > revision drift > verification failed > unresolved feedback > approval > last activity。
- History：当前分支默认，Graph/message/refs/author/time/stats 虚拟表格，Inspector 展示 commit/files/Ordo links。
- Compare Session：只持久化 opaque refs、query、layout、revision 和 presentation。
- Branch：脏树 switch 预检并默认建议新 worktree。
- Pull：使用 owner repository config；无配置 `ff-only`。Fetch 由 owner policy；Force Push 默认不可用。
- Worktree create 与 Agent launch 是两个独立 receipt；remove 遇 Ordo lease 必须阻塞。
- Stash/Tag：动作同级可发现；Pop/Drop/Delete/Push 均 preflight，Tag 默认 annotated，signing 跟随 owner config。

### 9. 最小实现路径

复用现有 `ui-pane-workbench/src/git` 纯模型、visual-kit 和 Vitest，不新增状态库、表格库或虚拟化依赖。窗口模型先以纯函数和 host interface 固化；桌面 Pane 使用现有 React state 与 bounded arrays，后续真实 transport 直接替换 fixture/fallback adapter。

## Risks / Trade-offs

- [Ordo owner capability 尚未在本仓实现] → 本仓只提供安全 interface、probe 和 UI gating；真实 owner handoff 独立记录，不伪造 canonical evidence。
- [旧 host 只提供完整 status] → 保留 Changes V1 fallback，并限制新性能承诺只对 window capability 生效。
- [超大 diff/历史仍可能阻塞渲染] → owner bounded window + 28px virtual rows；性能测试只生成摘要数据，不持久化原文。
- [revision drift 造成用户已审查状态消失] → 明确显示失效原因和 reconcile 操作，不把旧证据静默迁移到新 revision。
- [危险动作过多导致 UI 拥挤] → 主行只显示上下文动作，完整动作放 Inspector/More，但 Stash action 保持同级可发现。
- [快捷键冲突] → 由 registry 给出冲突结果并禁用 binding，不抢占已有 command。

## Migration Plan

1. 先发布新 capability 常量、类型、probe 和 V1 fallback contract tests；不改变现有 host object 的 required fields。
2. Git Pane 逐项检测 capability，Review Queue 仅在安全 projection 可用时成为默认视图。
3. Changes V1 与旧 `diff/diffStaged/stage/unstage/commit` 路径持续可用；新 host 可逐步增加 window/mutation/review/history companions。
4. 若新 UI 或 capability 出现回归，移除对应 capability advertisement 或关闭 feature flag，即回退到当前 Changes V1；无需数据迁移。
5. 本变更无 deprecation/removal 窗口，因为未移除、重命名或重定义任何稳定 surface。

## Open Questions

- Ordo owner 何时发布真实 `GitReviewEvidenceCapabilityV1` transport 与 evidence schema，由 `agent/ordo` 的独立 OpenSpec 决定；不阻塞本仓 adapter 与诚实降级。
- SearchIndex 是否需要，等待 1M commits owner native rev-walk 基准；当前不实现。

## Verification Evidence

### 2026-08-28 实施结果

- Git Host：11 tests passed；additive capability、opaque ref、window、revision drift、timeout/no-auto-stage/lease invariants 均通过。
- File/Git owner：21 tests passed；disposable repository 覆盖 status window、V2 diff、history、Compare Session、stage preflight/execute、receipt reconcile、discard binary backup/24h Undo。
- Ordo DSH adapter：41 tests passed；其中 Git review evidence 5 tests 覆盖 risk sort、revision invalidation、readiness、cursor gap、2,000 queue 项与 lease 不释放。
- Desktop Workbench：52 tests passed；Git Pane 15 component tests 覆盖 V1 fallback、tree、secret-risk、hunk review、Review Queue、commit preflight、10,000 files、1,000,000 commits 和 Compare Session。
- Bundle：`@yeisme/dsh-desktop-workbench` build 通过，`tests/apply.spec.ts` 14 tests passed；可选 `ordo.gitReviewEvidence` 只在 capability 匹配时注入。
- UI policy：motion policy 0 warnings；Dark/Light/High Contrast 继续由 visual-kit semantic tokens 驱动，业务组件未增加硬编码颜色或新运行时依赖。
- OpenSpec：`openspec validate dsh-git-agent-review-workbench-v1 --strict --no-interactive` passed。

### Integration evidence

- Git owner integration：`temp/integration-test-runs/2026-08-28T07-01-05-146Z-2505629/summary.json`。
- Git Pane component：`temp/integration-test-runs/2026-08-28T07-01-10-384Z-2511358/summary.json`。
- 两个 runner 均生成 `summary.json`、`command.txt`、`stdout.log`、`stderr.log`、`env.json` 与 `artifacts/`，并脱敏项目绝对路径、临时路径、credential、raw prompt 与 private tool 参数。

### Compatibility verdict

- `breaking_surfaces: []`
- `openspec_change: dsh-git-agent-review-workbench-v1`
- `change_class: additive`
- `deprecation_window: not_applicable`
- `rollback: 停止 advertisement 新 capability 或移除可选 Ordo seam，即原位回退现有 Changes V1；无数据迁移`
- `owner_handoff: agent/ordo 真实 review/launch transport 与 Git owner 完整 Branch/Remote/Stash/Tag action transport 仍为独立 owner 交付，不由 Harness Plugins 伪造`
