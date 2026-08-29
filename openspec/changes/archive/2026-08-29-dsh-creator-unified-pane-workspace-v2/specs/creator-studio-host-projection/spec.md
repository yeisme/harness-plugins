## MODIFIED Requirements

### Requirement: Creator Studio Host SHALL freeze a complete server context

Host SHALL 在 `CreatorStudioGateway` 构造时严格验证、脱离复制并冻结 tenantRef、workspaceRef、可选 projectRef、sessionRef、principalRef、revision、membershipRevision、installationRef、pluginDigest、policyRevision 和 runtimeGeneration。缺失或非法 required context SHALL 返回不含 owner 事实的 `contract_mismatch`，且后续 Context key replacement MUST NOT 改变已捕获绑定。projectRef 缺失 SHALL 只禁用需要当前项目的能力，不得阻断旧 Creator snapshot。

#### Scenario: Expected context is missing
- **WHEN** Creator Studio Remote 在没有完整 server-injected required context 时读取 snapshot
- **THEN** Remote SHALL 返回 `context_unavailable` 和六个不含资源或动作的 contract fallback

#### Scenario: Context changes after gateway construction
- **WHEN** Host 在 gateway 构造后替换 expected context service
- **THEN** gateway SHALL 继续按构造时冻结的 context 校验 owner snapshot 与动作请求

#### Scenario: Project context is absent
- **WHEN** required context 有效但 projectRef 缺失
- **THEN** 普通 Creator snapshot SHALL 保持可读，而 current-project asset query SHALL 返回 needs_contract

## ADDED Requirements

### Requirement: Host SHALL expose additive asset and operations projections

Gateway SHALL 增加资产查询、approval decision 与可选 operations fields，并继续输出原有 production、reviews 与 jobs。新字段缺失 MUST NOT 使旧 snapshot 失效，旧字段也 MUST NOT 被重解释为 Ordo canonical truth。

#### Scenario: New client reads new host
- **WHEN** Ordo 与 asset adapters 已挂载
- **THEN** Host SHALL 同时输出新 projection 与旧兼容字段

#### Scenario: Old client reads new host
- **WHEN** 旧客户端忽略未知字段和 Remote 方法
- **THEN** 原有 snapshot、dispatch 与 resolveArtifact 行为 SHALL 保持不变
