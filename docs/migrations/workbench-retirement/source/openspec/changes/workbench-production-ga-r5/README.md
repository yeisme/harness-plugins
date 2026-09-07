# workbench-production-ga-r5

为 Workbench 建立可复现构建、环境晋级、SLO/error budget、backup/restore、migration/rollback、供应链、安全、runbook、canary 与 GA closeout 合同。

执行级入口：

- `details/cross-release-integration-delivery-dag.md`：R0-R5与Provider/Consumer交接、并行lane和失败回退。
- `details/production-execution-work-packages.md`：将demo到production拆成可独立领取、验证、回退的WP执行包，并定义首三个执行周期和后续Owner扩展顺序。
- `details/production-taskfile-target-contract.md`：生产Taskfile目标、参数、安全默认值和实现波次。
- `details/production-taskfile-contract-baseline.md`：已实现的T0 guard、输出/退出码、component evidence与未完成边界。
- `details/production-config-doctor-baseline.md`：已实现的T1a doctor、managed config组合校验、工具缺口和component evidence。
- `details/production-reproducible-build-baseline.md`：已实现的T1b-a双构建digest、dirty/worker阻塞与approved builder待办。
- `details/release-handoff-readiness-baseline.md`：已实现的T3-a/T3-b2a纯Go requirement/handoff/manifest structured-state CLI、Workbench test-evidence authority/freshness/tamper门禁、Taskfile入口、输出/退出码和component evidence。
- `details/first-production-tenant-cutover-plan.md`：首租户从shadow/read-only到limited-write/Daily/Workflow canary的逐级cutover。
