# Project Data Workspaces V1 — 前端依赖审计（Task 0.3）

> 审计时间：2026-08-23。审计对象：`@tanstack/react-table`、`@tanstack/react-virtual`、`@dnd-kit/core`（含 `@dnd-kit/sortable`、`@dnd-kit/utilities`）。复用确认：`@xyflow/react@12.11.2`（Canvas 已在用）、`dockview-react@7.0.2`（Pane dock 已在用）——不新增第二套 flow/dock 库。

## 1. 决策汇总

| 依赖 | 决策 | 固定版本 | License | React 19 peer | 依据 |
| --- | --- | --- | --- | --- | --- |
| `@tanstack/react-table` | **adopt（v8 稳定线）** | `^8.21.3` | MIT | `react >=16.8` ✓ | v9.1.2 为 `createTableHook` 全新重写 API（2026 新 major），生态文档薄；v8 API 稳定、类型完备、peer 显式覆盖 React 19。canary 通过。 |
| `@tanstack/react-virtual` | **adopt** | `^3.14.10` | MIT | `^16.8 \|\| ^17 \|\| ^18 \|\| ^19` ✓ | 官方 peer 明列 React 19；canary 证明 5000 行只挂载有界行集。 |
| `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities` | **adopt** | `^6.3.1` / `^10.0.0` / `^3.2.2` | MIT | `react >=16.8` ✓ | 同一引擎家族（sortable peer 依赖 core `^6.3.0`）；KeyboardSensor + `sortableKeyboardCoordinates` canary 通过。 |
| `@xyflow/react` | **复用，不新增** | `^12.11.2`（既有） | MIT | 既有 ✓ | Canvas 视图直接复用，无需任何变更。 |

### 未采纳的替代方案

- **react-table v9**：类型层重写（`TableFeatures` 泛型、`createTableHook`/`useTable`），现有 v8 生态与团队知识不覆盖；收益（实验性 worker 插件）不抵迁移风险。若未来 v8 停止维护再评估。
- **ag-grid / handsontable / react-window / react-beautiful-dnd / react-dnd / sortablejs**：lockfile 全量扫描零命中，**不引入**——保持单一 table 引擎（react-table）、单一虚拟化引擎（react-virtual）、单一 DnD 引擎（dnd-kit）。
- **fallback 方案（canary 失败时启用，本次未触发）**：server-paginated semantic table + 菜单/键盘移动（design 决策 17 既有约定）。

## 2. Canary 证据

新增 `apps/web/test/project-data-dependency-canary.test.tsx`（3 tests，全部通过）：

1. **react-table + react-virtual**：5000 行 typed table，断言挂载行数 `0 < mounted < 50`（视口 + overscan 有界集合，不是全量渲染），columnheader 点击排序后 `aria-sort="ascending"`。
2. **dnd-kit 键盘链路**：KeyboardSensor 完成 Space 拾取 → ArrowDown 移动 → Space 放下，DOM 顺序 `a,b,c → b,a,c`（jsdom 无布局，测试内为 `<li>` 提供 DOM 顺序确定性矩形 mock，恢复原 `getBoundingClientRect`）。
3. **a11y 语义**：可排序节点暴露 `tabindex`、`role="button"`、`aria-roledescription="sortable"`、`aria-describedby`（dnd-kit 屏幕阅读器指令）。

不变量（测试头注释）：虚拟化有界挂载；DnD 键盘路径是必需能力；不引入第二套 table/DnD 引擎。失败语义：canary 失败 = 不 adopt，回退 semantic table + 菜单/键盘移动，不阻断合同 lane。

## 3. 版本/bundle/共存验证

| 检查 | 结果 |
| --- | --- |
| `bun install --frozen-lockfile` | PASS（lockfile 一致） |
| `bun run typecheck`（根 + apps/web） | PASS |
| 根 canonical `bun test packages/task-sdk` | 362 pass / 0 fail |
| `apps/web` vitest 全量 | 122 files / **1025 tests pass**（含新增 canary 3 tests；基线 121/1022） |
| `bun run web:build`（生产构建） | PASS（6.9s；`dockview` 359KB、`ui-vendor` 612KB chunk 与基线一致——新依赖尚未被生产代码 import，bundle 暂不增长；后续 Table/Kanban pane 按既有 pane 懒加载约定代码分割） |
| 重复库扫描 | `ag-grid\|react-window\|react-beautiful\|react-dnd\|sortablejs\|handsontable` 在 `apps/web/package.json`、根 `package.json`、`bun.lock` 均零命中 |
| Dockview / React Flow 共存 | 生产构建 + 全量组件测试通过，无 peer 冲突、无运行时冲突 |

## 4. 后续约束

- 版本以 `bun.lock` 固定为准；不为通过 canary 升级无关依赖或 Node/Bun 主版本（本次未升级任何无关依赖）。
- Table/Kanban 视图实现（Lane W）必须延续 canary 的不变量：服务端分页/虚拟化、键盘可达、无第二引擎。
