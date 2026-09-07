# Project Data Next Slice — 决策台账（Tasks 1.1–1.5）

> 冻结时间：2026-08-27。本文是 `workbench-project-data-next-v1` 的唯一决策台账，逐项落地 proposal.md「next-slice ledger」的 deliver-next / retain-next / reject-now 判定、理由与 owner-fit。判定纪律遵循 `agent-platform-prd`：首次提出即判 `fit|split-owner|reject-now`；retain-next 项不得静默删除或默认排期，reopen 时必须附新证据并重新做 fit/split-owner 评估（见本 change spec「Project data next-slice 决策须证据驱动且不静默删项」）。

## 0. 决策输入证据

| 证据 | 结论 | 出处 |
| --- | --- | --- |
| 首期切片交付 | 四视图（table/kanban/todo/canvas）、五角色、9 custom field kinds、三类首发 trigger、一个低风险 Owner canary 已交付 | `workbench-project-data-workspaces-v1` proposal/tasks |
| 容量与查询证据 | disposable PostgreSQL 50k WorkItem / 64 字段查询无 N+1、keyset 深分页、EXPLAIN 命中索引（**仅验证单 dataset**） | v1 tasks Slice F 证据 |
| Watch 扇出 | 200 流 watch 扇出验证 | v1 tasks 证据 |
| Owner canary | 真实 Owner mutation canary（receipt/status/reconcile/kill switch） | v1 依赖门禁矩阵 §5 / canary selector |
| Schema 迁移 | 字段替换迁移引擎 expand→shadow→compare→enable | v1 design/tasks |
| 12.3 staging soak | r5 run `temp/project-data-staging-soak-r5-preterminal-20260826/`：24h、10087 次观测、p95=1ms/p99=2ms、error_rate=0、availability=1、verdict=pass，receipt `a048fd98-…-e04477cd6914` | `project-data-staging-slo.json` / `finalization-r5.next/project-data-staging-receipt.json` |
| v1 Required Capability Ledger | formula/lookup（P13 committed→next）、form intake（P14 exploratory→next、owner 未定）、dashboard（P15 optional→later）、脚本/webhook（P16 rejected） | `workbench-project-data-workspaces-v1/details/project-data-workspace-prd.md` §3 |

staging soak 的 lag/latency 预算结论（p95/p99 远低于 500ms/1s SLO，error 0）**不触发** form intake 的优先级下调，1.1 维持 deliver-next。

## 1. 决策台账

### 1.1 form intake 视图 — deliver-next

- **判定**：`deliver-next`（下一实现 change 交付；本 change 不含代码）。
- **Owner-fit**：`fit`。表单是一个新视图 kind + 既有 schema 校验复用，不引入新真值：记录真相仍归 WorkItemService，提交仍走 TaskService 四重 gate（permission/cost/expected-version/idempotency），渲染复用 table/kanban 已验证的列/字段管线。属于跨项目导航/可视化/批准动作范畴，不触碰任何 owner 私有状态机。Owner：**workbench web lane**（v1 P14 的 unresolved owner 就此收敛）。
- **实现 change 的必备合同**（reopen 任务化条件）：
  - 视图 kind 合同：form 作为 `ProjectView` closed union 的第五个 kind，复用 ProjectQueryV1 与 field-level validation，不复制记录、不建平行状态。
  - 断网/冲突状态：离线草稿只存本地 UI 状态；提交冲突走既有 expected-version 冲突语义，fail-closed 显示 `conflict`，不自动覆盖。
  - 反滥用：公开 intake 链接的提交限流、鉴权与审计在实现 change 内独立设计并附证据；未设计前公开表单入口保持 `needs_contract`。
  - 浏览器不得直连 owner 或读取 session token；intake 提交只经 `WorkbenchClient` typed client。
- **优先级说明**：12.3 staging soak 通过（p95 1ms / p99 2ms / error 0），lag/latency 预算不构成降级理由，维持下一切片首位。

### 1.2 formula 字段 — retain-next（拆两期）

- **判定**：`retain-next`。本期不实现；合同设计与实现拆为两个后继 change。
- **Owner-fit**：`fit`（Workbench project lane）。计算字段本身可留在 Workbench，但它引入**求值真值与缓存失效责任**——求值顺序、失败语义（除零/类型错误/递归引用）、hidden 字段是否参与求值、求值结果缓存与 schema revision 的失效边界——这些构成一份独立合同，本 change 未验证，不得以「只是字段 kind」名义混入 schema 9 kinds 扩展。
- **Reopen 证据要求**（缺任一即不进入任务清单）：
  1. 独立 spec：求值顺序（拓扑序）、失败语义（fail-closed 显示 error 值，不阻塞记录读写）、hidden 字段参与规则、循环引用拒绝；
  2. 安全证据：表达式闭集（无任意脚本，P16 rejected 边界不破）；
  3. 性能证据：50k 记录 scale 下求值/缓存失效预算（沿用 v1 Slice F 口径）。
- **Owner**：workbench project lane。

### 1.3 lookup 字段 + cross-dataset relation — retain-next

- **判定**：`retain-next`（两项绑定同一组前置证据，同期 reopen）。
- **Owner-fit**：`fit`（Workbench project lane），不涉跨 owner。
- **保留理由**：
  - lookup 依赖 **cross-dataset 读取的权限裁剪**（按目标 dataset 的 ProjectRolePolicy 做行/字段级裁剪）与 **N+1 预算**；v1 的 11.4 容量证据只验证了单 dataset 查询，多 dataset 扇出无实测预算。
  - cross-dataset relation 的**关系完整性未设计**：删除/归档的级联语义（restrict / detach / tombstone）、跨 dataset 迁移时的悬空引用处理均无合同。
- **Reopen 证据要求**：(1) cross-dataset 权限裁剪设计 + 越权测试矩阵；(2) 多 dataset 查询 N+1/扇出预算的 PostgreSQL 实测证据（口径对齐 v1 Slice F）；(3) 级联语义 spec + 迁移引擎兼容性证据。
- **Owner**：workbench project lane。

### 1.4 dashboard 聚合 — reject-now

- **判定**：`reject-now`（本期拒绝，保留未来 reopen 通道）。
- **Owner-fit 与依据**：无真实使用证据；table/kanban 的分组/聚合视图已覆盖首期数据汇总诉求。v1 ledger 中 dashboard 为 P15 `optional → later`，**不是用户硬要求的 required capability**，因此 reject-now 不违反「不得静默删除用户要求能力」的纪律——但本判定**不等于永久删除**：按 spec，未来有真实使用信号时可重新提案，提案 MUST 附信号来源。
- **信号收集路径**：由 product 在日常运营/用户访谈中收集 table/kanban 聚合的真实使用信号，量化口径（频次、场景、缺口）达到可提案门槛时再开 change。
- **Owner**：product。

### 1.5 comment/notification — retain-next（跨项目）

- **判定**：`retain-next`，且路由出 Workbench 边界。
- **Owner-fit**：`split-owner`。通知通道合同（identity/IM 投递、通道选择、速率与偏好）的 canonical owner 不在 Workbench；WorkItem/记录评论的真相存储与权限也超出 project-data 自身边界，需要**跨项目（root routing）OpenSpec** 先定 owner 拆分与通道合同。Workbench 侧只可能作为可见宿主（评论流展示、通知入口的 safe projection），不得自建通知投递或 IM 集成。
- **Reopen 证据要求**：跨项目 OpenSpec 完成 owner-fit 判定与通道合同（投递语义、receipt、退订/偏好、审计），Workbench 侧再以 typed projection/深链方式接入。
- **Owner**：跨项目 routing（root）；Workbench 不持有 canonical state。
- **当前状态说明**：本 change 只落地路由判定；跨项目提案本身由 root routing 另行开立，不在本 change 任务范围（如实 open）。

## 2. 汇总表

| capability | 判定 | owner-fit | owner | reopen 证据门槛 |
| --- | --- | --- | --- | --- |
| form intake 视图 | deliver-next | fit | workbench web lane | 下一实现 change：视图 kind 合同 + 断网/冲突 + 反滥用证据 |
| formula 字段 | retain-next（拆两期） | fit | workbench project lane | 求值顺序/失败语义/hidden 规则 spec + 表达式闭集安全 + 50k 性能证据 |
| lookup 字段 | retain-next | fit | workbench project lane | cross-dataset 权限裁剪 + N+1/扇出预算实测 |
| cross-dataset relation | retain-next | fit | workbench project lane | 级联语义 spec + 迁移兼容证据（与 lookup 同期） |
| dashboard 聚合 | reject-now | fit（保留 reopen） | product | 真实使用信号量化后重新提案 |
| comment/notification | retain-next | split-owner | 跨项目 routing（root） | 跨项目通知通道合同 OpenSpec |

## 3. 不变量与防漂移

- 本台账任何 retain-next/reject-now 项被后继 change 静默改为排期或删除，即违反本 change spec「Project data next-slice 决策须证据驱动且不静默删项」，评审必须拒绝。
- 9 个 custom field kinds 之外的新字段 kind（formula/lookup）一律走独立合同 change，不以「视图配置」名义绕过。
- 通用低代码/BPMN 平台化、任意脚本、任意 HTTP/webhook、浏览器 workflow executor 维持 v1 0.2 non-goals / P16 rejected，本台账不开启任何后门。
