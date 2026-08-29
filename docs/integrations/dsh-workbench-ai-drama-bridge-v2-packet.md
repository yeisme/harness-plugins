# DSH → Workbench AI Drama Bridge V2：Workbench Consumer Handoff Packet

> 面向：Workbench（`client/yeisme-workbench`）consumer 实现 owner
> 来源：OpenSpec change `dsh-workbench-ai-drama-bridge-v2`（DSH provider，plugin-complete）
> Packet 版本：`2026-08-29.1`（与 fixtureVersion 同步）

## 1. 合同

- Contract identity：`dsh.workbench_ai_drama_bridge.v2`，方向固定 `dsh_to_workbench`。
- 目标 registry identity（逻辑）：`workbench.agent.spatial`；target application：`yeisme-workbench`。部署 origin 与 exchange transport 由 Workbench 确认，DSH 不冻结 raw route。
- Closed schema（字段顺序即 canonical 顺序，`contractDigest` 除外）：
  `contractVersion, direction, sourceSurfaceId, targetSurfaceId, workspaceRef, projectRef, showRef, episodeRef?, resourceRef, resourceVersion?, contextRevision, presentationIntent, artifactRef?, receiptRef?, expiresAtUnixMs, nonce` + `contractDigest`。
- Nonce：`^[0-9a-f]{32}$`（cryptographic random）；expiry：epoch ms，TTL 30s–15min（默认 5min）；digest：schema-ordered canonical SHA-256（完整性，非签名）。
- 类型与校验参考实现（可 imports，也可按本 packet 重实现）：`@yeisme/dsh-ai-drama-director` 的 `validateWorkbenchAiDramaBridgeV2` / `digestBridgeV2`。

## 2. Intent → `/agent` lens 矩阵（封闭）

| DSH intent | Workbench lens | 初始焦点 |
| --- | --- | --- |
| `open_show` | Creative Production | show overview |
| `open_episode` | Creative Production | episode timeline |
| `open_artifact` | Creative Production | referenced artifact |
| `open_review` | Review | referenced review context |
| `open_evidence` | Evidence | receipt/evidence context |

未知 intent → `contract_mismatch`，禁止近似猜测。

## 3. Ingress 状态机（server-side 真值）

```text
issued -> validated -> launched -> revalidating
       -> opened | reconcile_required | denied | expired
       -> contract_mismatch | replay_conflict | target_unavailable
```

- 校验顺序：closed schema（unknown key/unsafe 内容→`malformed`）→ identity/direction/target/intent/nonce 格式（→`contract_mismatch`）→ digest（损坏→`malformed`）→ expiry（→`expired`）。
- Replay record：tenant + nonce + contractVersion 有界记录；相同 canonical payload 幂等返回原结果；不同 payload → `replay_conflict`。
- 重新鉴权：principal 对 tenant/workspace/project/resource 的授权由 Workbench 自行判定；失败 → `denied`，不泄露资源细节。
- 版本对账：`resourceVersion`/`contextRevision` 与 owner 状态不一致（落后/领先/资源不存在）→ `reconcile_required`，展示差异，不静默覆盖。
- Owner refetch：展示与写入能力一律来自 owner 当前数据；DSH envelope 不携带标题、状态、可写权限或终态。

## 4. 稳定 reason codes

`malformed, expired, denied, stale, replay_conflict, already_consumed, target_unavailable, legacy_bridge, contract_mismatch, reconcile_required, unknown, partial`

证据类别（双方一致）：`bridge_issued, bridge_launch_requested, bridge_consumed, bridge_reconcile_required, bridge_denied, bridge_expired, bridge_contract_mismatch, bridge_target_unavailable`。只记录 contract version、intent、surface、reason code、时间、版本与 opaque correlation ref（不得用 nonce 作公开遥测主键）。

## 5. Conformance fixtures（跨仓发布门）

- 位置：npm 包 `@yeisme/dsh-ai-drama-director` → `fixtures/dsh-workbench-ai-drama-bridge-v2/`（`manifest.json` + `cases/*.json`）。
- fixtureVersion：`2026-08-29.1`。Workbench 需执行全部 `actor: "consumer"` 与 `actor: "both"` cases 并独立留证；双方同版本全绿前不得声明 cross-repository rollout-ready。
- 覆盖族：intent 映射、closed schema、nonce、expiry、direction、target surface、digest、版本对账、replay、权限、capability、lifecycle、rollback。
- 参考执行器（可选对拍）：同包导出的 `evaluateBridgeV2Ingress` / `runBridgeFixtureCase`。

## 6. 匹配的 Workbench change（任务 5.2 记录）

| 项 | 值 |
| --- | --- |
| Change identifier | `workbench-dsh-ai-drama-bridge-consumer-v1`（已 strict validate PASS） |
| Owner | Workbench（`client/yeisme-workbench`） |
| 目标包路径 | `packages/task-sdk/src/harness/`、`service/internal/showcontrol/`（ingress）、`apps/web/src/workbench/agent/spatial/spatial-ingress.ts` |
| 依赖版本 | `@yeisme/dsh-ai-drama-director` ≥ 本 packet 发布版（fixtures `2026-08-29.1`） |
| Canary gate | 产品 + 安全 + 两仓技术 owner go/no-go（见 DSH 设计文档 §9）；门槛见 §8 |
| Rollback contact | DSH 侧 harness-plugins owner（V2 flag 一键关闭）；Workbench 侧关闭 V2 ingress 回落 alpha/legacy lane |

## 7. Legacy 兼容

- `drama.workbench-handoff.v1`（DSH signer 不变）与 `workbench.harness.dsh_bridge.v1alpha1`（Workbench alpha 深链）至少保留两个连续 DSH 插件发布窗口；字段语义冻结。
- 删除任一旧合同必须由独立变更提出；本 packet 与两 change 均不删除旧合同。
