# 实施与验收任务

由 scripts/openspec-tasks.py 维护状态。

- [ ] 1.1 设计并验证目录 owner watch 与 gap reconcile
- [ ] 1.2 实现 opaque 文件引用恢复和 dirty 冲突路径
- [x] 1.3 补齐目录上下文菜单与键盘焦点恢复 | evidence: 原生上下文菜单、行绑定、generation防迟到、取消/确认回焦通过；独立32项Explorer测试+原生菜单5项及完整视觉106项通过。证据见design.md；无真实文件mutation。
- [ ] 1.4 验证布局模板和跨项目恢复场景 | evidence: 部分验证：真实controller新增10项通过，补丁包upstream-prs/pane-preset-continuity-tests；temp/integration-test-runs/preset-continuity-strengthened-20260907T105132133690Z/。实际renderer未保存正文独立性仍未验证，保持未完成。
