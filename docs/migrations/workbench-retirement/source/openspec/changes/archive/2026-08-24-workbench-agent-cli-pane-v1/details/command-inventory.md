# Agent CLI Pane V1 — 命令清单与准入分类（Task 0.1）

> 枚举时间：2026-08-23。来源：`service/internal/registry/**`（sealed operations 实测声明）、`service/cmd/**`（14 个 CLI binary 的 flag 实测）。分类四档：`operation`（Slice A：Operation-backed，经 TaskService 执行）/ `host_cli`（Slice C 候选：需 Host Runtime）/ `needs_contract`（缺合同或 provider 未就绪，catalog disabled）/ `reject`（不进入 Pane 执行）。**无把 human-only CLI 晋级为 runnable。**

## 1. Sealed Operations（registry 实测）

Registry 合同 `workbench.operation_registry.v1`；canonical synthetic snapshot digest `sha256:7a027f722beff64228771cd2684bad7591797df28b7b68391ee390a26aa369c1`（14 ops）。

| Operation | Mutation | Permission/Idempotency | Events | 当前 Mode | 分类 | 说明 |
| --- | --- | --- | --- | --- | --- | --- |
| `workbench.daily.workitem.read` | 否 | — | — | 动态（workItemReadMode） | **operation** | Slice A 首批 read 命令 |
| `workbench.daily.workitem.mutation` | 是 | RequiresPermission + RequiresIdempotency | SupportsEvents | 动态（workItemMutationMode） | **operation** | Slice A 受控 mutation |
| `workbench.daily.asset.read` / `asset.search` / `collection.read` | 否 | — | — | ModeUnavailable | needs_contract | R3 provider promotion 未完成 |
| `workbench.daily.inbox.read` / `approval.read` / `activity.read` / `delivery.read` | 否 | — | — | readMode（组件可用） | **operation**（read-only） | 直连 pane 已消费同一投影 |
| `workbench.daily.collection.mutation` / `inbox.action` / `approval.decision` / `delivery.mutation` | 是 | Permission + Idempotency | SupportsEvents | ModeUnavailable | needs_contract | 未晋级不得暴露 |
| `eikona.generation.submit` / `review.decide` / `handoff.prepare` | 是 | Permission + Idempotency + receipt/reconcile/cancel | ✓ | eikonaMode（canary `ModeOwner`） | **operation**（仅 PA 8.1 选定的 `generation.submit` 可选） | R2 4.4 canary 已关；浏览器不可持 credential |
| `scaena.production.submit` / `pinax.note.write` / `sonora.render.submit` | 是 | — | — | ModeUnavailable | needs_contract | Owner 合同缺口回 owner change |
| `gateway.approval.decide` / `tools.refresh` / `runtime.reload` | 是 | — | — | ModeUnavailable | needs_contract | MCP Gateway owner canary 未完成（见 mcp-gateway-console 8.3） |
| `workbench.orbit.action.submit` / `orbit.proposal.accept`（PA sealed） | 是 | proposal gate | ✓ | ModeUnavailable→PA canary 推进 | **operation**（PA 8.2+ 接线后） | Slice A 只读投影先行，决策仍走 canonical gate |
| `workbench.foundation.{asset,team,work_item,layout,board,search,audit,handoff}.read` | 否 | — | — | ModeUnavailable | needs_contract | R0 foundation capability 探针 |
| `workbench.synthetic.echo` / `synthetic.gated_echo` | 否/是 | gated_echo 有 gate | — | canonical | reject（测试探针） | 不进入产品 catalog |
| design / orbit / gateway 其余 canonical ops（snapshot 内 14 个） | — | — | — | canonical | 按各自 change | 详见 snapshot |

## 2. CLI Binaries（service/cmd 实测，14 个）

输出模式旗标扫描结果（`rg -n -- '(--json|--agent|--events|--explain)'` 命中 158 处，分布如下）：

| Binary | `--json` | `--agent` | `--explain` | `--events` | 分类 | 理由 |
| --- | --- | --- | --- | --- | --- | --- |
| `workbench-diagnostics` | ✓ | ✓ | ✓ | ✗ | **host_cli**（Slice C 首选 canary） | 只读诊断，结构化 envelope，无外部 effect |
| `workbench-config-check` | ✓ | ✓ | ✓ | ✗ | **host_cli**（canary） | 只读配置校验 |
| `workbench-readiness` | ✓ | ✓ | ✓ | ✗ | **host_cli**（canary） | 只读 readiness 观测（flag 定义为 `flags.Bool("json"…)` 形式，首轮字符串扫描漏计，已按 main.go 实测修正） |
| `workbench-lifecycle` | ✓ | ✓ | ✓ | ✗ | host_cli（次批） | 有状态转换 effect，需 gate |
| `workbench-operation-contract` | ✓ | ✓ | ✓ | ✗ | host_cli（次批） | 只读 snapshot 生成/check |
| `workbench-release` | ✓ | ✓ | ✓ | 部分（events_state 字段，非 NDJSON 流） | reject（首期） | release/promotion 权限域，不入 Pane |
| `workbench-backup` | ✗ | ✗ | ✗ | ✗ | reject | 生产数据备份，ops-only |
| `workbench-migrate` | ✗ | ✗ | ✗ | ✗ | reject | schema migration，ops-only |
| `workbench-restore-verify` | ✗ | ✗ | ✗ | ✗ | reject | 恢复验证，ops-only |
| `workbench-worker` | ✗ | ✗ | ✗ | ✗ | reject | daemon |
| `workbenchd` | ✗ | ✗ | ✗ | ✗ | reject | API daemon |
| `workbench-board-contract` / `workbench-workflow-contract` / `schema-export` | ✗ | ✗ | ✗ | ✗ | host_cli（次批，需先补结构化输出） | 合同导出工具，当前 human-only 输出 |

**关键发现**：没有任何 Workbench binary 支持 `--events` NDJSON 终止语义（158 处命中均为 `--json/--agent/--explain`）。Slice C canary 必须由 task 5.4 补齐 `--events` 或显式声明 non-streaming `--json`，否则不满足 descriptor output contract。

## 3. Scripts（非候选）

`scripts/*.ts`（production-build、contract-assets、identity-contract-canary 等）为 Bun 构建/证据脚本，无 sealed operation、无结构化输出合同——**reject**（不是 CLI Pane 候选；"UI 引用或 copy fallback 不等于 sealed capability"）。

## 4. Slice A 首批建议（5–8 个，供 0.2 冻结）

1. `workbench.daily.workitem.read`（read）
2. `workbench.daily.workitem.mutation`（受控 mutation）
3. `workbench.daily.inbox.read`（read）
4. `workbench.daily.approval.read`（read）
5. `workbench.daily.activity.read`（read）
6. `workbench.daily.delivery.read`（read）
7. `eikona.generation.submit`（PA 8.1 选定 canary，contract-gated）
8. （可选）`workbench.orbit.proposal.accept`（PA 8.2 接线后启用）

Slice C Host canary 建议（2–3 个）：`workbench-diagnostics`、`workbench-config-check`、`workbench-readiness`（全部只读 + 三模式输出；`--events` 缺口由 5.4 收敛）。

## 5. 生产 readiness 诚实边界

- Daily workitem read/mutation 的 Mode 由 locale/registry 派生，组件证据 ≠ 生产可用；生产晋级仍受 R3 gates 8.2-8.5 外部门禁。
- Eikona ops 仅在 canary 配置（`EIKONA_OWNER_CANARY` 等 loopback 环境变量）下 `ModeOwner`；默认 registry 路径 `ModeUnavailable`。
- 全部 host_cli 候选均为只读或本地 effect；任何带生产写效应的 binary（backup/migrate/restore/release）在首期 reject。
