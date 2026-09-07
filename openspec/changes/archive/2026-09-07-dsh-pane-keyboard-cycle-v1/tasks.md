# 实施与验收任务

由 scripts/openspec-tasks.py 维护状态。

- [x] 1.1 实现 macOS 前缀与多 Pane 循环 | evidence: 52 项宿主测试通过；1/3/8/32 Pane 正反循环及浮动几何保持。
- [x] 1.2 完成宿主测试、真实浏览器和增量补丁验证 | evidence: 真实浏览器：temp/integration-test-runs/pane-interactions-2026-09-07T06-29-47-135Z/；五段补丁逐字重建与幂等：temp/integration-test-runs/workbench-patches-2026-09-07T06-31-07-175Z/；视觉 92 项、运行时 10 项、类型检查与构建通过。
- [x] 1.3 更新按键文档并提交存档 | evidence: docs/design/dsh-pane-interaction-completion.md 与 docs/delivery/dsh-pane-keyboard-cycle-2026-09-07.md 已同步；补丁和本地提交归属 harness-plugins。
