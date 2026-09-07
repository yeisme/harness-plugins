# Workbench Production Incident Runbook

本手册定义 Workbench P0/P1 事件的最小响应合同。它只引用 canonical Taskfile target；target 当前为 `planned`、`provider_blocked` 或 `diagnostic_only` 时，操作员必须保持对应动作 blocked，不得用临时 shell、截图、Pod health 或人工修改状态替代 authority。

## 执行规则

1. 先执行 detect target 并保存原始 exit code 与脱敏 evidence。
2. containment 只停止扩大影响，不删除 receipt、lease、cursor、deployment truth 或 audit truth。
3. recovery 必须处理原 operation/receipt；响应丢失时先 lookup/reconcile，禁止创建第二次 apply。
4. `planned`、`provider_blocked` 与 `diagnostic_only` 均不表示 production authority。
5. 任何 production write 仍需外部批准、managed trust 与批准平台生成的 signed receipt。

## P0/P1 事件矩阵

| Incident | Severity | Owner | Detect target | Containment target | Recovery target | Current gate |
| --- | --- | --- | --- | --- | --- | --- |
| INC-CONFIG | P1 | owner:workbench-config | `release:readiness` | `deploy:validate` | `release:rollback:dry-run` | `planned` |
| INC-DATABASE | P0 | owner:database-operations | `db:backup` | `db:restore:verify` | `disaster-recovery:drill` | `provider_blocked` |
| INC-DEPLOYMENT | P0 | owner:deployment-operations | `deployment:lookup` | `deployment:receipt:validate` | `release:rollback:dry-run` | `planned` |
| INC-IDENTITY | P0 | owner:identity-operations | `tenant:cutover:plan` | `release:handoff:validate` | `release:rollback:dry-run` | `planned` |
| INC-RELEASE | P1 | owner:release-operations | `release:audit` | `release:manifest:validate` | `release:decision:validate` | `planned` |
| INC-WORKFLOW | P0 | owner:workflow-operations | `test:workflow-system` | `release:canary` | `release:rollback:dry-run` | `planned` |

## 证据与升级

运行手册校验：

```bash
task runbook:validate
```

生成单个事件的只读演练计划：

```bash
task incident:drill ENV=staging INCIDENT=INC-CONFIG
```

该命令只解析本手册与 canonical target registry，输出 detect/contain/recover 顺序、owner、authority、provider dependency 与当前 gate；它不会执行 detect、contain 或 recovery target，也不会创建 incident、调用 paging、修改 release state 或授予 production authority。任一动作仍为 `planned`、`provider_blocked` 或 `diagnostic_only` 时，命令返回 exit 5 并列出 blocker。

查看当前命令权威状态：

```bash
task production-targets:generate TARGET_REGISTRY=temp/release/production-targets.json
task production-targets:validate TARGET_REGISTRY=temp/release/production-targets.json
```

生成命令可能因 planned/provider blocker 返回非零；这是正确门禁。操作员应把 blocker 路由到 registry 中的 owner task 和 provider/consumer dependency，而不是手动改写 registry。

P0 立即升级给 incident commander、对应 owner 与 release operations。P1 在当前 on-call 窗口内升级。Evidence 必须位于 `temp/integration-test-runs/<run-id>/`，保留 `summary.json`、command、stdout/stderr、env、artifacts、digest 与 redaction receipt。

## 回滚

- 配置：回到上一个兼容 profile，保持 deployment blocked，并重新运行 config/readiness validation。
- 数据库：只对 disposable restore target 验证；真实 restore/PITR 必须由 managed PostgreSQL owner 执行并签发 receipt。
- 部署：lookup 原 operation；partial/unknown 不得当作 failed 后重复 apply。
- Identity：停止受影响 capability，保留 revoke/cursor/audit truth，不降级 local identity。
- Release：保留原 manifest、approval、receipt 与 blocker；生成新 candidate，不覆盖旧 truth。
- Workflow：先暂停新 claim/dispatch，保留 lease/fencing/receipt/reconcile；兼容性不明时选择 fix-forward 或继续 blocked。

当前 `incident:drill` 仅提供 available 的 read-only plan。真实 staging detect/contain/recover 执行、paging/incident authority、关闭 receipt 与 production-like 验收仍未完成；本手册和计划器通过不证明 incident response 已完成。
