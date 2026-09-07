# R2 Closeout / Handoff（任务 7.4）

## 1. 状态口径

本 handoff 将 `workbench-owner-backend-integrations` 正式发布为 **R2（Owner
Backend Integrations first-support）**。逐 Owner/capability 状态如下；R3/R4/R5
消费同一 per-owner 口径，不再以 change 级 valid 代替可用性。

- **Eikona**：first-support **Provider Ready / Consumer Done**（首个 canary
  owner；mutation/receipt/reconcile 链已过真实栈门）。
- **Scaena / Auctra / Pinax / Sonora**：保持 `disabled` / `needs_contract` /
  `partial`（按 `details/creator-studio-owner-consumer-matrix.md` §3 冻结
  口径），**不阻塞 Eikona first-support**；各自晋级必须补齐矩阵 §4 五条
  证据后另走 owner change。

## 2. 逐 Owner capability 表

| Owner | capability | Provider Ready | Consumer Done | contract / SDK digest 依据 | real environment evidence | flag / kill switch | rollback / failure owner |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Eikona | `eikona.generation.submit`（+ review/handoff 同 spine） | ✅ | ✅ | `eikona.asset_handoff.v2` + `/api/v1` OpenAPI（`cli/eikona` 冻结）；Workbench typed adapter digest 校验（`service/internal/owners/eikona`，contract mismatch fail-closed） | read canary `20260802001626-5ed25803`；final gate 全量 2026-08-23（registry INT-R2-01 四 gate evidence：consumer_done `20260823065913-f4ce2bc0`、integration_passed `20260823120024-8b0f3889` 等）；**真实 owner mutation 链（delegation→canary→owner receipt→SSE/receipts/脱敏）2026-08-30 system evidence `20260830090100-39c102fc`** | owner capability kill switch（digest/kill-switch fail-closed 已测）+ Workbench owner URL default-off | Owner：Eikona API；Failure owner：`owner:workbench-owner-integrations`（registry INT-R2-01 failure_owner_ref） |
| Scaena | production canvas/data-action projections | ❌ `partial`（canvas slice only） | ❌ | 未发布全量 digest；`scaena-production-data-action-projections-v1` 未完成 | 无 mutation 真实栈证据 | 未批准 action 全关（matrix §3） | Owner：Scaena Backend |
| Auctra | Service API capability projection | ❌ `needs_contract` | ❌ | 未发布 admitted contract | 无 | 禁用 capability，保留 safe diagnostic | Owner：Auctra Service API |
| Pinax | （无 direct capability） | ❌ `needs_contract` | ❌ | 未发布 | 无 | — | Owner：Pinax |
| Sonora | audio workspace projections | ❌ `planned` | ❌ | 未发布（direct transport 延后） | 无 | — | Owner：Sonora API/SDK |

## 3. Registry（CLI 权威）

`temp/release/handoff.json`（spec `workbench.release_handoff.v1`，environment
`integration`，revision 5）：**INT-R2-01 = 1/6 ready**（provider_ready /
consumer_done / integration_passed / rollback_passed 全 true + 四 gate
owner/evidence/digest 齐）；INT-R0/R1/R3/R4/R5 保持未完成（对应 release 尚未
closeout，属后续 release 变更，不阻塞 R2）。`workbench-release handoff
validate` 报 `Status: Partial / handoff_incomplete`（exit 5）是该注册表在
R0–R5 全生命周期口径下的诚实状态；**R2 package 自身 ready**。

## 4. R2 不变量与回滚

- 浏览器只到 Workbench BFF；owner URL/credential/token 不进浏览器。
- mutation 走 Task admission（permission/cost/idempotency/expected owner
  version）→ owner receipt gate；timeout-after-send = `unknown_accept` +
  reconcile，不自动重放。
- **回滚**：关闭 Eikona capability flag / Workbench owner URL（default-off），
  保留 read projection 与 receipt refs；不重写 owner canonical state。未证明
  owner 的 action 入口保持 disabled。
- fixture 不替代 live owner；consumer 不代签 provider（registry producer/
  consumer/failure owner 三分）。

## 5. 验证记录（2026-08-30）

- `task release:handoff:validate ENV=integration`：结构 valid，INT-R2-01
  ready（1/6，Partial 为 R0–R5 生命周期诚实状态，非 R2 阻塞）。
- `openspec validate workbench-owner-backend-integrations --strict`：valid。
- 真实 owner 链（R1 provider 合同解锁后）：system evidence
  `temp/integration-test-runs/20260830090100-39c102fc-4481-42b9-b14b-d835a4b29ce2`
  passed / exit 0 / redaction passed（workitem 真实 PG + eikona delegation
  owner receipt + SSE + receipts + 脱敏扫描）。

## 6. R3/R4/R5 消费指引

R3（daily-ops）/R4（spatial workflow）/R5（GA）引用本文件 §2 表与 §3 registry
作为唯一 per-owner 可用性口径；任何 owner 晋级必须：owner 发布 versioned
contract+digest → Workbench BFF 验证 → 真实环境脱敏 evidence → kill switch
与 rollback owner 落表 → 更新本表与 registry（release CLI record）。
