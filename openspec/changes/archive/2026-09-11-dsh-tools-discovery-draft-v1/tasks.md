# 实施与验收任务

由 scripts/openspec-tasks.py 维护状态。

- [x] 1.1 记录现状、布局复现、UI Contract和增量兼容设计。 | evidence: UI Contract及严格校验通过；tools-pane-layout-2026-09-11T06-10-09-049Z复现手柄残留，06-11-04-101Z修复后通过；全仓OpenSpec校验通过。
- [x] 2.1 实现工具页内容布局隔离、用途发现、范围和真实状态。 | evidence: 用途元数据和显式范围已实现；13+79相关测试及8项浏览器用例通过。
- [x] 2.2 实现显式绑定会话的引用构造、去重、草稿保护与回执交接。 | evidence: tools-discovery-host-2026-09-11T07-34-29-061Z：真实Host两项引用、去重、A/B草稿隔离、零模型请求通过。
- [x] 2.3 实现响应式列表详情、键盘焦点、设置衔接和恢复。 | evidence: ui-visual-2026-09-11T07-31-43-290Z-2000947：8/8；包括短容器、多实例焦点、范围及过期恢复。
- [x] 3.1 相关包和Host合同测试覆盖成功、失败、过期及A/B迟到回执。 | evidence: tools-discovery-focused-surfaces-plugins-openspec-layout-patches-2026-09-11T07-32-50-936Z：13+79+10项通过；独立审查修复复核通过。
- [x] 3.2 浏览器验证360/560/960及矮容器、调宽命中、真实Host草稿和无自动执行。 | evidence: 8项浏览器组件用例、原版布局负对照和真实Host A/B用例均通过；见verification.md。
- [x] 3.3 稳定后运行typecheck、surfaces、plugins、visual与OpenSpec校验并分类失败。 | evidence: 相关工具包、surface、plugins、OpenSpec及8项新视觉通过；全仓typecheck和134/170视觉结果已执行并按既有/在途失败分类，见verification.md。
- [x] 4.1 更新设计与交付证据，区分fixture、真实Host和未执行外部业务。 | evidence: 设计、运行时、旧V2说明及verification.md已同步；明确fixture/真实Host/外部业务及全仓门的区别。
