# Agent CLI Pane V1 — Host Runtime 决策（Task 0.3）

> 决策时间：2026-08-23。Owner: architect/root integrator。决策依据：design 决策 6（argv 执行 + 闭合资源策略）、§337 open question、`details/command-inventory.md`（Slice C canary 只读特性）、R4 worker/sidecar 运行时先例（`service/cmd/workbench-worker` 独立 pure-Go 进程 + readiness/drain 模式）。

## 1. 决策

**首批 production Host Runtime = 同机（workbenchd 主机）pure-Go sidecar 进程**，随后可用企业 runner provider adapter 替换；两者必须实现同一 hostSession/receipt/reconcile contract。理由：

1. **依赖零增量**：Go stdlib `exec.CommandContext` + `os/exec` process group 即可满足 argv 执行、cancel deadline、orphan cleanup；无 cgo、无 Rust、无新运行时依赖（与 0.4 证明一致）。
2. **先例一致**：`workbench-worker` 已示范同机独立 pure-Go 进程的 readiness/heartbeat/drain/shutdown 生命周期（R4 5.0b2 系列）；Host sidecar 复用同一运维词汇（health ≠ dependency readiness、SIGTERM drain、shutdown receipt）。
3. **canary 风险最低**：Slice C 三个 canary（diagnostics/config-check/readiness）全部只读、本地、无 credential；同机 sidecar 即可产生真实 argv/event/result/receipt 证据，不需要企业 runner 的网络/租户隔离面。
4. **provider 是替换而非分叉**：合同先冻结（下文 §2），企业 runner（远程池、per-tenant VM、future sandbox）作为 `clihost.Provider` interface 的第二实现，不改变 Workbench 侧 adapter。

**明确拒绝**：浏览器/Workbench UI 内执行（进程/文件真相不得归入 browser 或 Workbench UI）；provider 无法证明 isolation/receipt 时不进入 Slice C（fail-closed，不降级为本地 spawn 冒充）。

## 2. 冻结的 Host contract

| 面 | 冻结内容 |
| --- | --- |
| Handshake | sidecar 启动时自注册：`{hostVersion, supportedBindingDigests, capabilityFlags, protocolVersion}`；workbenchd 校验 binding digest 与 descriptor revision 匹配后进入 ready。unknown/unregistered binding 一律拒绝 dispatch。 |
| `hostSessionRef` | stable opaque ref `{tenantRef, workspaceRef, sessionRef, hostInstance, epoch}`；同 session/scope 复用；不泄漏文件系统路径。 |
| Dispatch | 输入只有 prepared intent ref + server-private binding（executable、固定 argv 前缀、typed args、allowlist env keys、resource ceiling）；**无 client executable/cwd/env/stdin/PTY/command string**。`exec.CommandContext(executable, argv...)`；shell metacharacter 保持单一 argv，无 expansion/pipe/redirection/substitution。 |
| Receipt / lookup / reconcile | 每次 dispatch 生成 durable receipt（request digest、argv digest、exit disposition、output digest、artifact refs）；`unknown_accept` 只 lookup 原 operation（request digest 匹配），reconcile 不 spawn 第二进程；cancel acknowledgement 区分 `cancel_requested` 与真实 `cancelled`（process exit race 显式建模）。 |
| Health | liveness（进程）≠ readiness（binding 注册 + allowlist 二进制存在 + resource 预算可用 + 依赖探针）；任一失败 `ready=false` 且零 dispatch。 |
| Mount / workspace | opaque mount ref 由 Host 解析到 allowlist 目录；cwd 只能来自 binding，客户端不可指定。 |
| Env / secret | 环境变量 allowlist keys only；secret ref 从批准 secret store 解析，注入后不回传、不入日志/evidence；Host 继承环境必须显式测试（4.4）。 |
| Network | canary 阶段默认 `network=loopback-only` policy；出网策略由 binding 声明，未声明即拒绝。 |
| Resource ceiling | duration、output bytes、CPU、memory、process count、并发 ceiling 全部由 binding 声明且客户端不可放宽；timeout 终止整个 process group。 |
| Diagnostics | 结构化 JSON stderr/file sink；CLI protocol stdout 干净（机器输出 only）。 |
| 升级 / 回滚 | sidecar 独立升级（hostVersion + bindingDigest 兼容矩阵）；kill switch = canary binding flag off → 停新 dispatch，inflight 走 drain，receipt/lookup/reconcile 保留可读。 |

## 3. Workbench adapter 边界

- Workbench 侧只持 `clihost.Provider` interface（dispatch/cancel/lookup/readiness），不 import sidecar 内部包；sidecar 不连业务 DB、不持 Owner credential、不复用 human session。
- 浏览器与 Agent 永远只看到 `CommandDescriptorV1` safe projection 与 prepared intent ref；Host endpoint/token 不进入 browser bundle（6.3 的 BFF 边界）。

## 4. 验证

- `openspec validate workbench-agent-cli-pane-v1 --strict --no-interactive` PASS（见 tasks.md 0.3 evidence）。
- 后续实现任务按合同顺序验证：4.2（sidecar 生命周期）→ 4.3（argv encoder 注入负向）→ 4.4（policy/timeout/secret sentinel）→ 4.5（cancel/reconcile race）→ 4.6（canary binding，默认 off）。
