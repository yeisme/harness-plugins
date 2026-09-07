# R4 上游依赖聚合快照基线（0.1f 增量切片）

## 1. 交付物

任务 `0.1f` 要求 R4 发布上游依赖聚合报告与 capability snapshot，且报告必须由
CLI/application service 生成、不含 endpoint/credential/raw error。本切片交付生
成与校验的权威链路：

- `service/internal/workflowdeps`：快照模型 + 构建器 + 校验器。
- `service/cmd/workbench-workflow-dependencies`：生成/校验 CLI（`--output` /
  `--check`，可选 `--release-registry`）。
- Taskfile：`workflow:dependencies:report:generate`（OUTPUT 变量）、
  `workflow:dependencies:report:check`（SNAPSHOT 变量）、
  `workflow:dependencies:report:test`。
- 配套导出两个既有 wire 合同常量为包级 API（加法别名，不改变值）：
  `workitemshttp.ContractVersion`（workbench.workitems.v0.1）、
  `dailyopshttp.ContractVersion`（workbench.operations.v0.1）。

## 2. 数据来源（非手写）

快照字段全部来自代码内权威 pin 或现场计算的 canonical digest，生成器不接受
手填状态：

| 依赖 | 来源 |
| --- | --- |
| identity.principal / identity.service_delegation | `identity.ContractVersion`（workbench.identity.v0.1） |
| identity.provider | provider 合同 id `yeisme.identity.platform`（canary 钉 1.x） |
| owner.receipt / owner.projection | `eikona.ContractID@ContractVersion` + `ExpectedSchemaDigest`/`ExpectedSDKDigest` |
| daily.asset | `collections.ContractVersion`（workbench.assets.v1alpha1） |
| daily.workitem | `workitemshttp.ContractVersion` |
| daily.task / daily.delivery | `dailyopshttp.ContractVersion` |
| workflow.step_registry | `stepregistry.CanonicalSnapshot().Digest()`（现场计算） |
| board.type_registry | `boards/registry.CanonicalSnapshot().Digest()`（现场计算） |

上游晋级状态（available/needs_contract）默认取 R4 handoff 台账（0.1c 已接收的
Eikona slice；R1/R3 closeout 未完成）；提供 `--release-registry`（workbench
release CAS registry `workbench.release_handoff.v1`）时由 INT-R1/R2/R3-01 四门
派生，任一门未全绿即 needs_contract（reason `release_gate_open`），fail-closed。

## 3. 校验语义（fail-closed 矩阵，均有测试）

- 缺 required 依赖、多余依赖、重复 id → 拒绝（optional Owner 不在集合内，缺位
  不阻断全局）。
- state/reason/rollback 不在 allowlist → 拒绝。
- available/degraded 无 evidence refs、或 rollback 仍 pending → 拒绝。
- observed version 超出 required range（ahead/behind）→ 拒绝。
- digest 与当前代码 pin 不一致（required 或 observed 漂移）→ 拒绝，强制重新生成。
- 未晋级依赖声称 observed digest → 拒绝（probe 结论不得凭空携带）。
- 值级安全扫描：任何字段值含 `://`、`127.0.0.1`、`localhost`、DSN/credential
  形态 → 拒绝；JSON 解码 `DisallowUnknownFields` + 尾随内容拒绝（endpoint 等
  禁止字段无结构性入口）。
- checked_at 晚于 generated_at、超长字段、evidence refs 超 8 条或格式不安全 →
  拒绝。

revoke/outage 是运行期 probe 语义（workers/dependencies checker 与
owners/catalog 的 fail-closed 路径），不通过编辑快照表达；快照承载 point-in-time
handoff 状态。

## 4. 当前快照（2026-09-02，默认台账）

11 项 required 依赖：4 available（owner.receipt、owner.projection、
workflow.step_registry、board.type_registry）+ 7 needs_contract
（identity×3、daily×4，reason `upstream_closeout_pending`）。与
`details/r1-r3-contract-dependency-audit.md` 的审计结论一致。

## 5. 验证

- `task workflow:dependencies:report:generate OUTPUT=temp/workflow-dependencies.json`
  → `dependencies=11 available=4 needs_contract=7`。
- `task workflow:dependencies:report:check SNAPSHOT=temp/workflow-dependencies.json`
  → valid。
- `task workflow:dependencies:report:test`：workflowdeps + CLI 单测 +
  race×2 全绿（构建确定性、篡改矩阵、registry 门派生、registry 非法/缺失拒绝）。

## 6. 诚实边界（不关闭 0.1f 的原因）

- Dependencies `0.1b`（R1 6.4/6.5 staging soak/rollback drill + closeout）与
  `0.1e`（R3 8.4/8.5 soak/rollback + closeout）仍 open：快照如实以
  needs_contract 表达，聚合门关闭条件见 audit §7。
- 「API/worker/Web 消费同一 snapshot」的运行期挂载（transport/投影/worker
  readiness 读取该快照）未在本切片实现，属 0.1f 关闭前的后续接线。
