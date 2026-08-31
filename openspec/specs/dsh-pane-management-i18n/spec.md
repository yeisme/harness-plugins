# dsh-pane-management-i18n Specification

## Purpose
TBD - created by archiving change dsh-pane-workspace-interaction-v4. Update Purpose after archive.
## Requirements
### Requirement: Pane Workbench SHALL 使用统一 locale namespace
Pane Workbench 固定 copy SHALL 注册在 DSH locale owner 下的 `paneWorkbench` namespace，并首发 `zh` 与 `en`。Activity Rail、View Picker、Tab/group actions、menus、errors、empty states、Tooltips、Designer、ARIA labels 和 live announcements MUST NOT 以散落硬编码字符串作为正常生产路径。

#### Scenario: Pane bundle 加载
- **WHEN** compatible DSH LocaleRuntime 可用
- **THEN** bundle SHALL 注册 `paneWorkbench` 中英文词典并按 active locale 渲染
- **AND** dispose/HMR SHALL 解除旧 generation 的 locale contribution和 subscription

### Requirement: Local view registration SHALL 可声明 optional i18n keys
`PaneViewRegistrationV1` SHALL 以 additive optional local-only block 支持 namespace、label key、description key 和 search keywords key。现有 `descriptor.label` SHALL 保留为 fallback；远端 projection MUST NOT 选择 locale namespace、translation key 或 executable formatter。

#### Scenario: 旧 provider 无 i18n block
- **WHEN** provider 仅声明现有 descriptor label
- **THEN** registry SHALL 继续接受并使用 label 作为 fallback
- **AND** provider MUST NOT 因 V4 locale capability 缺失而失效

#### Scenario: 远端 projection 注入 translation key
- **WHEN** Host payload 尝试指定 namespace、labelKey 或 formatter code
- **THEN** client SHALL 忽略或拒绝该字段为 contract mismatch
- **AND** 只使用本地已注册的安全 copy

### Requirement: Locale fallback SHALL 确定且可诊断
翻译解析 SHALL 按 active locale、language base、English、descriptor fallback 的顺序执行。Missing key SHALL 在开发诊断中记录 namespace/key 和安全 fallback，MUST NOT 在生产 UI 显示 raw exception、空 label 或 translation object。

#### Scenario: 中文缺少一个新增 key
- **WHEN** active locale 为 `zh-CN` 且目标 key 只存在于 English
- **THEN** UI SHALL 使用 English value 并保持 control accessible
- **AND** developer diagnostic SHALL 指明 missing key而不泄露用户数据

### Requirement: Locale 热切换 SHALL 只改变 presentation
运行时 locale 变化 SHALL 更新可见 copy、Tooltips、ARIA labels、relative/count formatting 和后续 announcements，MUST NOT 改变 Pane layout、view ids、Tab order、selection、drag intent、pending action、receipt 或 Workspace Designer draft semantics。

#### Scenario: 拖拽期间切换语言
- **WHEN** active Tab 正处于 dragging 且 locale 变化
- **THEN** Workbench SHALL 安全取消 drag、恢复 source focus，并用新 locale 提供取消说明
- **AND** canonical layout SHALL 保持不变

### Requirement: Counts、快捷键和动态 announcement SHALL 结构化格式化
Pane Workbench SHALL 使用 locale-aware formatter 处理 count、plural、relative time、shortcut labels、source/target group 和 action result。实现 MUST NOT 通过字符串拼接把 English 词序硬编码进其他语言。

#### Scenario: 宣布批量关闭
- **WHEN** 用户成功关闭三个 Tabs
- **THEN** live region SHALL 使用 active locale 的复数/数量格式宣布结果
- **AND** announcement SHALL 不逐项轰炸屏幕阅读器

### Requirement: Error 与 risk copy SHALL 保留 owner facts 和恢复动作
Localized error SHALL 分离 stable error code、owner facts、用户说明和 recovery action。翻译 MUST NOT 改变 action risk、target、revision、cost、approval requirement 或 receipt status 的语义。

#### Scenario: Git push 需要审批
- **WHEN** owner 返回 `approval_required` 和 remote target
- **THEN** Pane SHALL 本地化说明与按钮，同时原样安全显示 target/ref 和 risk facts
- **AND** 未获 approval receipt 前 action SHALL 保持禁用

### Requirement: Locale layout SHALL 通过 pseudo-long 与 pseudo-RTL 防回归
CI/browser tests SHALL 覆盖扩展长度 pseudo locale 和 pseudo-RTL direction，用于发现 clipped labels、溢出 menus、Tab/toolbar 碰撞和错误 physical spacing。V4 MUST 使用 logical CSS properties 处理新增 spacing/order，但不因测试存在而宣称完整 RTL 语言支持。

#### Scenario: Pseudo-long labels
- **WHEN** 所有 Pane actions 被扩展到约 1.8 倍长度
- **THEN** toolbar SHALL 将 secondary actions 收入 More，Tab SHALL 使用 overflow index/Tooltip
- **AND** MUST NOT 缩小 body font、覆盖 close control或产生横向页面滚动

### Requirement: Provider title 与用户数据 SHALL 不被误翻译
Resource title、branch、worktree、commit message、terminal title、agent name 和 owner summary SHALL 作为安全数据展示。Client MUST NOT 将这些值当 translation key，也不得因 locale switch 修改其 identity 或排序，除非用户显式选择 locale-aware sort。

#### Scenario: 文件名与翻译 key 相同
- **WHEN** 文件名恰好为 `pane.close`
- **THEN** Explorer SHALL 显示原文件名
- **AND** SHALL NOT 将其替换为“关闭面板”或其他翻译文本

### Requirement: Locale unavailable SHALL 诚实降级
如果 DSH LocaleRuntime 不存在，Pane Workbench SHALL 使用内置 English fallback 与现有 descriptor labels，并暴露可诊断 capability 状态。它 MUST NOT 崩溃、渲染空 controls 或自行根据浏览器语言写入持久化偏好。

#### Scenario: 旧 DSH host 无 locale service
- **WHEN** Pane bundle 在缺少 locale service 的兼容 host 上加载
- **THEN** Workbench SHALL 继续以 English fallback 工作并记录 locale capability unavailable
- **AND** 所有 reducer、provider 和 action contracts SHALL 保持可用

### Requirement: Pane 中心 SHALL 使用自然中文并安全解析内置 provider 标签
中文 locale 下固定 UI copy SHALL 使用“窗格、标签页、智能体、右侧、底部、所有者”等自然中文。Pane launcher SHALL 在本地 registration 声明 `paneWorkbench` namespace 和 `labelKey` 时显示翻译；已打开/历史实例只有在其 title 等于 descriptor fallback label 时才可使用同一翻译。资源标题、用户分组、Host 标题和技术 kind/owner id MUST 保持原值。

#### Scenario: Agents provider 使用默认标签
- **WHEN** `subagent.monitor` 本地 registration 声明 `rail.agents` 且实例标题仍是 fallback `Agents`
- **THEN** 中文 Pane 中心显示“智能体”，英文显示“Agents”，kind 与 canonical view identity 不变

#### Scenario: 文件标题与 provider label 不同
- **WHEN** 一个 file preview 实例标题为用户文件名且 registration 有 labelKey
- **THEN** Pane 中心继续显示原文件名，MUST NOT 用 provider 翻译覆盖用户数据

### Requirement: Pane 中心状态与区域 SHALL 本地化且保留安全 fallback
管理行、详情字段、筛选选项与搜索状态 SHALL 通过 `state.*`、`region.*` 和 management locale key 显示。未知 status、owner id、kind 或 Host reason SHALL 保留有界 fallback 文本，MUST NOT 显示空值或 raw exception object。

#### Scenario: 中文行包含 pinned 与 stale
- **WHEN** active locale 为 zh 且条目 status tokens 包含 pinned、stale
- **THEN** 行与详情显示对应中文状态，region filter 显示“右侧/底部”，底层 token 与筛选值仍保持英文稳定标识
