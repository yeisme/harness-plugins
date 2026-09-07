## ADDED Requirements

### Requirement: WB-OMW-CONTRACT 通用接入 SHALL 复用现有控制链

Workbench SHALL 通过WorkbenchClient/BFF/ProposalAuthority/TaskService访问Ordo，保存Task↔owner refs而非第二run状态。旧Team和新managed授权分开。

#### Scenario: 用户委托
- **WHEN** 用户在已有session确认managed工作
- **THEN** 服务端重验scope/revision/额度并调用Ordo，返回原operation与receipt

#### Scenario: 只有chat或旧plan批准
- **WHEN** 请求用旧grant执行managed mutation
- **THEN** 拒绝升级权限，继续要求对应owner授权

#### Scenario: 合同恢复
- **WHEN** provider版本或授权补齐后重取capability与operation descriptor
- **THEN** 重新建立typed mapping，旧失败请求不自动重放，原Task保留可对账引用

### Requirement: WB-OMW-PARITY 双入口 SHALL 共享事实

新registered Pane SHALL 保留既有/agent shell，复用scope摘要及selected stream；独立网页和Workbench同work不产生两次执行。

#### Scenario: 双入口接力
- **WHEN** 独立Web取得control后用户回Workbench
- **THEN** 显示同run/receipt，旧control动作禁用，可显式取得control而不重启writer

#### Scenario: 关Pane或事件gap
- **WHEN** 用户切session、关Pane或游标过期
- **THEN** 后台继续；BFF重取snapshot，无每Pane重复流或动作重放

#### Scenario: 接力恢复
- **WHEN** 当前control holder释放或过期且用户显式取回control
- **THEN** Workbench从同一work/run恢复可写状态，不新建writer或覆盖另一端receipt

### Requirement: WB-OMW-LEGACY 领域入口 SHALL 保持兼容

新consumer SHALL 复用本地design-system与通用adapter；旧read-only、exact-plan、Text Development及稳定deep link继续工作。

#### Scenario: 领域Team使用
- **WHEN** Text Development发起原Team预览/simulation
- **THEN** 走共享adapter的旧contract，保持Auctra候选/Canon边界

#### Scenario: 新能力关闭或unknown
- **WHEN** managed capability缺失或操作结果未知
- **THEN** 缺失显示needs_contract并保留旧路径；unknown仅原operation reconcile，不伪造成功

#### Scenario: 旧路径恢复
- **WHEN** managed capability回滚或Text Development重新连接旧Team contract
- **THEN** 继续读取旧projection并完成原operation对账，不迁移或重写领域canonical状态

### Requirement: WB-OMW-UI 控件 SHALL 遵循现有主壳与可访问性

Pane SHALL 保留Chat/composer与单一context rail，状态/动作来自server，zh-CN/en-US、三宽度、键盘、reduced-motion完整。

#### Scenario: 查看工作
- **WHEN** 用户从/agent打开工作Pane
- **THEN** 按概览→关系/时间线→技术详情呈现，不新增主壳或跨仓CSS依赖

#### Scenario: 窄屏与过期状态
- **WHEN** 视口缩小或owner投影stale
- **THEN** 用labelled Sheet/语义列表，禁用旧revision动作并保留恢复原因

#### Scenario: UI状态恢复
- **WHEN** 新owner snapshot到达或用户关闭Sheet返回原Pane
- **THEN** 恢复焦点、选择与current actions，事件更新不remount composer或抢占输入
