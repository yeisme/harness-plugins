## ADDED Requirements

### Requirement: Contribution 级健康状态

每个插件 contribution SHALL 投影 `available|degraded|disabled`、阶段、稳定 code、bounded reason、fix、last checked 和可选 receipt ref；一个 contribution 的异常 MUST 不改变其它 contribution 的状态。

#### Scenario: 可选 pack 启动失败

- **WHEN** pack 的 host/client registration 抛错
- **THEN** 该 pack SHALL disabled，基础包 SHALL 继续启动，doctor SHALL 能定位失败阶段与修复动作

### Requirement: Critical 与 optional 分级

基础包关键 contribution 缺失 SHALL 使 personal coding profile 状态为 failed/degraded 并阻止虚假 ready；可选 pack 缺失 SHALL 只标 optional degraded。

#### Scenario: Terminal 可选 native 依赖缺失

- **WHEN** node-pty 缺失但 fallback terminal capability 可用
- **THEN** terminal contribution SHALL 标 degraded/fallback，profile MUST 不被误判完全失败

### Requirement: 错误脱敏与重试边界

health reason MUST 不包含 stack、credential、raw argv、provider payload 或 full reasoning；Retry SHALL 只重新执行该 contribution 的 probe/refresh，不重启整个 profile或重复 mutation。

#### Scenario: Action apply outcome unknown

- **WHEN** owner action 超时且 outcome unknown
- **THEN** health SHALL 显示 reconcile required，Retry MUST 不重新提交 action
