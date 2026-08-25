## Context

### 当前实现与问题证据

当前 `@yeisme/dsh-client-ui-pane-workbench` 已具备：

- 唯一 `PaneWorkbenchController`、Right/Bottom 共享 store、最大深度 2 和最多 4 个可见 group；
- `preview/pinned/dirty`、semantic open routing、typed drag/resize intent、safe persistence；
- `PaneViewRegistry`、内置 `dsh.tool-details` Core View、官方 workspace slot staging；
- `FileWatchCapabilityV1` 与 `GitTypedActionsCapabilityV1` probe；
- keyboard move、ARIA tabs、resize rAF 合并和 HMR teardown。

本次审计发现：

1. `region-chrome.ts`、`drag-coordinator.ts`、`controller.ts` 和 error boundary 仍包含大量硬编码英文，Pane 管理尚未接入 DSH `LocaleRuntime`。
2. Tab pointer drag 只有 threshold、drop target 和静态 dashed overlay，没有共享 ghost portal、插入占位、跨 region 连续反馈或 drop 后重排动画。
3. Tab 只有基础 title/active 状态，缺少 pinned segment、dirty/attention/offline/orphaned 的可扫描表达、溢出导航和稳定关闭 affordance。
4. File/Git change 只冻结 watcher 和 7 个 Git V1 actions，没有定义 Explorer 结构、diff/hunk、conflict、commit composer、branch/remote 用户旅程。
5. V3 将 Pane chrome、Explorer 和 Git 标为 `commodity-parked`；这与用户本次明确 required capability 冲突，V4 必须记录 scope change 并恢复实施 owner。
6. persistence 已有 session preset，但没有用户可理解的配置入口、draft validation、scope 选择或 preset 生命周期。

### Owner fit

本 change 为 `split-owner`：

- Harness Plugins 拥有 Pane layout reducer、chrome、Tab、drag coordinator、locale adapter、Workspace Designer draft 和安全 preset projection。
- DSH file/Git/locale/settings owner 拥有数据、权限、副作用、receipt 和持久化 authority。
- Ordo 继续独占 writer lease/worktree fence；Git Pane 只显示阻塞和 deep-link，不释放 lease。
- 浏览器只持有布局、selection、expanded refs、scroll/focus、safe resource refs 和短期 draft；不持有 canonical file/Git state。

### 设计评审基线

| 维度 | 当前 | V4 目标 | 主要修复 |
| --- | ---: | ---: | --- |
| 信息架构 | 5/10 | 9/10 | Explorer/Source Control 分工、Tab 层级、Designer 三栏 |
| 交互状态 | 4/10 | 9/10 | loading/empty/partial/stale/conflict/offline/receipt 全覆盖 |
| 用户旅程 | 5/10 | 9/10 | 从定位文件到 review/commit 的连续路径 |
| 具体性 | 4/10 | 9/10 | 尺寸、motion token、Tab/drag 行为和 copy contract |
| 设计系统 | 6/10 | 9/10 | 复用 DSH tokens、icons、LocaleRuntime、popup primitives |
| 响应式与可访问 | 6/10 | 9/10 | 390px Sheet、44px touch、keyboard DnD、pseudo locale |
| 未决策风险 | 4/10 | 8/10 | 以 additive seam 和 capability gate 隔离外部 blocker |

## Goals / Non-Goals

**Goals:**

- 让目录树和 Git 从“probe/静态列表”升级为连续、可恢复、可键盘操作的日常工作流。
- 让所有 Pane 管理文案和可访问反馈走统一 i18n 合同，首发中英文并能验证未来语言扩展。
- 让拖拽有明确 source、target、result 和 cancel 反馈，同时保持 reducer 原子性与重型 view 单宿主不变式。
- 让 Tab 在高密度工作区中清楚表达生命周期、状态和关闭风险，并在溢出、窄屏和触摸环境可用。
- 提供 Workspace Designer，让用户用可预览、可撤销、可校验的方式配置布局和 preset。
- 所有新合同 additive；旧 V1 capability、旧 Pane descriptors、旧 layout persistence 和无 Designer profile 保持可用。

**Non-Goals:**

- 不把 Explorer 做成完整 IDE 编辑器，不在本 change 引入 Monaco、LSP、debugger 或任意 shell command box。
- 不在浏览器实现文件 watcher、Git daemon、path resolution、credential helper 或 merge engine。
- 不允许 Workspace Designer 注入 CSS/HTML/React component、编辑 plugin manifest、复制 domain state 或绕过 provider capability。
- 不在 V4 支持任意深度 docking、浮动窗口、多显示器、多用户共享布局或实时协同编辑布局。
- 不自动执行 push/pull/discard/delete；高风险动作必须 owner preview/approval/receipt。
- 不删除 V3、V1 specs 或重解释存量 action id；收缩/删除另开 change。

## What Already Exists

- `PaneWorkspaceV1` 与纯 reducer：唯一 canonical layout。
- `PaneDragCoordinator`：Right/Bottom 跨 React root 的共享 drag generation。
- `PaneViewRegistry` 与 local-only component factory：安全 provider 注册。
- `PaneWorkspacePersistenceAdapter`：只保存安全 presentation state。
- DSH design tokens、Codicon semantic wrapper、Tooltip/popup/locale primitives。
- `dsh-file-host`、`dsh-git-host` 和现有 capability probes。
- `dsh.tool-details` Core View：证明 DSH-owned content 可进入统一 Pane host。

## Experience Architecture

### 桌面信息架构

```text
┌─ Activity Rail ─┬──────────── Main Conversation / Content ────────────┬─ Right Workspace ─────────┐
│ Explorer        │                                                     │ [Pinned Tabs] [Tabs] [⋯] │
│ Source Control  │                                                     │ ┌ Explorer / Changes ┐    │
│ Terminal        │                                                     │ │ active Pane view    │    │
│ Agents          │                                                     │ └─────────────────────┘    │
│ Customize       │                                                     │                            │
├─────────────────┴─────────────────────────────────────────────────────┴────────────────────────────┤
│ Bottom Workspace: Terminal / Problems / Diff / Logs                                   resize/max │
└───────────────────────────────────────────────────────────────────────────────────────────────────┘
```

Explorer 与 Source Control 是两个 provider：Explorer 负责 workspace/file navigation；Source Control 负责 repository/worktree、Changes、diff、commit 和 remote state。Explorer 可以显示 Git decoration，但不拥有 Git action。点击 changed file 默认把 diff 打开到 content group，显式 Open File 才打开普通 file preview。

### Workspace Designer 信息架构

```text
┌─ Header: Scope [Session|Workspace|Profile] · Preset · Undo/Redo · Apply · Save As ───────────────┐
├─ Pane Palette ───────┬──────────── Draft Canvas ───────────────────────┬─ Inspector ──────────────┤
│ Explorer             │ ┌ Main content ───────────────┬ Right ───────┐ │ Selected group/provider │
│ Source Control       │ │                             │ Group A      │ │ Region / role           │
│ Terminal             │ │                             ├──────────────┤ │ Default open policy     │
│ Tool Details         │ │                             │ Group B      │ │ Size / ratio / rail     │
│ Domain providers     │ └─────────────────────────────┴──────────────┘ │ Tab / motion policy      │
│                      │ ┌ Bottom: Group C ───────────────────────────┐ │ Capability warnings     │
│                      │ └────────────────────────────────────────────┘ │                         │
├──────────────────────┴────────────────────────────────────────────────┴─────────────────────────┤
│ Validation: 0 errors · 2 warnings · Apply changes will move 2 views and keep 1 dirty Tab in place │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

390px 下 Palette、Canvas、Inspector 投影为三个步骤，不同时横排；Apply/Discard 固定在 Sheet footer。Designer 画布渲染 placeholder 和 safe title，不挂载真实终端、媒体或领域 view。

## User Journey Storyboard

| Step | 用户动作 | 用户感受目标 | 设计支持 |
| --- | --- | --- | --- |
| 1 | 打开 Explorer | 立刻知道在哪个 workspace/repository | root selector、breadcrumb、branch/worktree summary |
| 2 | 展开目录并过滤 | 树稳定，不因异步加载跳动 | lazy children、skeleton row、virtualization、anchored scroll |
| 3 | 单击文件 | 快速查看，不制造大量 Tab | preview Tab；双击/编辑/Pin 后持久 |
| 4 | 外部工具修改文件 | 不担心覆盖或看旧数据 | watch cursor、stale/conflict badge、compare/reload action |
| 5 | 打开 Source Control | 看到真正需要处理的变化 | conflict/staged/changes/untracked 分组与 count |
| 6 | 点击 changed file/hunk | 明白改了什么、可局部处理 | diff view、next/previous change、stage/unstage hunk |
| 7 | 提交 commit | 知道目标、范围和结果 | composer、preflight digest、approval、receipt、projection reconcile |
| 8 | 自定义工作区 | 可探索但不会破坏当前布局 | draft canvas、validation、Apply/Discard、Undo、preset scope |

## Decisions

### 1. 保留唯一 reducer，新增 draft 和 batch intent，不做第二布局 store

`PaneWorkspaceV1` 继续是运行时 canonical layout。Workspace Designer 使用 `PaneWorkspaceDraftV1`，只存在于 Designer session：

```text
PaneWorkspaceDraftV1 {
  schema: 'pane.workspace-draft.v1alpha1'
  baseGeneration: number
  scope: 'session' | 'workspace' | 'profile'
  regions, splitTree, groups
  providerPlacements, railOrder
  tabPolicy, motionPreference
  warnings, validationDigest
}
```

Apply 产生一个 `apply_workspace_draft` batch intent；controller 在同一 generation 上校验 max depth/group/min size、provider capability、locked/core view、dirty/deny close、cross-root lifecycle 后一次提交。generation 漂移时拒绝并要求 Rebase/Reload Draft，不能覆盖新状态。

替代方案是 Designer 直接对 live reducer 连续 dispatch。拒绝，因为用户在探索过程中会抖动真实 layout、反复重挂载重型 view，并难以实现 Discard。

### 2. Explorer 使用 owner-issued tree projection，不从路径字符串构建 DOM

新增可选 `FileTreeProjectionCapabilityV1`：

```text
FileTreeNodeV1 {
  ref, parentRef?, name, kind,
  version, hasChildren, capabilities,
  gitDecoration?, symlinkKind?, freshness
}
```

Host 提供 `roots/listChildren/reveal/search/subscribe`；Client 只保存 expanded/selected refs 和 bounded row cache。所有 ref 均为 owner-scoped opaque id；breadcrumb 由 owner 返回安全 segments，不从绝对路径拆分。

Explorer 行高桌面默认 28px，coarse pointer 44px；disclosure 与 selection/focus 分离。单击 select + preview，双击或 Enter pin/open，ArrowLeft/Right collapse/expand，Home/End/PageUp/PageDown 导航，typeahead/filter 只匹配已加载安全 label；owner search capability 存在时才提供跨未加载树搜索。

Git decoration 是 composition projection，key 为 repository/worktree ref + file ref/version。Explorer 不执行 stage/unstage；row menu 只转交 typed Git intent。

### 3. Source Control 采用投影与分能力 action，而不是扩大任意 Git argv

保留 `GitTypedActionsCapabilityV1`。V4 新增 optional capabilities：

- `GitStatusProjectionCapabilityV2`：repository/worktree、branch、upstream、ahead/behind、conflict/staged/unstaged/untracked、cursor/revision。
- `GitDiffWindowCapabilityV1`：file/hunk window、next cursor、stage/unstage/discard target、expected revision。
- `GitBranchActionsCapabilityV1`：list/create/switch/delete，delete 需 risk/preview。
- `GitRemoteActionsCapabilityV1`：fetch/pull/push，必须 preflight、approval policy、idempotency 与 receipt。
- `GitWorktreeActionsCapabilityV2`：create/remove/list、Ordo lease blocker/deep-link，不释放 lease。

Source Control 主视图顺序固定为：Repository/Worktree selector → branch/remote summary → commit composer → Merge Changes → Staged Changes → Changes → Untracked。空分组隐藏；全空时显示“工作区干净”、最近 commit 和 Refresh/History，不显示空白卡片。

点击 file row 打开 diff；Open File、Stage、Discard 是分离动作。hunk action 只在 capability 声明时显示。commit 以 owner 返回的 staged revision/digest 为准；提交前 projection 改变时必须重新预览。

### 4. Pane i18n 以 DSH LocaleRuntime 为 owner，local registration 只增加翻译键

新增 namespace `paneWorkbench`，首发 `zh`、`en`。所有用户可见固定 copy 必须通过 typed key：

- Activity Rail、View Picker、group toolbar、Tab/menu、Designer；
- loading/empty/error/stale/offline/conflict/permission/contract mismatch；
- drag/drop、resize、move、close、bulk close live announcements；
- ARIA label、Tooltip、keyboard instructions、count/plural/date/relative time。

`PaneViewRegistrationV1` 只增加 optional local-only `i18n`：

```text
PaneViewI18nRegistrationV1 {
  namespace: string
  labelKey: string
  descriptionKey?: string
  keywordsKey?: string
}
```

现有 `descriptor.label` 保留为 fallback 和旧 consumer 兼容。远端 projection 不得指定 namespace/key。owner-authored resource title 是数据，按原文显示，不当作翻译键。

fallback 顺序为 active locale → language base → English → descriptor fallback。locale 热切换只更新 presentation；不改变 layout ids、Tab order、selection 或 draft。首发不承诺完整 RTL，但所有新 spacing/edge copy 使用 logical start/end 实现，加入 pseudo-long 和 pseudo-RTL 布局测试，防止未来锁死。

### 5. 拖拽动画使用共享 overlay + FLIP，pointermove 不重排真实 DOM

Drag 分为五阶段：`idle → pending → dragging → committing/cancelling → idle`。

1. pointer 超过 6px 或长按 180ms 才进入 dragging；coarse pointer 长按避免与滚动冲突。
2. `document.body` 下的受控 portal 渲染 Tab ghost，包含 icon/title/status，不包含 view content。
3. source Tab 保留占位并降至 45% opacity；目标 group 显示稳定 insertion bar 或 20% edge split zone。
4. edge zone 使用 48px 最小宽度、12px hysteresis；target 未稳定 80ms 不切换，避免边缘抖动。
5. drop 后先原子 dispatch，再测量 first/last rect，用 FLIP transform 在 140ms 内收敛；跨 region ghost 飞向目标 Tab 位置，真实重型 view 只在 commit 后 suspend/attach。

Motion tokens：

| Token | 默认 | 用途 |
| --- | ---: | --- |
| `--dsh-pane-motion-instant` | 80ms | hover/focus/indicator |
| `--dsh-pane-motion-fast` | 120ms | menu/Tab status |
| `--dsh-pane-motion-layout` | 140ms | Tab reorder/move FLIP |
| `--dsh-pane-motion-region` | 180ms | region open/close/maximize |
| easing | `cubic-bezier(.2,.8,.2,1)` | 非弹簧，减少回摆 |

`prefers-reduced-motion: reduce` 或 user motion=`reduced` 时取消位移动画和 ghost flight，只保留静态 source/target indicator 与即时 commit；状态绝不只靠动画表达。Escape、pointercancel、window blur、locale switch、HMR、source unmount 均取消 session、移除 portal/listeners、恢复 source focus 和 scroll。

### 6. Tab 采用“固定区 + 工作区 + 溢出索引”模型

Tab strip 从左到右：pinned segment、normal/preview segment、spacer、More Tabs、group actions。规则：

- pinned Tab 固定在 segment 前部，可拖动排序但不会被 preview 替换；
- 每 group 最多一个 clean preview；title 使用轻微 italic/低强调，首次编辑/Pin/dirty 立即转 pinned；
- active Tab 使用 surface contrast + 2px accent indicator；focus ring 与 active 分开；
- dirty、attention、offline、orphaned/contract mismatch 使用 icon + accessible text/Tooltip，不只用颜色或小圆点；
- close 是独立可聚焦 action，不嵌套在 `role=tab` button；dirty close 先 owner preflight；
- 同 owner/ref/version 默认激活已有 Tab，只有显式 Duplicate 创建新实例；
- 可用宽度不足时优先保留 active、pinned 和 dirty Tab；其余进入可搜索 More Tabs listbox，不静默消失；
- 30 个以上 Tab 时 strip 使用窗口化测量和索引，不让所有 hidden tab 持续布局；
- Close Others/Right/Group 先收集所有 close policy，原子提交或整体拒绝。

Tab title 桌面 min 88px、preferred 136px、max 220px；touch target 不低于 44px；Bottom 浅高度允许 32px compact strip。长标题采用中间省略或尾部省略，Tooltip/accessible name 提供完整 title。

### 7. Workspace Designer 是可最大化 Core View，未来可投影到官方 Settings Page

V4 注册 local singleton `dsh.workspace-designer`：`role=inspector`、`showInPicker=false`，入口为 Rail Customize 和 Pane More → Customize Workspace。打开后默认 maximize 当前 region；Designer 自身不出现在可拖 provider palette，避免递归配置。

Designer 可配置：

- Right/Bottom visibility、size、split direction/ratio 和最多 4 个 group；
- provider 默认 region/group/role、singleton launcher、Activity Rail order/visibility；
- preview-on-single-click、restore behavior、Tab overflow policy；
- motion preference `system/full/reduced`；
- preset scope `session/workspace/profile`。

Apply 前提供 diff summary：移动/创建/隐藏 group 数、受影响 views、dirty/deny blockers、缺 capability providers、响应式风险。Profile scope 只有 settings owner 返回 allowed action 时可选；Save As 通过 `PaneWorkspacePresetServiceV1`，不得直接写 JSON/YAML/local config：

```text
validateDraft(draft) -> report
applyDraft(draft, expectedGeneration) -> receipt
listPresets(scope) -> safe summaries
savePreset(request) -> receipt
deletePreset(request) -> receipt
resetScope(request) -> receipt
```

内置 preset 为只读：`Focus`、`Code`、`Review`、`Media`。自定义 preset 保存结构，不保存当前文件路径、terminal output、resource body 或 live credential。删除 preset 不删除已打开 view 或领域数据。

### 8. 交互状态必须描述用户看到什么

| Surface | Loading | Empty | Error | Success | Partial/Stale |
| --- | --- | --- | --- | --- | --- |
| Explorer | 保留已加载树，目标行 skeleton | root 存在但无 entries，提供 New/Open action | 行内 retry，不清空其他节点 | selection/preview 明确 | stale badge + Refresh/Compare |
| Source Control | 保留旧 projection，header 显示 syncing | clean workspace + recent commit | typed error + retry/doctor | receipt 后等待 projection 收敛 | ahead/behind unknown、partial diff 标范围 |
| Diff | 首个 hunk skeleton，toolbar 可关闭 | binary/no diff 说明与替代动作 | 当前 file error，不影响 Changes | staged/unstaged state来自新 projection | loaded hunks/total + Load more |
| Drag | ghost/target indicator | 不适用 | invalid zone 显示原因 | FLIP 收敛 + announcement | capability/size blocker 保留 source |
| Tabs | orphan placeholder 可关闭/重试 | group 显示 Open View | 单 view error boundary | active/pinned/dirty 可扫描 | offline/stale/compatibility badge |
| Designer | safe skeleton，不挂真实 view | 首次使用提供 presets | validation list 聚焦首错 | Apply receipt + layout generation | external generation drift 要求 Rebase |

### 9. 响应式、键盘和辅助技术是同一合同

- `>=1200px`：Right/Bottom 同时 dock；Designer 三栏。
- `768–1199px`：只保证一个 active auxiliary region，另一 region 保持 canonical 但投影隐藏；Designer Palette/Inspector 可折叠。
- `<=600px`：单 Sheet，Activity Rail 变底部/顶部 switcher，Tab 可横向滚动 + More；Designer 三步 wizard。
- keyboard：Tree APG、Tabs APG、menu/listbox APG、separator、keyboard drag/move mode；所有 pointer action 有 command/menu 等价。
- screen reader：region/group/Tab count、drag source/target/result、Git action risk、Designer validation 使用节流 live region。
- high contrast：border/indicator 不依赖半透明填充；reduced motion 如上；coarse pointer target 至少 44px。

### 10. 性能与证据预算

- 10,000 entry tree：窗口化 rows，展开/scroll 不把全部节点放进 DOM；watch event 只更新对应 ref。
- 2,000 changed files：Changes 分组虚拟化；diff window 分页；commit composer 不订阅每个 row 的 React 高频状态。
- drag pointermove：每帧最多一次 ghost transform/target publish，drop 前 controller dispatch 为 0，drop 时恰好 1 次 layout intent。
- locale switch：不重建 controller、registry、view instances 或 heavy renderer。
- Tab overflow：30+ tabs 不产生无界 layout observer；More Tabs 搜索在本地安全 metadata 上完成。
- Designer preview：只渲染 placeholder，不 activate provider；Apply 才触发真实 lifecycle。

浏览器证据覆盖 1440、1024、768、390px，zh/en/pseudo-long、full/reduced motion、mouse/touch emulation、keyboard-only、high contrast。集成证据写入本项目 `temp/integration-test-runs/<run-id>/`。

### 11. 合同演进采用 additive capabilities 和 expand-then-contract

| Surface | 分类 | 兼容策略 |
| --- | --- | --- |
| `PaneViewRegistrationV1.i18n` | additive optional | 旧 registration 使用 `descriptor.label` fallback |
| `PaneWorkspaceIntentV1.apply_workspace_draft` | additive enum member | 旧 controller 不暴露 Designer capability；新 client capability gate |
| `PaneWorkspaceDraftV1` / preset service | new pre-1.0 | 明确 `v1alpha1`，稳定点由后续 RC 记录 |
| File/Git V2 capabilities | additive parallel | V1 继续 probe；不修改 V1 action 含义 |
| persistence optional fields | additive optional | reader 忽略未知字段；writer 继续输出 V1 safe subset 直到 migration gate |

V4 不删除旧字段、action、provider 或 preset。未来若收缩旧面，至少保留一个 RC deprecation、consumer inventory 和 rollback change。

## Delivery Slices

| Slice | 范围 | Gate |
| --- | --- | --- |
| V4-Foundation | i18n、Tab system、drag ghost/FLIP、shared tokens | existing reducer/component tests + browser matrix |
| V4-A | Explorer tree、Git decoration、Changes/diff/stage/commit | file/Git owner capabilities + stale/conflict/receipt tests |
| V4-B | branch/worktree/remote gated actions、Workspace Designer/presets | approval/receipt/settings service + atomic draft apply |
| V4-C | performance hardening、pseudo-RTL、future Settings Page adapter | large fixture/profile evidence，不阻塞 V4-A 日常工作流 |

用户要求的六项能力全部 retained。分 slice 是依赖顺序，不是删除或永久降级。

## Risks / Trade-offs

- [V3 仍把相关 lane 标为 parked] → V4 proposal 作为后续 scope-change source；实施时在 V3 添加交叉链接，不改写其历史决策。
- [跨 React root FLIP 难以直接移动真实节点] → ghost portal 负责连续视觉，真实 view 只在原子 commit 后切换宿主。
- [locale 长文本挤压 Tab/toolbar] → pseudo-long、More Tabs、Tooltip、icon-only control accessible name；不靠缩小字体解决。
- [File tree 与 Git projection cursor 不同步] → 分 owner freshness；decoration stale 时单独标记，不阻塞文件浏览。
- [stage/commit 期间 repository revision 变化] → expected revision + preflight digest；拒绝旧 intent并 reconcile。
- [Designer Apply 会关闭 dirty/deny Tab] → 默认 keep-in-place；只有用户显式选择关闭且 owner preflight 通过才可应用。
- [Preset 绑定已卸载 provider] →保留 safe placement，显示 capability warning；不自动安装 plugin。
- [过度动效影响效率] →短时、无弹簧、仅解释层级变化；system/reduced preference 和零动效合同。
- [Remote Git action扩大风险] →独立 capability，默认不显示；target/branch/upstream/digest、approval、idempotency 和 receipt 缺一不可。

## Migration Plan

1. 冻结 i18n keys、motion tokens、Tab presentation 和 Designer draft contracts；新增兼容测试固定旧 registration/intent/persistence。
2. 将 Pane chrome 固定文案迁入 `paneWorkbench` namespace；保留 `descriptor.label` fallback。
3. 在不改变 reducer 语义的前提下加入 drag overlay/FLIP 和 Tab presentation；先 component/browser evidence，再开启 production styles。
4. 增加 FileTree/Git V2 capability types 与 host probes；旧 V1 provider 保持按需/有限 action。
5. 交付 Explorer 与 Source Control read path，再逐步开启 stage/unstage/commit、branch/worktree/remote mutation。
6. 交付 Workspace Designer draft/validate，随后开启 Apply；最后接 settings-backed preset save/delete。
7. V4 browser/integration gates 全绿后，更新根级 DSH Pane handoff 和 V3 parked lane 交叉引用。

回滚：关闭 V4 feature flags/registration，恢复上一版 Pane bundle；旧 reducer、V1 capabilities、layout persistence 和 provider registration 仍可工作。V4 preset 采用独立 namespace，回滚不删除 preset，旧版本忽略未知 namespace。

## Open Questions

- DSH 何时提供正式 Settings/Page extension seam；在此之前采用最大化 Core View，不能以私有 router 或 DOM 注入实现页面。
- Git remote owner 是否能在 V4-B 前提供完整 preflight/approval/receipt；若不能，Source Control 必须显示 remote capability unavailable，但保留 branch/ahead-behind read projection。
- pseudo-RTL 先作为布局防回归测试，不在 V4 宣称完整阿拉伯语/希伯来语内容支持；正式 RTL 语言需独立 copy/QA 证据。

## NOT in Scope

- 任意 CSS/theme 设计器、插件代码生成器或 remote component marketplace。
- Git interactive rebase、bisect、submodule 管理、credential UI、force push 默认入口。
- 文件内容编辑器、LSP、debug adapter、merge algorithm 或浏览器内 shell。
- 共享/同步用户 preset 到云端；V4 只依赖 DSH 已批准 settings scope。
