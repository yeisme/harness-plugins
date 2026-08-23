## Why

DSH 已有唯一 Pane Workbench Core、Right/Bottom 宿主、基础 split/drag/tab reducer 和 File/Git capability probe，但当前工作区仍停在“能打开、能移动”的工程基线：目录树缺少可扩展的层级浏览和 Git decoration，Source Control 缺少完整 staged/unstaged/conflict/diff/commit 工作流，Pane 管理文案大量硬编码英文，拖拽没有连续视觉反馈，Tab 缺少溢出与状态层级，也没有让用户安全设计并保存 Pane 布局的页面。V3 曾把这些 lane 标为 `commodity-parked`；本 change 根据用户明确要求将它们恢复为 required delivery，而不是继续依赖外部插件或等待未来官方吸收。

## What Changes

- 重做 Explorer 与 Source Control 的组合体验：workspace/repository/worktree 选择、惰性目录树、过滤/定位、Git decoration、Changes 分组、diff/hunk、stage/unstage、commit、branch/worktree 与受控 remote action。
- 在既有 `FileWatchCapabilityV1` 与 `GitTypedActionsCapabilityV1` 旁新增可选 projection/action capabilities；旧 V1 probe、旧 provider 和既有 `registerView()` consumer 保持有效，V4 不重定义旧 action 语义。
- 为 Pane Workbench 建立 `paneWorkbench` locale namespace，覆盖可见文案、菜单、Tooltip、错误、空状态、ARIA label、live announcement、复数和快捷键说明；首发 `zh`/`en`，增加 pseudo-locale 与 fallback 测试。
- 完善拖拽与布局动效：共享 drag overlay、Tab ghost、稳定 drop zone、插入占位、跨 Right/Bottom 连续反馈、drop 后 FLIP 重排、取消恢复、键盘等价和 `prefers-reduced-motion` 降级。
- 重做 Tab 系统：pinned/preview 分区、dirty/attention/offline/orphaned 状态、明确关闭控件、溢出搜索、重复资源去重、bulk close 预检、窄 Pane 和触摸布局。
- 新增 `Workspace Designer`：用户可在草稿画布中配置 Right/Bottom、split、group、默认 provider、Activity Rail、Tab policy、motion 和 preset scope；Apply 通过唯一 reducer 原子提交，Save 通过 DSH settings/application service 持久化安全 preset。
- 将 `Workspace Designer` 先作为本地受信任、可最大化的 singleton Core View 交付；未来 DSH 若提供正式 Settings/Page seam，只复用同一 headless draft/service，不迁移或复制 canonical layout。
- 建立桌面、紧凑、390px Sheet、键盘、屏幕阅读器、高对比、reduced motion、断线/stale/conflict 与大仓库性能证据矩阵。

## Admission Decision

结论：`split-owner`。

| 能力 | Canonical owner | V4 可见宿主 | 准入 |
| --- | --- | --- | --- |
| File tree projection/action | DSH fs/file host | Explorer Pane | split-owner |
| Git repository/worktree/projection/action | Git host/repository | Source Control Pane | split-owner |
| Pane layout、Tab、drag、locale 与 preset draft | Harness Plugins | Pane Workbench Core | fit |
| DSH locale/settings persistence | DSH locale/settings owner | Workbench adapter | split-owner |
| Ordo writer lease/worktree fence | Ordo | Git deep-link/阻塞说明 | split-owner |

Explorer 不成为文件系统，Source Control 不成为 Git daemon，Workspace Designer 不成为第二 Pane reducer，Git Pane 不释放 Ordo lease。

## Required Capability Ledger

| 用户要求 | 状态 | Delivery slice | 验收证据 |
| --- | --- | --- | --- |
| 目录树交互完善 | required | V4-A | lazy tree、keyboard、preview/pin、watch reconcile、Git decoration component/browser tests |
| Git 交互完善 | required | V4-A/V4-B | Changes/diff/stage/commit 首发；branch/worktree/remote gated action 随 capability 开启 |
| Pane 管理与交互 i18n | required | V4-Foundation | zh/en/pseudo locale matrix，所有 chrome 与 announcement 无硬编码用户文案 |
| 拖拽动画完善 | required | V4-Foundation | ghost/drop placeholder/FLIP/cancel/reduced-motion/browser performance evidence |
| Tab 设计完善 | required | V4-Foundation | pinned/preview/dirty/status/overflow/bulk close/keyboard/390px tests |
| 设计页面配置 Pane | required | V4-B | draft/validate/apply/save/rollback/preset scope tests 与浏览器证据 |

没有 `reject-now` 项。Remote Git write、profile-wide preset 和 destructive file/Git action 必须通过 owner capability、preview、approval 与 receipt，不能以“后续”名义删除，只能在 capability 未就绪时诚实禁用。

## Capabilities

### New Capabilities

- `dsh-explorer-source-control-workbench`: Explorer、Git decoration、Source Control、diff/hunk、commit、branch/worktree/remote action 和 owner 边界。
- `dsh-pane-management-i18n`: Pane chrome、管理动作、错误、空状态、ARIA 与 live announcement 的 locale 合同和运行时切换。
- `dsh-pane-drag-motion`: Tab/group 跨 Pane 拖拽视觉模型、原子提交、FLIP 动效、取消恢复、键盘等价与 reduced motion。
- `dsh-pane-tab-system`: Tab 信息层级、生命周期、状态、溢出、关闭策略、焦点和响应式行为。
- `dsh-workspace-layout-designer`: Workspace Designer 草稿、校验、原子应用、preset scope、settings owner 持久化和兼容回退。

### Modified Capabilities

无。V4 通过新 capability 和 optional public fields/symbols扩展现有 pre-1.0 Pane surface；`pane-workbench-interaction`、`dsh-file-watch-pane` 与 `dsh-git-typed-actions-pane` 的既有要求保持不变。

## Impact

- Pane Core：`packages/client/ui-pane-workbench/`、`packages/bundle/pane-workbench/`。
- File/Git：`packages/host/dsh-file-host/`、`packages/host/dsh-git-host/`、对应 client/bundle provider 与 upstream capability staging。
- DSH 公共 seam：locale/settings 注入、可选 file tree/Git V2 capabilities；缺 seam 时 provider 必须显示 typed unavailable，不得轮询或接受任意 argv。
- 公开 TypeScript 面只增加 optional registration i18n/presentation、draft/preset service 和新 capability types；旧构造器、旧 descriptor、旧 V1 actions 与存量 layout persistence 继续可读。
- 证据写入 `temp/integration-test-runs/<run-id>/`，不得包含绝对路径、credential、raw prompt、provider payload、private tool arguments 或完整思维链。
