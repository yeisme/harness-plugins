# Agent CLI Pane V1 — 首批 catalog 冻结（Task 0.2）

> 冻结时间：2026-08-23。依据：`details/command-inventory.md`（0.1 实测）、proposal/design 冻结语义。三切片顺序 Slice A（Operation-backed）→ Slice B（Agent collaboration）→ Slice C（Host Runtime）。

## 1. Slice A — Operation-backed commands（7 个）

全部经 TaskService 执行（`executionKind=operation`），无子进程、无 PTY、无 shell。

| # | Command（Operation） | Owner | Scope/Test tenant | Effect/Risk | Receipt/Evidence | Rollback/Kill switch |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `workbench.daily.workitem.read` | Workbench（daily） | `t:cli`（disposable seed；read 跨 `t:i` 组件 fixture 一致） | read，无外部效应 | Task + event cursor + safe projection | catalog flag（per-operation 注册开关） |
| 2 | `workbench.daily.workitem.mutation` | Workbench（daily） | `t:cli` | bounded_write；RequiresPermission + RequiresIdempotency；expected-version CAS | Task + SupportsEvents + typed outcome | flag off 停新 mutation；已接受记录保持可读可 reconcile |
| 3 | `workbench.daily.inbox.read` | Workbench（daily） | `t:cli` | read | Task/safe projection | catalog flag |
| 4 | `workbench.daily.approval.read` | Workbench（daily） | `t:cli` | read | Task/safe projection | catalog flag |
| 5 | `workbench.daily.activity.read` | Workbench（daily） | `t:cli` | read | Task/safe projection | catalog flag |
| 6 | `workbench.daily.delivery.read` | Workbench（daily） | `t:cli` | read | Task/safe projection | catalog flag |
| 7 | `eikona.generation.submit`（contract-gated） | Eikona（R2）+ Workbench consumer | `proj_canary`（disposable，dry-run 无付费 provider 调用） | owner mutation；cancel/receipt/status/reconcile 齐备（PA 8.1 selector） | durable owner receipt（R2 4.4 evidence `20260822170843` 链路） | `EIKONA_OWNER_CANARY` + `new_mutations_enabled`；未验收保持 `needs_contract` |

Slice A 验收基线：权限/版本/幂等/partial/error 与原 Operation 完全一致（tasks 3.4）；direct API 与 CLI Pane Task 语义一致（3.1/3.2）。

## 2. Slice B — Agent scenarios（2 个）

对应 design 决策 5 的四类动作（discover/prepare/present/observe）：

| # | Scenario | 走向 | 边界 |
| --- | --- | --- | --- |
| B1 | **Agent 建议只读诊断命令**：用户请求"检查这个工作项的收件箱状态"→ Agent `discover` catalog → `prepare` `daily.inbox.read` typed intent（显式 Context Pack）→ `present` open/focus CLI Pane → grant 内自动执行（`effectClass=read` + `delegated_read` + `AgentExecutionGrantV1`）→ `observe` safe facts 并给出下一步建议 | read 自动执行需 grant；默认无 grant 退化为 Prepare | Agent 不读未脱敏 stdout/stderr；result 只进 Context Pack 的 refs/revision |
| B2 | **Agent 提议受控 mutation → canonical proposal**：Agent 基于 Context Pack 提议 `daily.workitem.mutation`（bounded_write）→ 形成 canonical proposal → 用户/approver 接受 → Task 创建 → Agent `observe` 事件流与 receipt，unknown 时只建议 reconcile（不自动重发） | bounded_write/dangerous 一律走 proposal gate | Agent 不自动确认 cost/permission、不扩大 scope、不 retry `unknown_accept`、不自动 reconcile |

## 3. Slice C — Host canary（3 个）

首批 Host Runtime = **同机 pure-Go sidecar**（design §337 建议路径；provider adapter 后续替换），`workbench.cli.host.run.v1` 默认关闭。

| # | Binary | 输出合同 | Effect/Risk | 回滚 |
| --- | --- | --- | --- | --- |
| C1 | `workbench-diagnostics` | `--json/--agent/--explain`（非流式；`--events` 由 task 5.4 补齐后升级） | 本地只读观测 | canary binding flag 默认 off；kill switch 停 dispatch |
| C2 | `workbench-config-check` | 同上 | 本地只读校验 | 同上 |
| C3 | `workbench-readiness` | 同上 | 本地只读 readiness | 同上 |

binding 冻结：executable 路径、argv 前缀、output digest pin（tasks 4.6）；三个 canary 全部只读、loopback、无 credential。

## 4. Required Capability Ledger 核对（无静默删改）

proposal 的 ledger 语义不变：企业自研任务流优先 Operation-backed（deliver-now）；真实进程边界走 approved Host Runtime（split-owner，contract-gated）；任意 shell/PTY/浏览器 spawn/unaudited 交互/自动重试 unknown（reject-now）维持拒绝。0.1 清单中的 `needs_contract`（gateway/scaena/pinax/sonora、daily asset/collection/delivery mutation、foundation 探针）与 `reject`（backup/migrate/restore/release/daemon/scripts/synthetic）分类不因本冻结改变。

## 5. 诚实边界

- `eikona.generation.submit` 进入 Slice A 列表仅表示"唯一具备完整 receipt/cancel/reconcile 合同的候选"；在 Eikona canary 环境不可用时保持 `needs_contract`，不阻塞其余 6 个 Workbench-owned 命令。
- Host canary 的 `--events` 缺口（0.1 关键发现）由 task 5.4 收敛；收敛前 canary 以 non-streaming `--json` 声明运行（design §339 允许）。
- 首期不依赖任意 shell/PTY（Non-Goals 维持）。
