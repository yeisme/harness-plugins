## ADDED Requirements

### Requirement: Tab strip SHALL 区分 pinned 与 working segments
每个 Pane group SHALL 按 pinned segment、normal/preview segment、overflow index 和 group actions 组织 Tab。Pinned Tab SHALL 保持在 segment 前部并可排序；clean preview SHALL 可被同 group 下一次 preview 替换。

#### Scenario: Pinned 与 preview 并存
- **WHEN** group 已有两个 pinned Tabs，用户连续预览文件 A 和 B
- **THEN** pinned Tabs SHALL 保持顺序，B SHALL 替换 A 的 clean preview
- **AND** Tab strip SHALL 不产生无界新 Tabs

### Requirement: Tab SHALL 以可扫描层级表达状态
Tab SHALL 显示 semantic icon、bounded title、active、focus、preview、pinned、dirty、attention、offline、stale、orphaned/contract mismatch 和 close policy。状态 MUST 使用形状/icon/text/Tooltip/accessible description 组合，MUST NOT 只依赖颜色或动画。

#### Scenario: Orphaned dirty Tab
- **WHEN** provider 卸载且 Tab 同时 dirty
- **THEN** Tab SHALL 同时表达未保存风险和 provider unavailable，并提供恢复/关闭入口
- **AND** active 与 keyboard focus SHALL 仍可区分

### Requirement: Preview SHALL 在产生用户承诺后自动固定
双击、Enter、显式 Pin、编辑、dirty、owner 声明不可替换或被另一个 view引用 SHALL 将 preview 转为 pinned。转换 SHALL 保留 view id、resource ref、selection 和 component state。

#### Scenario: 编辑 preview
- **WHEN** clean preview 首次产生 dirty state
- **THEN** Tab SHALL 原位转为 pinned/dirty，并允许新资源使用 preview slot
- **AND** 当前 renderer MUST NOT 因转换而重建

### Requirement: Close SHALL 是独立且可聚焦的 action
Close control SHALL 与 `role=tab` 分离，支持 pointer、keyboard 和 menu。Dirty、confirm 或 deny close SHALL 先调用 owner preflight；失败或取消 MUST 保留 Tab、active state 和 group layout。

#### Scenario: 关闭 dirty Tab
- **WHEN** 用户激活 Close 且 owner 返回 confirm
- **THEN** Workbench SHALL 展示本地化 confirmation 与 owner-authored actions
- **AND** 未确认前 MUST NOT 移除 Tab 或清空 dirty state

### Requirement: Duplicate resource SHALL 默认复用现有 Tab
同 owner/ref/version 的 open request SHALL 激活现有 Tab；资源 version 改变时 SHALL 按 provider policy更新、标记 stale 或打开 compare。只有显式 duplicate request SHALL 创建第二个实例，并必须给出可区分 title/instance label。

#### Scenario: 从 Explorer 和 Search 打开同一文件
- **WHEN** 两个入口提交相同 owner/ref/version
- **THEN** Workbench SHALL 聚焦同一个 Tab
- **AND** SHALL NOT 因入口不同创建重复 renderer

### Requirement: Tab overflow SHALL 保留活动、固定和高风险 Tabs
当可用宽度不足时，Tab strip SHALL 优先保持 active、pinned、dirty 和 attention Tabs 可达，其余 Tabs SHALL 进入可搜索 More Tabs listbox。隐藏 Tab MUST 保持 keyboard/assistive navigation，并可通过 title、provider、status 搜索。

#### Scenario: 窄 Pane 有 20 个 Tabs
- **WHEN** 仅能完整展示四个 Tabs
- **THEN** active 与 pinned/dirty Tabs SHALL 保持可见或以明确 pinned affordance 可达，其他 Tabs 出现在 More Tabs
- **AND** close/group actions MUST NOT 被 title 覆盖

### Requirement: 大量 Tabs SHALL 使用有界测量与渲染
当 group 达到实现定义的高密度阈值时，Tab strip SHALL 使用窗口化或有界测量，避免为所有不可见 Tabs 持续创建 ResizeObserver、layout measurement 或 expensive renderer。Tab identity、order 和 keyboard navigation SHALL 保持完整。

#### Scenario: 50 个 Tabs
- **WHEN** 用户通过 More Tabs 跳转到末尾资源
- **THEN** selected Tab SHALL 被滚动/投影到可见区域并获得 focus
- **AND** hidden Tabs MUST NOT activate其 view bodies

### Requirement: Bulk close SHALL 预检完整目标集合并原子提交
Close Others、Close to Right、Close Unpinned 和 Close Group SHALL 在 mutation 前收集所有目标 close policy 与 owner preflight。任一 deny、unknown 或 unresolved confirm SHALL 阻止整体提交，除非用户在明确逐项流程中改变目标集合。

#### Scenario: Close Group 包含 deny Tab
- **WHEN** group 中一个 Tab 的 close policy 为 deny
- **THEN** 整体 Close Group SHALL 被拒绝并聚焦阻塞 Tab/原因
- **AND** 其他允许关闭的 Tabs SHALL 不被部分移除

### Requirement: Tab keyboard pattern SHALL 符合可访问导航
Tablist SHALL 支持 ArrowLeft/Right、Home、End、Enter/Space、Delete 或 configured close shortcut、Shift+F10 和 More Tabs。关闭或移动活动 Tab 后，focus SHALL 确定性落到邻近 active Tab、Open View 或邻近 group。

#### Scenario: 关闭最后一个 Tab
- **WHEN** keyboard 用户关闭 group 的最后一个可关闭 Tab
- **THEN** empty group SHALL 根据 layout policy 保留为可用 drop/open target或被 reducer规范化移除
- **AND** focus SHALL 移到 Open View action或邻近 group，不得丢失到 document body

### Requirement: Tab visual dimensions SHALL 适配桌面、Bottom 与触摸
桌面 Tab title target SHALL 使用约 88px minimum、136px preferred、220px maximum；Bottom 浅高度 MAY 使用 32px compact strip；coarse pointer target MUST 不低于 44px。长 title SHALL 省略但通过 Tooltip/accessible name 提供完整文本。

#### Scenario: 390px Sheet 的长中文标题
- **WHEN** active Tab title 超过可用宽度
- **THEN** title SHALL 省略且完整 accessible name可用，More Tabs与Close仍可操作
- **AND** 页面 MUST NOT 横向溢出或缩小正文至不可读尺寸

### Requirement: Tab copy 与状态 announcement SHALL 本地化
Tab status、close/bulk actions、overflow、move、pin/preview、orphan recovery 和 focus announcements SHALL 使用 `paneWorkbench` locale namespace。Resource title SHALL 按安全原文显示。

#### Scenario: 中文关闭活动 Tab
- **WHEN** active locale 为中文且用户关闭一个 clean Tab
- **THEN** Close label、Tooltip、result announcement 和下一个 focus target说明 SHALL 使用中文
- **AND** resource title SHALL 不被翻译或改写
