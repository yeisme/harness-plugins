# 实施与验收任务

由 scripts/openspec-tasks.py 维护状态。

- [x] 1.1 统一开发启动与兼容性检查 | evidence: scripts/workbench-runtime.spec.mjs; temp/integration-test-runs/2026-09-07T04-13-36-142Z-2166512/summary.json
- [x] 1.2 移除 Target 冗余展示并验证引用选择行为 | evidence: ui-conversation 41 tests; focused tsc and bundle; temp/integration-test-runs/workbench-cleanup-2026-09-07T04-13-33-289Z/summary.json
- [x] 1.3 导出可应用宿主补丁与浏览器回归证据 | evidence: upstream-prs/workbench-runtime-cleanup; clean patch-chain reconstruction; docs/delivery/dsh-workbench-runtime-cleanup-2026-09-07.md
- [x] 1.4 更新技能和文档，清理旧入口并本地 Git 存档 | evidence: Skills commit da4df78; docs/runtime/dsh-workbench.md; npm local link; user-level recoverable installation archive
