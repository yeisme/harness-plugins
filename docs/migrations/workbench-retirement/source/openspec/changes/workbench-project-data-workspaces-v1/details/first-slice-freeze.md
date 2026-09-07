# Project Data Workspaces V1 — 首期范围冻结（Task 0.2）

> 冻结时间：2026-08-23。本文冻结 Gate 0 后的首个交付切片；引用 proposal.md 的 Required Capability Ledger、design.md 的决策与 `details/project-data-workspace-prd.md`。Ledger 的 deliver-now / retain-next / rejected 分类**无删改**（见文末核对）。

## 1. 冻结的首期要素

| 要素 | 冻结值 | 出处 |
| --- | --- | --- |
| Test tenant（数量：1） | disposable `t:pdw`（project-data-workspaces 专用 seed；命名沿用 `t:` 前缀惯例，参考 `t:i`/`t:pg`） | 本文档新增 pin；组件/SQLite/PG 证据均用此 tenant |
| Workspace / 首期 safe projectRef | workspace `pdw-main`；绑定 approved safe projection `proj_demo`（disposable seed project，不触碰生产 project） | design 决策 2（不创建第二个 canonical Project） |
| Owner canary 用 project | `proj_canary`（与 R2 4.4 / PA 8.1 selector 的 disposable project 一致；dry-run，无付费 provider 调用） | PA `details/eikona-generation-submit-canary-selector.md` |
| 默认 WorkItem dataset（数量：1） | `workitems.default`：首期唯一可变记录类型为 WorkItem，dataset 由 seed 建立，schemaRevision 从 1 起 | proposal（记录真相归 WorkItemService）；tasks 2.1/2.2 |
| 四视图（closed union，数量：4） | `table` / `kanban` / `todo` / `canvas`；同一 dataset 同一 ProjectQueryV1 合同，切换视图不复制记录 | design 决策 1/5/8 |
| 五角色（数量：5） | `viewer` / `contributor` / `project_manager` / `automation_manager` / `project_admin` | design「首期角色建议」 |
| 9 个 custom field kinds（数量：9） | `text` / `number` / `single_select` / `multi_select` / `date` / `checkbox` / `actor_ref` / `safe_ref` / `work_item_relation`（拒绝任意 JSON schema） | design 决策 3 |
| 三类首发 trigger（数量：3） | `manual` / `record_created` / `status_transitioned`；`schedule` 与 `approved_event` 在 worker/readiness 证据后晋级（retain-next） | PRD §63/69；design Slice E |
| 一个低风险 Owner canary | `eikona.generation.submit`（唯一可选；dry-run、receipt/status/reconcile/cancel、Eikona kill switch；contract-gated，未验收保持 `needs_contract`） | PA 8.1 closed selector + 依赖门禁矩阵 §5 |

首期容量边界沿用 design 冻结值：每 dataset ≤64 custom fields、每 record 256 KiB safe metadata、每 select ≤200 options；最终预算由性能证据（Slice F）修订。

## 2. 首切片（Slice A）边界

按 design Migration Plan：Slice A 只交付 read-only project workspace（schema/ProjectQuery/Table/Todo/Kanban read projection + four-transport read parity）；mutation、interactive views、Canvas binding、automation、enterprise hardening 依次为 Slice B-F。Gate 0 依赖矩阵（`details/dependency-gate-matrix.md`）确认无 fixture promotion、无 blocked required capability。

## 3. Required Capability Ledger 核对（无静默删改）

| 能力 | Ledger 交付状态（proposal.md 原值） | 冻结确认 |
| --- | --- | --- |
| ProjectWorkspace / Dataset / schema | deliver-now | 不变；本切片实现 |
| Table / Kanban / Todo 多视图 | deliver-now | 不变；Canvas 见下行 |
| 结构化无限画布 | deliver-now（复用 BoardService） | 不变；Slice D 交付 |
| 项目自动化设计与运行观察 | deliver-now low-risk slice | 不变；仅三类首发 trigger |
| 企业角色、字段/动作权限 | deliver-now baseline | 不变；五角色基线 |
| Owner 专业对象与动作 | split-owner / contract-gated | 不变；仅 PA 8.1 选定 canary |
| Formula / lookup / cross-dataset relation | retain-next | 不变 |
| Intake form / template marketplace / dashboard | retain-next | 不变 |
| 任意脚本、任意 HTTP/webhook、浏览器 workflow executor | rejected | 不变，永不进入首期 |

Non-goals（proposal What Changes 末段）：公式/lookup、公开表单、任意外部 webhook、脚本执行不进入首期——维持不变。

## 4. Canary 判定

Owner canary 判定不依赖 fixture 或人工观察：`eikona.generation.submit` 走 R2 4.4 已关闭的生产 registry JWT 链（evidence `20260822170843`，receipt `own_c8ca15938f6afe2fd59ba393`），Workbench 侧消费 typed receipt/status/reconcile/cancel 合同。若 Eikona 侧 canary 环境不可用，automation 的 Owner mutation 路径保持 `needs_contract`（fail-closed），不阻塞非 Owner 切片。
