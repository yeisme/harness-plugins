## Why

DSH harness-plugins 已冻结 `dsh.workbench_ai_drama_bridge.v2` 做剧桥合同（OpenSpec change `dsh-workbench-ai-drama-bridge-v2`，plugin-complete），并发布了跨仓 conformance fixtures（fixtureVersion `2026-08-29.1`）。Workbench 当前只有 `workbench.harness.dsh_bridge.v1alpha1` 的 SDK/ingress 雏形，nonce 格式在 TS SDK（32 小写 hex）与 Go ingress（8–127 宽字符）之间不一致，也无法消费 DSH 的 host-approved `launchRef`。需要一条 Workbench 消费者合同，让 `/agent` Spatial Creative Runtime 能以 server-side ingress 的身份重新鉴权、refetch 并打开正确的 Production/Review/Evidence lens，同时保持 Ordo 与各领域 owner 的状态所有权不被复制。

## What Changes

- 新增 Workbench 侧 V2 消费合同：接受 DSH host-approved launcher 交换得到的 `dsh.workbench_ai_drama_bridge.v2` envelope，拒绝浏览器拼接的 raw route/URL 输入。
- Server-side ingress 统一 nonce（`^[0-9a-f]{32}$`）、epoch-ms expiry、closed schema 与 canonical SHA-256 digest 校验，收敛 TS SDK 与 Go ingress 的现有分歧。
- 新增 tenant+nonce+contractVersion 有界 replay record：相同 canonical payload 幂等返回原结果，不同 payload 返回 `replay_conflict`。
- 重新鉴权（用户/tenant/workspace/project/resource）并 refetch owner 数据；版本不一致返回 `reconcile_required`，不静默覆盖；无权限返回 `denied` 不泄露资源细节。
- 固定 intent → `/agent` lens 映射（open_show/open_episode/open_artifact → Creative Production；open_review → Review；open_evidence → Evidence），未知 intent 返回 `contract_mismatch`，不做近似猜测。
- 消费 DSH 发布的 conformance fixtures（consumer 与 both actor cases）并输出独立 conformance 证据；跨仓 rollout-ready 只在双方同版本 fixture 全绿后声明。
- 保留 `workbench.harness.dsh_bridge.v1alpha1` 兼容面，其退役由 DSH 侧独立变更主导，本 change 不删除、不重定义旧合同。

## Capabilities

### New Capabilities

- `workbench-dsh-ai-drama-bridge-consumer`: DSH → Workbench 做剧桥 V2 的 server-side ingress、replay 语义、重新鉴权与 refetch、lens 映射、失败终态与跨仓 conformance 验收。

### Modified Capabilities

无。现有 `workbench-dsh-plugin-lane` 与 `workbench-ai-drama-show-navigation` 描述的是 alpha 合同兼容期行为；V2 以新 capability 增量引入，退役旧能力由后续独立变更处理。

## Impact

- `packages/task-sdk/src/harness/`：新增 V2 envelope 类型、closed schema validator、reason codes（替换/并存 alpha 深链校验，不重定义 alpha 字段）。
- `service/internal/showcontrol/`（或后续 spatial ingress 归属包）：launchRef/envelope ingress 端点、replay record、reauthorization、版本对账与 lens 定位。
- `apps/web/src/workbench/agent/spatial/spatial-ingress.ts`：消费入口接线与 `/agent` lens 路由。
- 跨仓依赖：`@yeisme/dsh-ai-drama-director` 发布包的 `fixtures/dsh-workbench-ai-drama-bridge-v2/`（fixtureVersion `2026-08-29.1`）；Workbench 不得依赖 DSH 内部实现模块。
- 不新增浏览器直连 owner、iframe bridge、domain store、scheduler 或第二套 terminal state；不信任 DSH 传来的标题、可写权限或终态。
