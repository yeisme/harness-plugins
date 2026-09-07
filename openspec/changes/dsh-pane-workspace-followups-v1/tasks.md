# 实施与验收任务

由 scripts/openspec-tasks.py 维护状态。

- [ ] 1.1 设计并验证目录 owner watch 与 gap reconcile
- [ ] 1.2 实现 opaque 文件引用恢复和 dirty 冲突路径
- [x] 1.3 补齐目录上下文菜单与键盘焦点恢复 | evidence: 原生上下文菜单、行绑定、generation防迟到、取消/确认回焦通过；独立32项Explorer测试+原生菜单5项及完整视觉106项通过。证据见design.md；无真实文件mutation。
- [x] 1.4 验证布局模板和跨项目恢复场景 | evidence: 真实controller 10项（两/三栏混合项目、重复恢复去重、会话身份、序列化重建、同步/异步dirty guard、过期许可）：temp/integration-test-runs/preset-continuity-strengthened-20260907T105132133690Z/（补丁包upstream-prs/pane-preset-continuity-tests）。renderer缺口已补：真实 SemanticFileEditor 双 Pane 未保存正文挂载期独立、重挂载（布局恢复）不串绑定不跨 Pane 泄漏草稿、保存只落本 entry（editor.spec.tsx 5/5；证据 temp/integration-test-runs/editor-renderer-independence-2026-09-07T16-52-07-199Z-263447/）。未保存正文不跨重挂载持久化=既有产品语义（component-local draft），测试如实断言不伪造恢复。
