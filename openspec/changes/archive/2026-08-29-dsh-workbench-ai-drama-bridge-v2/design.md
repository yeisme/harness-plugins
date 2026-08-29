## Context

当前链路存在两套各自可校验、但无法直接互操作的合同：

- DSH Director Pack 签发 `drama.workbench-handoff.v1`，字段围绕 `contextRef`、`artifactRef`、`receiptRef`、`targetSurface`、`presentationIntent`、`expiresAt` 和 `nonce`，并附带本地完整性摘要。
- Workbench 接受 `workbench.harness.dsh_bridge.v1alpha1`，字段围绕 `targetRef`、`sourceSurfaceId`、`resourceRef`、`resourceVersion`、`mode`、`embedded` 和 `handoffNonce`；SDK 与 Web ingress 对 nonce 格式也尚未完全一致。

同时，Workbench 的产品入口已经从独立 Show Control Room 转向 `/agent` Unified Spatial Creative Runtime。DSH 当前 `/drama handoff` 只完成“签发并提示”，没有 host-approved launcher、目标能力探测和消费结果，因此用户仍需手工切换并重新定位上下文。

Ordo 继续是 run/task/session/lease/approval/verification/evidence/closeout 的唯一 owner。本仓库只提供 DSH 侧的安全投影、命令入口、UI 面板和桥接 provider；Workbench 继续拥有 Creative Production、Review、Evidence lens 及其资源授权。本设计涉及 DSH host、client、bundle 和外部 Workbench consumer，因此必须使用增量合同、双栈迁移和跨仓证据。

## Goals / Non-Goals

**Goals:**

- 冻结方向明确的 `dsh.workbench_ai_drama_bridge.v2` 合同，让 DSH 能可靠激活 Workbench `/agent` Spatial surface，而不是只显示提示文本。
- 让用户从剧集、单集、产物、评审或证据上下文进入正确的 Workbench lens，并保留资源版本和可解释的入口意图。
- 保证 browser 只接收 safe projection 和 host-approved launch descriptor；目标系统必须重新鉴权并 refetch owner 数据。
- 给旧合同至少两个连续 DSH 插件发布窗口的兼容期，并提供可观测的采用率、拒绝原因和回滚开关。
- 用同一组 conformance fixtures 验证 DSH provider 与 Workbench consumer，形成可审计的跨仓完成门。

**Non-Goals:**

- 不在 DSH 创建 Workbench 的 scene graph、创作状态机、scheduler、task ledger、writer lease、approval ledger 或 terminal result。
- 不恢复已退役的 Show Control Room，不新增第二套创作路由；目标统一为 Workbench `/agent` Spatial surface。
- 不通过 iframe、任意 URL、浏览器直连 owner API 或 browser domain store 实现集成。
- 不在本变更删除或重定义 `drama.workbench-handoff.v1`、`workbench.harness.dsh_bridge.v1alpha1`。
- 不把合同摘要当作跨系统身份认证、授权证明或不可抵赖签名。

## Decisions

### 1. 使用方向明确的新合同 identity

新增 `dsh.workbench_ai_drama_bridge.v2`，只表达 `dsh_to_workbench`。Workbench → DSH 继续使用其现有方向合同，未来若需升级则另设 identity，禁止把一个 envelope 同时解释为双向协议。

V2 的规范字段为：

```text
contractVersion: "dsh.workbench_ai_drama_bridge.v2"
direction: "dsh_to_workbench"
sourceSurfaceId: safe opaque ref
targetSurfaceId: "workbench.agent.spatial"
workspaceRef: safe opaque ref
projectRef: safe opaque ref
showRef: safe opaque ref
episodeRef?: safe opaque ref
resourceRef: safe opaque ref
resourceVersion?: bounded version string
contextRevision: non-negative integer
presentationIntent:
  open_show | open_episode | open_artifact | open_review | open_evidence
artifactRef?: safe opaque ref
receiptRef?: safe opaque ref
expiresAtUnixMs: unix epoch milliseconds
nonce: exactly 32 lowercase hexadecimal characters
contractDigest: canonical SHA-256 digest of the V2 fields above
```

`contractDigest` 以不含 `contractDigest` 自身的 V2 字段按 schema 顺序 canonicalize 后计算，避免递归或实现自定义排序。合同采用 closed schema；unknown key、raw URL、绝对路径、cookie、token、raw prompt、provider payload、private tool arguments 均拒绝。摘要只用于检测传输或序列化损坏，不授予权限。选择新 identity 而非修改 V1，是为了让旧 consumer 可以继续工作，并让遥测准确区分采用率与失败来源。

备选方案是直接把 DSH V1 改造成 Workbench alpha 合同；该方案会破坏已经发布的消费者，也无法解决双向语义混淆，因此不采用。

### 2. 以 host-approved launch descriptor 激活，不向浏览器暴露任意 URL

DSH host 增加 `WorkbenchLaunchProvider` 抽象，通过受信任的 target registry 解析 `workbench.agent.spatial`。Client 请求 handoff 后得到的 safe projection 只包含：

```text
launchRef: opaque, bounded, short-lived
targetApplication: "yeisme-workbench"
targetSurfaceId: "workbench.agent.spatial"
presentationIntent
expiresAtUnixMs
capabilityVersion
disabledReason?: stable reason code
```

实际目标 origin、认证材料和 server-to-server exchange 留在 host/受信任 launcher 内。Client 只调用批准的 launcher adapter；不得自己拼接 `/agent?...`，也不得把 provider 配置回显到浏览器。如果 target registry、capability handshake 或 launcher 不可用，入口显示 disabled reason，并保留在 DSH 查看当前投影的能力。

备选方案是由 Client 根据配置拼 URL；实现简单，但会扩大 open redirect、凭据泄露、租户错配和部署差异风险，因此不采用。

### 3. Workbench ingress 始终重新鉴权和 refetch

Workbench server-side ingress 消费 `launchRef` 或经受信任 exchange 得到 V2 envelope 后，必须重新校验：

- 当前用户、tenant、workspace、project 与 resource 的访问权限；
- contract version、direction、target surface、expiry、nonce 和 closed schema；
- `resourceVersion` / `contextRevision` 与 owner 当前版本的关系；
- presentation intent 是否允许打开对应 lens。

Workbench 不信任 DSH 提供的标题、状态、可写权限或 terminal result；所有展示与写入能力从 owner refetch。版本不一致时进入 `reconcile_required`，展示差异并要求用户/owner 决策，不静默覆盖。

### 4. 展示意图映射固定且可测试

V2 不传任意 Workbench 路由，使用封闭枚举映射：

| DSH presentation intent | Workbench Spatial lens | 初始焦点 |
| --- | --- | --- |
| `open_show` | Creative Production | show overview |
| `open_episode` | Creative Production | episode timeline |
| `open_artifact` | Creative Production | referenced artifact |
| `open_review` | Review | referenced review context |
| `open_evidence` | Evidence | receipt/evidence context |

Workbench 可以在 lens 内进行响应式布局，但不得改变 owner ref 或把未知 intent 猜测为近似页面。未知 intent 返回 `contract_mismatch`。

### 5. replay、幂等和失败状态由服务端定义

每个 V2 handoff 使用 32 位小写十六进制随机 nonce、短 TTL 和一次性 `launchRef`。Workbench ingress 以 `tenant + nonce + contractVersion` 建立有界 replay record：

- 同一 nonce、同一 canonical payload 的重复提交返回同一消费结果；
- 同一 nonce、不同 payload 返回 `replay_conflict`；
- 过期返回 `expired`；
- 已消费且不允许重开时返回 `already_consumed`。

规范消费状态为：

```text
issued -> validated -> launched -> revalidating
       -> opened | reconcile_required | denied | expired
       -> contract_mismatch | replay_conflict | target_unavailable
```

`unknown`、`partial`、`cancel_unknown`、stale cursor 或网络超时不得触发 Client 自动重试 mutation、替换 writer 或创建新 owner state。用户可重新请求一张新的 handoff，但必须产生新 nonce、launchRef 和证据记录。

### 6. 采用能力探测与双栈适配

DSH host 在签发前探测 Workbench consumer capability：

- 支持 `dsh.workbench_ai_drama_bridge.v2`：优先签发 V2 并使用批准 launcher。
- 仅声明 legacy consumer：通过显式 legacy adapter 继续签发现有 V1；UI 标记 `legacy_bridge`，不伪装成 V2 成功。
- 无可用 consumer 或 capability stale：禁用启动并返回稳定原因，不生成死按钮或猜测 URL。

V1 signer、validator 和 adapter 至少保留两个连续 DSH 插件发布窗口，并且必须等到匹配 Workbench consumer 已发布、V2 conformance 绿灯和采用率证据满足退出条件后，才能由独立变更提议删除。兼容窗口内不得改变旧字段含义。

### 7. 可观测性只记录安全、可聚合证据

DSH 与 Workbench 分别记录同一组稳定事件类别：`bridge_issued`、`bridge_launch_requested`、`bridge_consumed`、`bridge_reconcile_required`、`bridge_denied`、`bridge_expired`、`bridge_contract_mismatch`、`bridge_target_unavailable`。

证据只包含 contract version、intent、目标 surface、稳定 reason code、时间、版本和 opaque evidence ref。不得记录 token、raw prompt、provider payload、private tool arguments、绝对路径或完整 envelope。跨仓关联使用脱敏 `bridgeCorrelationRef`，不得复用 nonce 作为公开遥测主键。

### 8. 跨仓 conformance fixtures 是发布门

本仓库发布机器可读的 canonical fixtures 和预期结果；Workbench consumer 在其仓库读取同版本 fixture。至少覆盖：

- 五种 presentation intent 的成功映射；
- unknown key、非法 ref、非法 nonce、过期、错误 direction 和错误 target surface；
- 版本相等、版本落后、版本领先和资源不存在；
- replay idempotent、replay conflict、权限拒绝和 target unavailable；
- V2 capability、legacy-only、stale capability 和无 consumer。

插件完成门仍是本仓库 typed probe、bundle contract、ModuleLoader surface 与诚实降级；官方 DSH Web、真实 profile 和 Workbench 外仓发布不能阻塞本仓库实现完成，但“跨仓可上线”状态必须额外要求 Workbench consumer conformance 证据。

## Risks / Trade-offs

- [跨仓发布节奏不同导致 V2 长期不可用] → capability probe 默认禁用、保留 legacy adapter，并把“插件完成”与“跨仓可上线”分成两个明确状态。
- [本地 digest 被误解为授权签名] → 合同和 UI 文案明确 digest 仅做完整性检查；Workbench 始终重新鉴权和 refetch。
- [一次性 launchRef 增加 server-side 存储与过期处理] → 使用短 TTL、有界 replay record 和稳定清理策略，不创建新的 domain ledger。
- [双栈增加测试矩阵和维护成本] → 限定兼容窗口、记录使用率、冻结 V1 语义，并要求独立退役变更。
- [版本冲突使用户感到流程被中断] → 进入可解释的 `reconcile_required` lens，显示 owner 当前版本和 handoff 版本，不静默覆盖。
- [target registry 配置错误造成入口不可用] → host 启动时验证 registry 与 capability，入口显示 `target_unavailable`，并可快速回滚为 disabled/legacy 模式。

## Migration Plan

1. 在 DSH SDK/host 中增量加入 V2 schema、validator、canonical digest、fixtures 和 stable reason codes，不改动 V1。
2. 增加 `WorkbenchLaunchProvider` 与 capability probe；默认 feature flag 为 `off`，无匹配 consumer 时诚实禁用。
3. 在 DSH Client 增加 host-approved launcher、lens 预览和失败状态；继续保留 legacy handoff 展示。
4. 向 Workbench 提交 consumer handoff packet：合同、fixture 版本、目标 registry identity、ingress 状态机和验收矩阵。
5. Workbench consumer conformance 通过后，在 canary profile 开启 V2；对比 issued、consumed、denied、reconcile 和 legacy fallback 指标。
6. canary 稳定后逐步默认开启 V2；至少跨越两个连续 DSH 插件发布窗口，并保留一键切回 legacy/disabled 的配置。
7. 只有在 V2 consumer 已发布、跨仓证据持续通过且 legacy 使用率满足退出标准后，才创建独立 deprecation/removal change；本变更不删除旧合同。

**Rollback:** 关闭 V2 capability flag，停止签发新 V2 launchRef；已签发的短期 launchRef 自然过期。根据 consumer capability 切回显式 legacy adapter，或完全禁用入口并显示原因。回滚不回写、删除或转换任何 Workbench/Ordo owner state。

## Open Questions

- Workbench target registry 的最终部署级标识和 server-to-server exchange transport 由 Workbench consumer 设计确认；本合同只冻结逻辑 identity `workbench.agent.spatial`，不冻结 origin 或 raw route。
- legacy 退出的量化阈值由发布负责人在实现阶段写入 release checklist；最低时间门固定为两个连续 DSH 插件发布窗口。
