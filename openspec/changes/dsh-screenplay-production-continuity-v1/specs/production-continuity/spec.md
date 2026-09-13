## ADDED Requirements

### Requirement: Workbench canvas SHALL use the existing storage owner
系统 SHALL 通过 Creator Studio 的现有画布合同保存同一文档，保留项目 scope 和 revision；缺少写入能力时不得伪造成功。

#### Scenario: Save from the embedded canvas
- **WHEN** 做剧工作台编辑画布并保存
- **THEN** 请求仅发送给现有 Creator Studio Host，独立画布重开读取同一已确认版本

### Requirement: Acknowledgements SHALL preserve later edits
系统 SHALL 仅确认已提交的编辑快照，保存期间新增的编辑必须保持未保存状态。

#### Scenario: Transform changes during save
- **WHEN** 3D 保存仍在等待回执时用户再次修改对象
- **THEN** 原回执推进版本但保留新编辑及 dirty 状态，下次保存携带新版本

### Requirement: Production handoff SHALL retain owner facts
系统 SHALL 使用固定剧本版本、Scaena 镜头与候选采用回执形成制作包；草稿导出不得冒充正式交付。

#### Scenario: Upstream screenplay changes
- **WHEN** 已组织镜头的来源剧本出现新版本
- **THEN** 标记受影响项，保留原素材选择与制作包，不自动替换或执行

### Requirement: Previsualization SHALL have recoverable persistence
系统 SHALL 明确保存镜头预演与关键帧草稿，关闭重开可恢复；未支持持久化的字段不能被标记为已保存。

#### Scenario: Pending previsualization save
- **WHEN** 保存响应丢失后重开工作台
- **THEN** 通过原操作对账并保留草稿，不重复执行或改变生产镜头
