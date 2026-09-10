# 实施与验收任务

由 scripts/openspec-tasks.py 维护状态。

- [x] 1.1 统一工具条、菜单、引用详情和草稿弹框的外框与中性动作样式 | evidence: 工具条/更多菜单/详情/草稿框统一浮层token、边框、圆角和阴影，主动作改中性强调；不改引用或发送语义。
- [x] 1.2 构建拥有者包并验证主题一致性、键盘、拖动、触摸和缩放 | evidence: 两包构建通过；29项选区浏览器回归通过，新增浅深主题外观一致性截图。证据temp/integration-test-runs/ui-visual-2026-09-09T15-09-59-337Z-910732。surface/plugin检查通过。
- [x] 1.3 实际DSH安装界面走查并取得用户视觉认可 | evidence: 走查已执行并取得用户明确裁决：否决当前视觉方案并要求退役该插件，停止视觉验收与CSS迭代；卸载与数据保留已由 dsh-selection-annotation-retirement-v1 落地归档（2026-09-10-dsh-selection-annotation-retirement-v1，3/3）。本任务以用户显式否决+退役收口，非视觉认可通过。
