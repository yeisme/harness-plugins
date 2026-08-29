## ADDED Requirements

### Requirement: Show Control Host SHALL compose owner-backed safe projections
Host SHALL 通过 `DramaShowControlOwnerAdapterV1` 组合 show summary、episode、review、asset 和 delivery projection；它 MUST NOT 创建或持有 canonical domain state。

#### Scenario: No owner adapter is mounted
- **WHEN** Show Control 被打开但没有领域 adapter
- **THEN** snapshot SHALL 返回 needs_contract/partial 和安全原因，items SHALL 为空且不得生成示例生产数据

### Requirement: Projection requests SHALL be context-bound and bounded
每个请求 MUST 绑定当前 tenant/workspace/principal/runtime generation 和 showRef；page limit 默认 50、最大 100，cursor MUST opaque。

#### Scenario: Request targets another show or workspace
- **WHEN** browser request 的 showRef 或 context revision 不匹配 Host 绑定上下文
- **THEN** Host SHALL 拒绝并返回 contract_mismatch/permission_denied，不读取任何 owner data

### Requirement: Projection payloads SHALL exclude unsafe owner data
投影 SHALL 仅含 opaque refs、version、bounded title/summary、status、progress、freshness、evidence refs 和 artifact refs；MUST NOT 含 raw URL、path、credential、正文、prompt 或 provider payload。

#### Scenario: Adapter returns an unsafe URL or path
- **WHEN** adapter payload 包含 URL、绝对路径或 credential-like 字段
- **THEN** validator SHALL 拒绝该 segment，并把整体结果降级为 partial/contract_mismatch
