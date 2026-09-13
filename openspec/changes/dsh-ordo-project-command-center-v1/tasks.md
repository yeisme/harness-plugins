# 实施任务

- [x] 1. 固化 Pane/Tab/Host 投影与旧入口兼容合同。Owner: 本子项目；Dependencies: none；Acceptance: 实际行为与新增合同一致，未完成的真实运行不得由模拟证据代替；Verification: `openspec validate dsh-ordo-project-command-center-v1 --strict --no-interactive`；Expected: exit 0；Failure recheck: 区分本改动、既有问题与环境原因，保留原始失败证据。
- [x] 2. 实现异步项目 Host 接入和项目指挥四视图。Owner: 本子项目；Dependencies: 1；Acceptance: 实际行为与新增合同一致，未完成的真实运行不得由模拟证据代替；Verification: `pnpm --filter @yeisme/dsh-ordo-agent-ops test`；Expected: exit 0；Failure recheck: 区分本改动、既有问题与环境原因，保留原始失败证据。
- [x] 3. 实现固定会话 Agents Tab、并排查看和跟进隔离。Owner: 本子项目；Dependencies: 2；Acceptance: 实际行为与新增合同一致，未完成的真实运行不得由模拟证据代替；Verification: `pnpm --filter @yeisme/dsh-client-ui-pane-subagent test`；Expected: exit 0；Failure recheck: 区分本改动、既有问题与环境原因，保留原始失败证据。
- [x] 4. 实现结构化计划修改、回执与重开恢复。Owner: 本子项目；Dependencies: 3；Acceptance: 实际行为与新增合同一致，未完成的真实运行不得由模拟证据代替；Verification: `pnpm --filter @yeisme/dsh-ordo-agent-ops test`；Expected: exit 0；Failure recheck: 区分本改动、既有问题与环境原因，保留原始失败证据。
- [ ] 5. 完成跨 owner 集成、视觉与全局质量门。Owner: 本子项目；Dependencies: 4；Acceptance: 实际行为与新增合同一致，未完成的真实运行不得由模拟证据代替；Verification: `node scripts/run-project-ops-integration.mjs`；Expected: exit 0；Failure recheck: 区分本改动、既有问题与环境原因，保留原始失败证据。
- [ ] 6. 完成兼容 DSH 中三个场景的真实 Agent 闭环与双栏验收。Owner: 本子项目；Dependencies: 5；Acceptance: 实际行为与新增合同一致，未完成的真实运行不得由模拟证据代替；Verification: `pnpm dsh:workbench -- --check`；Expected: exit 0；Failure recheck: 区分本改动、既有问题与环境原因，保留原始失败证据。
