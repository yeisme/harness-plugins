## 1. 合同与兼容

- [x] 1.1 新增 Git status/diff/mutation/history/compare/stash/tag additive capability 类型、opaque ref 校验与 probe
- [x] 1.2 新增 Ordo Git review evidence safe projection、readiness、cursor gap 与 lease 不变量
- [x] 1.3 补齐 V1 fallback、任意 argv 拒绝、timeout reconcile 和 additive public API 合同测试

## 2. Changes 审查闭环

- [x] 2.1 实现 repository/worktree 自动发现/选择、分页分组、低信号折叠和 stale/offline 状态
- [x] 2.2 实现 diff layout、hunk reviewed、revision drift、feedback、secret-risk 和键盘导航
- [x] 2.3 实现 batch stage/unstage、24 小时 discard backup/Undo、commit preflight 与 readiness/override UI

## 3. 多视图工作台

- [x] 3.1 实现 risk-first Review Queue 与 capability-driven 默认视图
- [x] 3.2 实现 DSH adapter 侧 Worktree/Agent、Pause/Resume、lease blocker 与独立 owner receipt 边界
- [x] 3.3 实现 History/Graph/Compare Inspector 和安全 workspace persistence
- [x] 3.4 实现 Branch/Remote/Stash/Tag capability-gated 视图与明确 unavailable fallback
- [ ] 3.5 [Owner: agent/ordo / Git owner] 发布真实 Agent launch 双 receipt 与 Branch/Remote/Stash/Tag 完整 action transport；本仓不得伪造 owner state

## 4. 响应式、无障碍与性能

- [x] 4.1 实现 28px/44px 密度、窄屏 View Selector、Inspector Sheet 和三主题语义 token
- [x] 4.2 实现快捷键 registry 冲突检测与 Git 默认 binding
- [x] 4.3 添加 10k files、1M commits、2k queue 项 owner window/浏览器有界渲染测试

## 5. 验证与证据

- [x] 5.1 补齐 unit/contract/component tests，以及 disposable Git owner flow 与受控 Ordo projection 闭环
- [x] 5.2 使用项目 runner 生成 `temp/integration-test-runs/<run-id>/` 脱敏证据
- [x] 5.3 运行聚焦 test、typecheck、build/motion/OpenSpec validation 并分类非 introduced failure
- [x] 5.4 更新 verification evidence、兼容性 verdict、回滚说明与 owner handoff 状态
