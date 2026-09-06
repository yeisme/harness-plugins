# dsh-session-micro-surfaces Specification

## Purpose
TBD - created by archiving change dsh-session-insights-and-status. Update Purpose after archive.
## Requirements
### Requirement: 小插件与 Pane 的会话绑定

胶囊、Tokens、Popover 和统计 Pane SHALL 共用明确 sessionRef 的 view model；多个会话 MUST 隔离，不跟随全局最后活动会话。

#### Scenario: A 与 B 并排

- **WHEN** A 的 Tokens 打开后 B 产生新用量
- **THEN** A 保持绑定 A；B 更新只影响绑定 B 的表面。

#### Scenario: 显式换对象的迟到回包

- **WHEN** 用户把统计从 A 切到 B，A 的请求随后返回
- **THEN** 取消或丢弃 A 回包，不能覆盖 B 的内容。

### Requirement: 晚到服务与订阅释放

插件 SHALL 支持 Pane、Remote、locale provider 晚到/替换；同目标共享有界订阅，卸载、HMR 和权限撤销 MUST 释放旧资源。

#### Scenario: Pane 后到

- **WHEN** 插件先启动而 Pane 服务稍后出现
- **THEN** 入口可升级为展开 Pane，不被一次启动探测永久锁定在弹窗。

#### Scenario: 重连与 HMR

- **WHEN** 同一目标在多个表面打开，随后重连并热更新
- **THEN** 不重复计数和订阅；重读权威快照，不重放命令、余额查询或模型调用。

### Requirement: 状态与有效恢复动作

UI SHALL 区分 loading、empty、error、ready、partial、stale、unsupported；用量重试与余额刷新 MUST 独立，MUST NOT 把所有失败渲染为版本不支持。

#### Scenario: 初次用量失败

- **WHEN** snapshot/query 失败但余额刷新成功
- **THEN** 分别显示用量失败和余额结果，保留可用数据及重试入口。

#### Scenario: 没有订阅能力

- **WHEN** 只读查询存在但实时订阅 seam 缺失
- **THEN** 说明需要手动刷新，不能显示实时更新承诺。

### Requirement: 统一视觉与可访问性

统计 Pane SHALL 使用统一 Surface inspector，micro/embed 使用统一 token 和官方 primitives；绑定对象、范围和完整性 MUST 优先于余额及装饰图表。

#### Scenario: 窄屏及辅助输入

- **WHEN** 在 360/560/960px、200% 缩放、中英文长文本、触控、键盘与减少动效环境打开面板
- **THEN** 信息和主动作可达、焦点可见、无页面横向溢出；图表有文本等价且邻接插件样式不受污染。

#### Scenario: 关闭微表面

- **WHEN** 用户 Escape 关闭状态 Popover
- **THEN** 焦点返回同会话触发点或标签，不跳到其他会话输入框。

### Requirement: 可审查的验收证据

integration/component/e2e SHALL 经现有 runner 生成项目内标准脱敏证据，失败保留日志与退出码；协议通过 MUST NOT 冒充缺失 owner 的完整历史能力通过。

#### Scenario: owner 未提供完整历史

- **WHEN** adapter 协议测试通过但缺真实历史能力
- **THEN** 验收表记录未验证能力与原因，不标注完整会话统计已通过。

#### Scenario: 回归用例失败

- **WHEN** /status 到轨迹的组件或浏览器夹具失败
- **THEN** 保存 summary.json、command.txt、stdout.log、stderr.log、env.json 和 artifacts，不自动更新视觉基线。

