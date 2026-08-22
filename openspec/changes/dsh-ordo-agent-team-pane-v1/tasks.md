## 1. Owner contract dependency

- [x] 1.1 [Owner: Ordo；Scope: canonical Agent Ops projection/action contract；Dependencies: none] 核对 run/DAG/task/session/attempt/lease/approval/verification/evidence 与 owner-authored actions。验收：timeout 不代表 worker stopped，客户端不可释放 lease。

## 2. DSH 插件实施

- [x] 2.1 [Owner: Harness Plugins；Scope: `packages/bundle/ordo-agent-ops/`；Dependencies: 1.1] 复用既有 Agent Ops Host snapshot/event validation 与 action preview/receipt，不新建第二 Ordo package。验证：`pnpm --filter @yeisme/dsh-ordo-agent-ops run test`。
- [x] 2.2 [Owner: Harness Plugins；Scope: `packages/client/ui-pane-domain/`；Dependencies: 2.1] 用 `ordoSnapshotToDomain` 注册 Ordo Team view；过滤 launch/cancel/redispatch/lease.release，并保留 Ordo/Subagent owner badge。验证：`pnpm --filter @yeisme/dsh-client-ui-pane-domain run test`。
- [x] 2.3 [Owner: Harness Plugins；Scope: `packages/bundle/pane-domain/`；Dependencies: 2.2] 将 Ordo Team Pane 纳入可安装 `@yeisme/dsh-pane-domain` bundle。验证：`pnpm --filter @yeisme/dsh-pane-domain run test`。
- [ ] 2.4 [Owner: Harness Plugins；Scope: Team live projection + deep-link；Dependencies: 2.1, 2.3] 接通 live event/freshness、1,000 task virtualized view 与 Subagent typed deep-link；禁止复制状态树。

## 3. 验证

- [ ] 3.1 [Owner: Harness Plugins；Scope: component/integration evidence；Dependencies: 2.4] 覆盖 DAG/task/session/attempt/lease/approval/evidence、timeout/unknown、closed actions、Subagent deep-link 与 teardown；证据写入 `temp/integration-test-runs/<run-id>/`。
- [ ] 3.2 [Owner: Harness Plugins；Scope: final gates；Dependencies: 3.1] 运行 `pnpm --filter @yeisme/dsh-ordo-agent-ops run test && pnpm --filter @yeisme/dsh-client-ui-pane-domain run typecheck && pnpm --filter @yeisme/dsh-client-ui-pane-domain run test && pnpm --filter @yeisme/dsh-client-ui-pane-domain run build && openspec validate dsh-ordo-agent-team-pane-v1 --strict --no-interactive`。
