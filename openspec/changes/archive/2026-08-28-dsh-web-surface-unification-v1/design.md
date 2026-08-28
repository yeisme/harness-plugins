## Context

当前仓库已经有 `@yeisme/dsh-client-ui-visual-kit` 统一 token fallback、状态 tone 与 scoped CSS，但它只约束颜色和少量 class，不约束 pane 内容骨架。`ui-creator-studio` 保留完整 `cs-*` 设计语言，`ui-pane-workbench` 的 Source Control 输出 `pwr-*` class 却没有任何命中规则，dialog/overlay/dock 还混用官方 primitives、局部 CSS 和 inline style。

本 change 与以下活跃工作并行但不重叠：

- `dsh-unified-panel-visual-system-v1`：继续作为 token/fallback owner。
- `dsh-web-pane-experience-completion-v1`：继续作为 host tier、tab、drag、overlay chrome owner。
- `dsh-creator-unified-pane-workspace-v2`：已经交付 project assets、generation、approvals、Drama face 与旧 kind 兼容；本 change 只重排其 Web 表现。

官方 `@deepseek-ai/dsh-client-ui-primitives` rc.6/rc.7 已提供 Button、Input、Modal、Menu、Pill、StateDot、DiffBlock 等原子控件。仓库包同时存在 React 18.2 与 18.3；新 composition 包必须使用两版 primitives 的公共交集，不强制全仓升级 React 或 primitives。

### UI Spec

- 产品姿态：深色工程工作台，克制、高密度、低饱和、非营销。
- 主题 owner：官方 DSH host；Yeisme 只消费 `--dsw-*`/`--dsw-alias-*` 并提供 canonical fallback。
- 页面模式：navigator 使用 list/tree；workspace 使用 overview 或 list+detail；inspector 使用 diagnostics；dialog 使用集中任务；micro 只承载一个动作。
- 间距：4/6/8/10/14px；圆角：6/8/10/12px；主控件高 30/34px，coarse pointer 至少 44px。
- 颜色：一个 accent；positive/info/warn/critical/neutral 只表达语义；不使用任务装饰色、紫蓝渐变、玻璃拟态或无意义卡片。
- 动效：只保留 120–180ms hover/open/drag 状态反馈；`prefers-reduced-motion` 关闭非必要动画。
- 响应式：surface 根使用 `container-type:inline-size`；compact `<=420px`、standard `421–720px`、wide `>720px`。容器宽度只改变布局，不改变 mutation/approval admission。

## Goals / Non-Goals

**Goals:**

- 用最小 React composition 层统一全部 Web surface 的内容骨架，同时复用官方 primitives。
- 修复 Source Control 裸控件与 Creator Studio 卡片/导航层级问题。
- 让每个迁移 surface 具备 ready/loading/empty/error/stale/partial/disabled 的适用状态、键盘路径和可见原因。
- 通过确定性 Playwright screenshots 与语义测试共同阻止视觉回归。
- 按四波迁移，单波可验证、可回滚，不保留运行时双 UI。

**Non-Goals:**

- 不修改 TUI、DSH AppFrame 几何、Pane split/dock owner 或官方主题实现。
- 不新增 Storybook、Tailwind、Chromatic、Lighthouse、Axe 或新动画 runtime。
- 不改 Owner 投影、mutation admission、审批账本、terminal state 或真实外部集成。
- 不删除 view kind、command、data attribute、旧 class 或兼容字段。

## Decisions

### 1. 新建最小 React composition 包，不扩张 visual-kit 运行时职责

新增 `@yeisme/dsh-client-ui-surface`，公开面只包含：

- `Surface`：根容器，`kind=navigator|workspace|inspector|dialog|micro`，注入 fixed scoped styles 与 container context。
- `SurfaceContextBar`：context、description、status、nav、actions 五个 slot；Pane 不重复宿主 tab title，dialog 可提供 heading。
- `SurfaceSection`：title、description、meta 与 body。
- `SurfaceState`：phase、title、description、action，负责 role/aria-live/tone。
- `SurfaceActionBar`：普通或 sticky action row。

只额外导出上述 props、`SurfaceKind` 与 `SurfacePhase` 类型。包依赖 visual-kit，peer 为 React `>=18.2 <19` 与 primitives `>=0.1.0-rc.6 <0.2.0`，不依赖 Cordis，不重新导出官方 primitives。

备选一：只扩写 CSS class。否决，因为全仓 surface 仍会复制 header/state/action DOM。备选二：自建完整组件库。否决，因为官方 primitives 已覆盖 atoms。

### 2. Surface 只统一骨架，内容密度由 kind 和容器决定

`Surface` 根固定 `data-yeisme-surface` 与 `data-surface-kind`，使用同一背景、排版、focus 与 state CSS。业务组件可保留旧 class，并同时使用 `ys-*` composition class；包内 CSS 必须限定在 surface scope。

- navigator：紧凑列表、树、source control，默认无 card。
- workspace：overview、资源/动作双栏，宽屏可双栏。
- inspector：状态矩阵、详情与诊断。
- dialog：通过官方 Modal/Menu 提供 overlay/focus owner，Surface 只负责内容。
- micro：chip、retry、suggestion、inline action，不渲染 Context Bar。

原生 `select`/`textarea` 必须放在 `.ys-field` 中；Button/Input/Menu/Modal/Pill/StateDot/DiffBlock 直接使用官方 primitives。动态进度宽度、拖拽坐标、测量几何允许 inline style，业务配色和顶层 layout 不允许。

### 3. Source Control 使用 navigator 结构并恢复正确优先级

顶部 Context Bar 按 repository selector、branch/upstream/ahead-behind、Refresh 排列。非 ready 状态显示共享 State，不清空最后安全 groups。clean 状态显示 `recentCommit`、branch 状态和 Refresh；History 只有 action 已提供时才显示，禁止死按钮。

commit composer 只在 staged group 非空时展示；remote unavailable 作为 info/disabled 状态，不渲染原生灰按钮。文件 row 继续虚拟化并保留 Open Diff/Open File/Stage 语义与键盘合同。

### 4. Creator Studio 复用现有多 Pane 模型并增加生命周期视觉分组

不创建新的 canonical view kind，也不把所有任务塞进单 tab。现有 view/command 按以下视觉分组排序：

- Start：home。
- Create：text、visual、audio。
- Produce：production、generation；jobs 作为 generation 兼容别名。
- Review：approvals、analysis；review 作为 approvals 兼容别名。
- Library：context、assets、media。

首页固定层级为“下一动作 → Production 状态 → 待审队列”。Owner 状态从六卡片矩阵移到 Context Bar 的 disclosure/status panel；完整列表仍可键盘访问。任务 Pane 统一 Context Bar、资源主体与 Owner action composer：wide 双栏，standard/compact 单栏。只让媒体、产物和真实可点击入口使用 card；普通状态、审批、run、Owner 与文本资源使用 row。

`useCompactMode()` 继续只服务既有风险策略，布局不再依赖它；CSS container query 不参与 mutation admission。所有新文案进入现有 zh/en/pseudo i18n，不保留 inline English fallback。

### 5. 全 Web surface 按一规格四波迁移

1. Foundation：surface 包、conformance、fixture runner。
2. Workbench/tools：pane-workbench、desktop-workbench、mcp-inspector、devtools、token-usage、session-cookie-manager，以及 file/document、rich-media、terminal、workbench-core/compose bundle UI。
3. Creator/agents：creator-studio、ai-drama-director、pane-domain、pane-agent-context、pane-subagent、ordo-agent-ops。
4. Dialog/micro/embed：command-experience-web、agent-preset、session-tags、next-step-suggestions、conversation-rewrite、structured-content、mermaid-render 与剩余 bundle inline Web UI。

同一个包含 pane 与 overlay 时在该包所在波次一次迁完。Mermaid/Markdown table 等嵌入 renderer 不包 Surface，只消费统一 token、focus 和排版规则。`ui-command-experience-tui` 被全局检查显式排除。

### 6. 语义门与 Playwright 截图组成双验收

新增根脚本 `scripts/check-ui-surface-contracts.mjs`，显式 catalog 所有 Web UI package，检查：已迁移根 surface 标记、禁止分歧 token fallback、禁止未白名单顶层 inline style、raw select/textarea 必须位于共享 field。动态几何白名单按文件+用途记录在脚本代码中，不新增 JSON/YAML registry。

新增 `tests/ui-visual/` fixture，用现有 tsdown/Playwright 构建和运行，不引入 Vite/Storybook。代表性 surface 在 360/560/960px 固定容器内截图；关键 surface 三宽度覆盖，其他 surface 至少一个自然宽度。基线 PNG 受版本控制，actual/diff/console/evidence 写入 `temp/integration-test-runs/<run-id>/artifacts/`。

`pnpm run test:visual` 始终生成 summary.json、command.txt、stdout.log、stderr.log、env.json 与 artifacts，失败保持原 exit code并脱敏。截图关闭动画、固定 locale/time/data，`maxDiffPixelRatio=0.005`。

### 7. 兼容与演进只做 additive

新 package/export 为 pre-1.0 experimental。所有现有公开 view kind、command、public TS symbol、bundle path 与 DOM data attribute 保持；`cs-*`/`pwr-*` 至少保留本 release。没有数据库或持久化迁移。每波回滚为回退该波 package 版本/提交，visual-kit 与 Owner canonical state 不受影响。

## Risks / Trade-offs

- [全仓范围大且当前 worktree 有并行改动] → 每波只触碰显式 catalog，先跑 focused tests；最终失败先分类 introduced/pre-existing/concurrent。
- [official primitives rc.6/rc.7 差异] → 只使用两版公共 export，不使用 rc.7 独有 hook。
- [截图在不同系统字体下漂移] → CI/证据使用固定 Chromium/Linux 环境、固定 fixture font fallback 与 0.5% 容差。
- [共享 Surface 变成第二套 atoms] → API 限定五个 composition components；Button/Input/Modal/Menu 等永远由官方包提供。
- [Creator 视觉重排影响已交付能力] → view/command/Owner action 不删除；旧 kind 继续指向新视觉组件并保持 legacy 标记。

## Migration Plan

1. 发布 surface package 与 conformance/visual runner，不改业务 UI。
2. 迁移工作台与工具包，先解决 Source Control 裸 UI。
3. 在 `dsh-creator-unified-pane-workspace-v2` 现有功能上迁移 Creator/Agent surface。
4. 迁移 dialog/overlay/micro/embed，并把 catalog 覆盖提升到全部 Web UI package。
5. 运行 focused、全量、bundle、visual、strict OpenSpec 门；不在本 change 删除兼容 class。

## Open Questions

无。TUI、旧 class 清理、官方 primitives 新版专属 API 与真实 `dsh web` 截图验收均另开 change。
