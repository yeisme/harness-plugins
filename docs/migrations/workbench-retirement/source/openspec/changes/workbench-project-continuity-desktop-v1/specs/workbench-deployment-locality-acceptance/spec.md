## ADDED Requirements

### Requirement: 同一产品在部署端使用工具

Workbench MUST 使用同一前端和业务合同支持本地与远程服务部署，工具/目录选择来自部署端授权 registry；浏览器只连接同源 BFF，远程模式不得使用 local-token fallback。

#### Scenario: 同版本双部署
- **WHEN** 在本地实例和受控远程实例运行同一版本场景
- **THEN** 使用各自部署端工具/工作目录并产生独立 receipt；同一 operation 语义一致，浏览器机器不成为默认执行节点

#### Scenario: 远程工具缺失
- **WHEN** 远程部署未安装所需工具或 adapter 未 ready
- **THEN** 只将对应 capability 标为 unavailable，不扫描浏览器机器、不切换另一部署、不用 mock 替代执行

### Requirement: 真实链路与场景晋级

首版 MUST 分别验证真实 Agent、部署端工具、成果 owner、Pinax 续接和 local/remote 部署；研发、调研、文本、多模态共用内核并分别标注 readiness。

#### Scenario: 只有部分证据
- **WHEN** fixture/reference 浏览器流通过但 Agent/Pinax/远程任一必需链路未验证
- **THEN** 保持对应 blocked/needs_contract，不宣布个人首版或远程形态已完成

#### Scenario: 专业场景尚未成熟
- **WHEN** 文本或多模态 owner 合同仍在交付
- **THEN** 保留该场景与既有专业能力，标 exploratory/blocked；研发和调研可以独立积累证据

### Requirement: 可复现证据与零空匹配

所有 integration/component/system/e2e MUST 经既有 runner 写入本项目 per-run 六件套，保留失败退出码并脱敏；场景验收 MUST 匹配实际用例，skip 或零用例不能记 pass。

#### Scenario: 失败或无匹配测试
- **WHEN** WB-PC selector 无测试、测试失败或真实 provider 不可用
- **THEN** 记录 failed/blocked 与原因及原退出码，不能用规格验证或 mock pass 代替真实证据

### Requirement: 持续使用与回滚验证

晋级 MUST 验证 PRD 的十次续接、三项目/两类场景、六十分钟保存与重复执行指标，并完成新增 capability 关闭后的旧行为与原在途任务恢复测试。

#### Scenario: 跨会话和重启恢复
- **WHEN** 执行十次已记录的续接样本及六十分钟持续工作
- **THEN** 至少八次在三十秒内定位正确成果与下一步，已确认保存内容零丢失，已接受操作零重复执行；保留失败样本

#### Scenario: Capability 回滚
- **WHEN** 用户有在途任务且关闭新增工作区能力
- **THEN** 原 shell/深链继续可用，任务历史及 owner 数据不被删除，原任务查询/cancel/reconcile 可达
