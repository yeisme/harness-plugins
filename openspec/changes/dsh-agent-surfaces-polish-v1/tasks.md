# 实施任务

- [x] 1. 固化会话 Subagents 与用户级 Agent Team 的设计和增量 spec。Owner: 本子项目；Dependencies: none；Acceptance: 明确用户工作区、项目与会话三层范围；旧入口保持兼容；Verification: `openspec validate dsh-agent-surfaces-polish-v1 --strict --no-interactive`；Expected: exit 0；Failure recheck: 区分本改动、既有问题与环境原因，保留原始失败证据。
- [x] 2. 实现会话执行树、详情、过滤、键盘与迟到结果隔离。Owner: 本子项目；Dependencies: 1；Acceptance: 单节点详情位于顶部；后代搜索、焦点恢复、迟到反馈和无接口降级通过回归；Verification: `pnpm --filter @yeisme/dsh-client-ui-pane-subagent test`；Expected: exit 0；Failure recheck: 区分本改动、既有问题与环境原因，保留原始失败证据。
- [x] 3. 实现用户项目入口、Team roster 与既有 Ordo 视图和命令兼容。Owner: 本子项目；Dependencies: 2；Acceptance: 无当前聊天可打开注册项目；切换聊天不改变项目；新旧命令复用同一用户入口；Verification: `pnpm --filter @yeisme/dsh-ordo-agent-ops test`；Expected: exit 0；Failure recheck: 区分本改动、既有问题与环境原因，保留原始失败证据。
- [x] 4. 验证实际编译 UI 的三种宽度、英文、焦点、作用域和视觉门。Owner: 本子项目；Dependencies: 3；Acceptance: 360/560/960px 无溢出，单节点长名称、中英、键盘和作用域验证有实际编译 UI 证据；Verification: `node scripts/run-ui-visual-tests.mjs visual-agent-surfaces.spec.ts`；Expected: exit 0；Failure recheck: 区分本改动、既有问题与环境原因，保留原始失败证据。
