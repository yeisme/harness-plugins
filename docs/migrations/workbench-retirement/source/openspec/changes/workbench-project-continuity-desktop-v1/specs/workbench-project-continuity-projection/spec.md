## ADDED Requirements

### Requirement: 安全项目总览与四面接口

Workbench MUST 经 `WorkbenchClient.project` 提供版本化 `GetProjectOverview`、`GetProjectContinuity`、`PrepareProjectContinuation`；SDK/HTTP/gRPC/JSON-RPC 共享授权、错误、幂等和投影语义，保持旧 ProjectDataset/WorkItem 合同。

#### Scenario: 有权限项目的部分 owner 不可用
- **WHEN** 项目授权有效，但 Pinax 或某成果 owner 超时
- **THEN** 对应分区返回 offline/partial 及真实来源状态，其他已授权分区可读，不伪造全部 ready

#### Scenario: 跨项目访问
- **WHEN** caller 使用另一主体或项目的 safe ref 请求总览或 prepare
- **THEN** 四种调用面均拒绝，且不会返回目标内容或用默认项目替代

### Requirement: Pinax 连续性来源权威

Continuity projection MUST 保留 Pinax-issued refs/revisions、来源新鲜度、冲突和缺口；Workbench 不从 transcript、目录名或局部 UI state 生成 confirmed memory。

#### Scenario: 无 handoff 或 binding 歧义
- **WHEN** Pinax 未返回可信 handoff，或同项目存在多个候选 binding
- **THEN** 显示 context-only/resolve binding，不编造上次状态，不自动选最近 scope

#### Scenario: 来源版本过期
- **WHEN** prepare 发现用户查看的 source revision 已失效
- **THEN** 返回 Refresh/Remove/Review 恢复动作，不能静默升级来源或丢弃该 source 后继续

### Requirement: Prepare 不执行工具

Prepare MUST 只生成经过校验的继续动作描述符；provider call、Context attach、Agent turn 和 mutation 必须通过用户后续明确动作与现有服务链完成，执行时再次重验。

#### Scenario: 打开项目或重复 prepare
- **WHEN** 浏览器恢复视图或重复同一幂等键的 prepare
- **THEN** 不启动 Task/工具、不重新签发批准，准备结果按同一语义返回

#### Scenario: 原运行尚在执行或结果未知
- **WHEN** 原 attempt 是 running 或 `unknown_accept`
- **THEN** 分别返回 observe_existing 或 reconcile_existing，不能创建替代执行

#### Scenario: 用户显式换 Runtime
- **WHEN** 用户选择同项目的新 Runtime 并确认适用授权
- **THEN** 准备新 session 和授权 continuity refs，保留旧 attempt/receipt，不自动重放 transcript/tools

### Requirement: 项目视图与内容隔离

视图恢复 MUST 复用 Layout service 的 principal/project 安全 metadata，内容保存由对应 owner 完成；项目切换/失权必须隔离缓存与事件。

#### Scenario: 迟到事件与失权对象
- **WHEN** 用户已切到另一项目或最近文档已失权后旧事件到达
- **THEN** 旧事件不能改变当前选择，失权内容不恢复，主区回到合法成果或项目续接视图

#### Scenario: Owner 尚未确认保存
- **WHEN** 编辑内容只有本地 buffer 或保存结果未知
- **THEN** UI 不显示 saved，离开时保留/提示恢复；不将正文写入 Layout 或 Workbench metadata

### Requirement: Provider 与旧合同兼容

新增投影 MUST 通过版本化 closed schema 和 provider digest 校验，旧消息、方法、source identity 和 existing grants 保持原义。

#### Scenario: 不支持的新版本
- **WHEN** provider 返回未知 major/critical field 或缺少必须的恢复合同
- **THEN** 拒绝相应 capability 并显示 needs_contract，不回退为私有目录读取或 fake success
