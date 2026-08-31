## MODIFIED Requirements

### Requirement: Locale unavailable SHALL 诚实降级
如果 DSH LocaleRuntime 不存在，Pane Workbench SHALL 将浏览器 language base 作为仅当前页面的临时展示 locale；浏览器语言不受支持或无 window 时 SHALL 使用内置 English fallback 与现有 descriptor labels。该 fallback MUST NOT 写入持久化偏好，也 MUST NOT 崩溃、渲染空 controls 或改变 reducer、provider 与 action contracts。

#### Scenario: 旧 DSH host 无 locale service
- **WHEN** Pane bundle 在缺少 locale service、浏览器语言为 zh-CN 的兼容 host 上加载
- **THEN** Workbench SHALL 以中文临时展示，且不写 locale preference；页面刷新或后续 Host LocaleRuntime 接管时按实时 locale 重算 presentation

#### Scenario: SSR 或不支持的浏览器语言
- **WHEN** 没有 window 或浏览器 language base 不在内置词典中
- **THEN** Workbench SHALL 使用 English fallback 和 descriptor labels，所有 reducer、provider 与 action contracts 保持可用

## ADDED Requirements

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
