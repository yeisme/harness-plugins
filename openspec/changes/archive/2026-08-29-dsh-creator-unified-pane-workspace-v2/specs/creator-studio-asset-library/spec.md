## ADDED Requirements

### Requirement: Asset library SHALL default to the current project

Creator Studio SHALL 提供跨 owner 资产 Pane，并在首次打开时使用 `current_project` scope。当前冻结 context 缺少 `projectRef` 时，Client SHALL 显示 `needs_contract`，且 MUST NOT 把 workspaceRef 猜测为 projectRef。

#### Scenario: Current project context is available
- **WHEN** 用户首次打开资产管理且 frozen context 含 projectRef
- **THEN** Host SHALL 只返回该 projectRef 下的授权资产

#### Scenario: Current project context is missing
- **WHEN** 用户打开资产管理但 frozen context 不含 projectRef
- **THEN** Pane SHALL 显示 current project contract 缺失且不得显示其它项目资产

### Requirement: All-project assets SHALL remain tenant and principal scoped

用户 MAY 显式选择 `all_projects`。Host SHALL 只把 frozen tenant/principal context 传给 owner adapter，并 SHALL 在服务端完成 owner 合并、过滤、稳定排序和分页；Browser MUST NOT 逐 owner 扫描私有状态。

#### Scenario: User selects all projects
- **WHEN** 一个或多个 owner adapter 显式实现 all-project asset listing
- **THEN** Host SHALL 返回当前授权主体可见的安全资产页及 unavailable owner 列表

#### Scenario: No owner supports all projects
- **WHEN** 用户选择 all_projects 但没有 owner 发布该能力
- **THEN** Host SHALL 返回 needs_contract 且不得回退到当前 snapshot 或浏览器 fan-out

### Requirement: Asset pages SHALL expose safe bounded references

资产页 SHALL 只包含 owner、projectRef、版本化 artifact/resource ref、kind、status、title、可选 rights/lineage 摘要及分页 cursor。绝对路径、永久 URL、凭据、raw prompt 和 provider payload MUST NOT 出现在结果中。

#### Scenario: Owner returns an unsafe asset page
- **WHEN** owner asset listing 包含非法 ref、unsafe text 或超过边界的数据
- **THEN** Host SHALL 丢弃该 owner page 并把 owner 标记为 contract mismatch

#### Scenario: User opens an asset preview
- **WHEN** 资产声明 preview/open capability
- **THEN** Client SHALL 继续通过现有 resolveArtifact 获取短期访问授权
