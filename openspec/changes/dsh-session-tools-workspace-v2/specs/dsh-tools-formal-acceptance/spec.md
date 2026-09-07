## ADDED Requirements

### Requirement: Tools 全功能验收
交付 SHALL 覆盖目录连接/重连、会话目录、活动、详情定位、全局CAS、标题与固定绑定、布局恢复及卸载；不能仅凭标题出现、HTTP200或活动可见宣布完成。

#### Scenario: 目录故障验收
- **WHEN** 真实本地宿主目录查询不可用
- **THEN** Tools 目录验收 SHALL 标为失败或明确依赖阻塞，活动通过不得覆盖该失败

#### Scenario: 外部能力缺失
- **WHEN** 本地缺少实际 MCP 服务或授权
- **THEN** 测试 SHALL 区分 mock 合同通过与真实连接未验证，不修改生产配置或自动发起付费调用

### Requirement: 全插件加载与入口冒烟
测试 SHALL 动态发现全部本地可安装 bundle，与实际 profile 和装载状态对照，检查每个适用入口；当前33个仅为基线，新增插件 MUST 自动进入清单。

#### Scenario: 非UI或依赖缺失插件
- **WHEN** bundle 没有独立UI，或其服务/凭据缺失
- **THEN** 清单 SHALL 分别给出不适用理由或阻塞原因，不把不存在入口当作正常可用

### Requirement: 脱敏正式证据
integration/component/system/e2e 每次执行 SHALL 在本项目 temp/integration-test-runs/<run-id>/ 生成 summary.json、command.txt、stdout.log、stderr.log、env.json、artifacts/；失败保留证据和原退出码。

#### Scenario: 验收记录与任务状态
- **WHEN** 某任务被标记完成
- **THEN** 必须有对应实际通过的命令与证据；本规格文档完成不得被当作功能实现完成，截图/日志不得包含 token、原始消息正文或敏感工具内容
