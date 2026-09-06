# 工作区搜索与打开（Search and open）

本轮把"添加面板"升级为统一搜索入口：分组结果（最近／已打开／常用／会话／窗格／命令）、类别与条件筛选、稳定结果身份、有限内存缓存、定位已打开／右／下／悬浮打开、固定为搜索 Pane。宿主工作台（unified host）侧经 `workspace.search` 启动命令与目录行直达同一搜索 Pane。

## 操作变化

- 旧"添加面板"顺序堆叠列表被替换：空查询按最近使用（≤5）、已打开（≤5）、常用工具（≤8）分组；输入后按会话／窗格／命令分组，每组默认 5 条可展开。
- 类别（全部／会话／窗格／命令）+ 已打开／项目范围筛选，筛选不改变结果身份（stableKey 跨筛选一致）。
- Enter 打开并定位；右键菜单／→ 键提供右侧／下方／悬浮打开；"将搜索固定为窗格"转入单例搜索 Pane，重复打开复用同一 Pane。
- 历史来源缺失时诚实显示"当前宿主不支持历史搜索"，无假分页、无伪造会话行；不把 mock 适配当真实查询。

## 实测截图与证据

- [空查询分组](../../temp/integration-test-runs/workspace-search-host-chain-2026-09-06T16-45-10-1717037/artifacts/01-search-empty.png)、[查询 Git](../../temp/integration-test-runs/workspace-search-host-chain-2026-09-06T16-45-10-1717037/artifacts/02-search-git.png)、[筛选后](../../temp/integration-test-runs/workspace-search-host-chain-2026-09-06T16-45-10-1717037/artifacts/03-search-filtered.png)、[打开结果后](../../temp/integration-test-runs/workspace-search-host-chain-2026-09-06T16-45-10-1717037/artifacts/04-after-open.png)。
- 真实运行宿主全链（官方 dsh web profile + 32 本地 bundle）：13/13 检查通过，[结果](../../temp/integration-test-runs/workspace-search-host-chain-2026-09-06T16-45-10-1717037/summary.json)。
- 阶段 A 组件级验收（360/560/960、200% zoom、中英、邻 Pane 隔离、5000 条 p95）：[证据](../../temp/integration-test-runs/workspace-search-stage-a-2026-09-06T10-05-35-478Z-1677358/summary.json)。

## 能力结果表（真实 / mock 边界）

| 能力 | 状态 | 边界说明 |
|---|---|---|
| 本地目录搜索（窗格/命令） | 真实（宿主链验证） | 注册快照即时过滤，无网络请求 |
| 历史会话搜索 | owner 缺失，诚实降级 | `live_query=not_verified`；适配合同 available/unavailable/contract_mismatch 已验证；解锁条件=宿主提供 conversation-search owner |
| 分页/加载更多 | 合同已验证，UI 未激活 | 历史不可用时不渲染 Load more |
| 缓存（32 页/1000 摘要，30s TTL/5min stale） | 组件测试验证 | 内存 LRU，键含权限/项目上下文；无持久化查询词 |
| 最近使用/命名筛选偏好 | 组件测试验证 | 仅结构化引用过宿主偏好 seam，失败降级可用 |
| 固定搜索 Pane / 单例复用 | 真实（宿主链验证） | 重复启动命令不堆叠第二实例 |
| 拖入工作区 | 组件级真实指针验证（4.2） | 统一宿主固定 Pane 形态无拖放目标，如实记录 no-drop-target-in-pane-mode |
| 性能（5000 条本地 p95） | 17.77ms（预算 100ms） | 阶段 A 证据 |

## 验证

| 检查 | 结果 | 证据 |
|---|---|---|
| ui-pane-workbench 包测试 | 383 项通过 | 本地复跑 exit 0 |
| typecheck / build / check:bundles | 27/27 通过，exit 0 | 本地复跑 |
| check:surfaces / test:visual / check:plugins | 92/92 视觉 + 六检查器 0 findings | [toolchain 报告](../../temp/toolchain-runs/2026-09-06T164607632Z-toolchain/)、[视觉证据](../../temp/integration-test-runs/ui-visual-2026-09-06T16-46-20-252Z-1737455/summary.json) |
| 宿主联合门（Playwright 全链） | 13/13 通过 | [结果](../../temp/integration-test-runs/workspace-search-host-chain-2026-09-06T16-45-10-1717037/summary.json) |
| upstream-prs 系列 apply-check | 干净基线 `a66e4702` 可应用 | 2026-09-06 fresh worktree 复验 |

## 启动与回退

启动：`pnpm dsh:dev`（工作台入口沿用 [完整工作台交付](dsh-unified-multi-pane-acceptance-2026-09-05.md)）。搜索入口：工作台 `+` 搜索 "Search"，或 `/search` 命令。

回退：从 profile 移除 `@yeisme/dsh-pane-workbench` 行即回到宿主自带选择器；搜索偏好与最近使用仅存安全引用，无数据迁移。架构记录见 [Agent Note](../../.agents/notes/proposed/architecture/2026-09-06-workspace-search-experience.md)。
