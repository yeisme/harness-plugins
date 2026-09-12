## ADDED Requirements

### Requirement: 工具详情按需读取授权正文
Tools SHALL 在现有详情中展示owner授权的Skill说明或工具文档，并将正文读取与目录摘要分离；缺少正文时保留元信息和原因。

#### Scenario: 打开已安装Skill
- **WHEN** 用户打开有正文读取能力的Skill
- **THEN** 展示该来源固定revision的SKILL.md及版本，不从同名的其他安装来源读取内容

#### Scenario: 工具只有schema
- **WHEN** MCP或native工具没有文档正文但提供公开输入schema
- **THEN** 展示说明与schema，不制造Skill文档或虚假引用

### Requirement: 引用按来源解析并安全打开
引用 SHALL 经Host按当前文档和来源版本解析；浏览器 SHALL NOT 提供任意文件读取路径。可解析的Markdown链接、包内相对路径和锚点 SHALL 支持导航。

#### Scenario: 合法上级相对路径
- **WHEN** ../引用规范化后仍位于授权来源包内
- **THEN** 打开目标固定版本，保持来源信息

#### Scenario: 越界或符号链接逃逸
- **WHEN** 引用经编码、规范化或symlink解析指向授权root之外
- **THEN** 拒绝读取并显示原因，不暴露绝对路径或目标正文

#### Scenario: 行内文件名有歧义
- **WHEN** 正文中的文件名不能唯一解析
- **THEN** 保留文本或说明歧义，不猜测其他目录的同名文件

### Requirement: 连续阅读保留位置与版本
Reader SHALL 支持返回/前进、文内搜索、渲染/源码切换和显式并排打开；导航 SHALL 保留来源版本、滚动和焦点。

#### Scenario: 两层引用后返回
- **WHEN** 用户从SKILL.md进入A再进入B并返回两次
- **THEN** 回到原文件、原滚动位置及原引用焦点，目录筛选不变

#### Scenario: 版本更新或来源卸载
- **WHEN** 正在阅读的来源升级或被卸载
- **THEN** 不把旧引用静默替换为新版本；显示过期/不可访问，只有显式刷新才采用新版本

#### Scenario: 切换项目后的迟到读取
- **WHEN** 用户切到另一项目、来源或条目后旧请求返回
- **THEN** 不覆盖新条目正文或泄漏旧scope内容

### Requirement: 阅读内容不产生执行权
文档中的命令、代码和指令 SHALL 仅作为内容；查看引用 SHALL NOT 自动安装、启用、执行工具或发送消息。远程媒体和网页 SHALL NOT 自动抓取。

#### Scenario: 文档包含脚本或执行指令
- **WHEN** 用户阅读带有命令、HTML或脚本的文件
- **THEN** 安全渲染内容，不执行脚本、命令或其中的Agent指令

### Requirement: 会话引用是独立显式动作
“引用到会话” SHALL 复用既有prepare/ack，绑定用户选择的session和resource版本；阅读 SHALL 不依赖引用服务可用。

#### Scenario: 引用时切换会话
- **WHEN** 插入待确认期间当前活动会话改变
- **THEN** 保持原明确目标或报告目标失效，不静默插入新会话；ack前不显示成功

### Requirement: 有界读取与可访问失败恢复
Reader SHALL 限制首段文本256KiB/5000行、显式报告截断并支持同版本续读，保留键盘、IME及窄Pane可用性。

#### Scenario: 大文件或续读版本变化
- **WHEN** 文档超过上限或续读时版本改变
- **THEN** 显示已读范围；版本不符拒绝混合拼接，允许显式重读

#### Scenario: 读取服务不可用
- **WHEN** Host尚未提供正文读取能力
- **THEN** 正文入口给出原因及可追踪缺口，既有目录和调用活动仍可用

### Requirement: 验收区分设计与可用实现
本能力 SHALL 分别记录协议、fixture和真实安装来源证据，SHALL NOT 将截图、文档完成或mock测试当真实宿主验收。

#### Scenario: 仅完成设计
- **WHEN** proposal/design/spec/tasks创建且校验通过
- **THEN** 实现与真实使用任务保持未完成
