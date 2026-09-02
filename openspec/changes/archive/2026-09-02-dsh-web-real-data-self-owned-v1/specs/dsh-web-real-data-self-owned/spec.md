# dsh-web-real-data-self-owned Capability

DSH Web 常用面板的真实数据自控链：数据源审计、ordo 本地 CLI 链、官方已有 seam 链与诚实降级。

## ADDED Requirements

### Requirement: 常用面板 SHALL 建立数据源审计基线
本能力 SHALL 先产出常用面板（ordo/team-hub、token/session/model/用量、command-first 状态中枢投影）的数据源审计清单：每面板标注真数据 / 官方 seam 可接 / 静态投影三态与真数据率基线。清单 SHALL 随实现推进更新，作为 ≥80% 验收口径的唯一账本。

#### Scenario: 审计清单可复核
- **WHEN** 审计完成
- **THEN** 清单 SHALL 覆盖常用面板全集并给出基线真数据率
- **AND** 每个面板的三态标注 SHALL 附可验证依据（数据来源标识或投影类型）

### Requirement: ordo/team-hub 面板 SHALL 接本地 ordo CLI 真数据
ordo/team-hub 相关面板 SHALL 从本地 ordo CLI 获取真实 run/task/approval/evidence/team 数据并渲染，只读安全投影。数据链路 MUST NOT 创建第二 scheduler、task ledger 或 approval ledger，MUST NOT 把凭据、raw prompt、provider payload、private tool arguments 或绝对路径带进投影。CLI 不可用或命令失败时面板 SHALL 显示安全离线态与原因。

#### Scenario: 面板显示真实 run 数据
- **WHEN** 本地 ordo 存在历史 run 且 CLI 可用
- **THEN** ordo 面板 SHALL 显示真实 run/task/approval/evidence 记录
- **AND** 投影内容 SHALL 与 ordo-dsh-plugin-visualization 冻结的安全投影边界一致

#### Scenario: CLI 不可用时诚实降级
- **WHEN** 本地 ordo CLI 不在 PATH 或执行失败
- **THEN** 面板 SHALL 显示离线/失败原因
- **AND** MUST NOT 用演示数据冒充真实数据

### Requirement: 官方已有 seam 面板 SHALL 全部真数据化
token/session/model/用量相关面板 SHALL 接官方已有 seam 的真实数据；官方 seam 缺失的面板保持 probe-first 降级并显示不可用原因，MUST NOT 伪造数值或时间序列。

#### Scenario: 用量面板显示真实账本
- **WHEN** 官方 tokenMeter/session seam 可用
- **THEN** 用量与会话相关面板 SHALL 显示真实数值
- **AND** seam 不可用时 SHALL 显示不可用原因而非静态演示值

### Requirement: 真数据率 SHALL 以常用面板清单度量且 ≥80%
验收 SHALL 以数据源审计清单计算常用面板真数据率并达到 ≥80%。真数据判定标准：面板主数据来自真实 owner 数据源或官方 seam，演示/静态数据仅出现在显式标注的降级态。

#### Scenario: 验收口径唯一
- **WHEN** 本 change 归档评审
- **THEN** 真数据率 SHALL 从审计清单计算得出且 ≥80%
- **AND** 未达标面板 SHALL 有明确的 seam 缺失或外部依赖原因记录
