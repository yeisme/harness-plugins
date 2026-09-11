## ADDED Requirements

### Requirement: 模板目录发现
系统 SHALL 在 DSH paneWorkbench 提供模板目录 pane，按类别、capability 与 tag 浏览和搜索模板仓库 solution，并通过 typed RPC inspect contract。

#### Scenario: 按能力发现
- **WHEN** 用户以 capability（如 `model3d`）或 artifact tag 检索
- **THEN** 目录 pane 返回匹配 solution 的 safe projection（exact ref、标题、摘要、tags、rights、maturity），不含模板正文或路径

#### Scenario: rights 不允许 preview
- **WHEN** 某 solution 的 rights 不允许 preview
- **THEN** preview 入口禁用并显示原因，不以任何方式回退提供正文

### Requirement: contract 驱动的引导编译
系统 SHALL 由 contract 输入 schema 生成确认表单，关键创作选择必须显式确认后才能编译，编译期 `provider_calls=0`，并支持显式导出提示包。

#### Scenario: 编译成功
- **WHEN** 必填字段齐备且关键选择已确认
- **THEN** Registry 编译并返回结果（exact ref、digest），pane 展示结果卡并允许导出，`provider_calls=0`

#### Scenario: 缺字段或未确认
- **WHEN** 必填输入缺失或关键创作选择未确认
- **THEN** 编译按钮禁用或编译以逐条可读错误拒绝，不编造默认值

#### Scenario: 模板 digest 变化
- **WHEN** 编译会话所引用的模板 digest 已变化（stale）
- **THEN** 导出被禁用并要求重新确认，不自动替换引用

### Requirement: 无 CLI 恢复合同
系统 SHALL 在本机未安装 template-registry CLI 时，通过 MCP `tools/list` 与 `inputSchema` 取得动作参数和恢复合同；CLI help/doctor 仅是已安装时的可选增强。

#### Scenario: 无 CLI 环境重开 pane
- **WHEN** 本机无 template-registry CLI 且用户重开引导编译 pane
- **THEN** pane 从 session projection 恢复编译会话（contract ref、digest、已确认字段摘要），不要求安装 CLI

#### Scenario: MCP 断开
- **WHEN** template-registry MCP 通道断开且 catalog adapter 可用
- **THEN** 目录 pane 降级为只读浏览并显示原因，编译与导出入口禁用，不出现死按钮

### Requirement: 集成边界
系统 SHALL 保持 DSH 插件只做安全投影与交互外壳：不存模板正文到浏览器侧 store，不执行 provider，不产生费用，不创建 scheduler/task ledger/approval ledger。

#### Scenario: 投影不包含越权内容
- **WHEN** 浏览器读取任意 session projection
- **THEN** 其中只有 exact ref、digest、有界摘要、rights、版本与 action，不含 token、cookie、绝对路径、raw prompt 全文或 provider payload
