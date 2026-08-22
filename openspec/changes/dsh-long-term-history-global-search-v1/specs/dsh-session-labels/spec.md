## ADDED Requirements

### Requirement: 标签是 durable owner state
系统 SHALL 通过 DSH Host 标签 capability 管理 Session labels，SHALL 将接受后的完整 label snapshot 记录为 log-only Session event，并且客户端 SHALL NOT 使用 localStorage 或私有数据库作为 canonical label state。

#### Scenario: 添加标签
- **WHEN** 用户为一个 Session 添加一个有效标签且 expected revision 匹配
- **THEN** owner 追加新的 labels snapshot event、返回 revision/receipt，并向所有已连接客户端投影相同结果

#### Scenario: 多客户端并发冲突
- **WHEN** 两个客户端基于同一旧 revision 同时替换标签集合
- **THEN** 至多一个 mutation 成功，另一个收到 typed revision conflict 并重新读取 owner snapshot

### Requirement: 标签规范化和限制一致
系统 MUST 对标签执行控制字符移除、trim、Unicode NFKC、空白折叠和 Unicode case-insensitive 去重；每个 Session 最多 32 个标签，每个标签最大 64 UTF-8 bytes。

#### Scenario: 大小写与兼容字符重复
- **WHEN** 用户提交仅在大小写、全半角或 Unicode 兼容形式上不同的重复标签
- **THEN** owner 使用同一个比较键拒绝或合并重复值，并返回确定性的显示值

#### Scenario: 无效标签
- **WHEN** 标签为空、仅含控制字符/标点、超过大小限制或使总数超过限制
- **THEN** mutation 被拒绝，原 snapshot 和 revision 不变

### Requirement: 标签可被搜索和筛选
系统 SHALL 将每个接受后的显示标签投影为 `label` search document，并 SHALL 支持 exact、prefix、CJK 与 filter 匹配。

#### Scenario: 标签命中优先
- **WHEN** query 与一个 Session label normalized exact match
- **THEN** 该命中排序优先于正文命中，并返回 `kind=label` 与对应安全 highlight

#### Scenario: 标签删除后重建
- **WHEN** 新 snapshot 删除一个旧标签并完成 index reconcile
- **THEN** 新 generation 不再返回该标签命中，旧 Session log 仍保留历史 snapshot 供审计/replay

### Requirement: fork 标签继承可追踪
系统 SHALL 让普通 fork 从 fork boundary 继承当前 label snapshot，并 SHALL 记录继承来源；父子 Session 之后的标签修改互不影响。

#### Scenario: fork 后独立修改
- **WHEN** 子 Session 继承标签后用户只修改子 Session 标签
- **THEN** 父 Session 的 snapshot/revision 保持不变，搜索分别返回各自最新标签
