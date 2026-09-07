# Production Taskfile T0 合同基线

## 1. 已实现范围

R5 `3.4a` 已实现生产 Taskfile 的公共 fail-safe guard：

- `scripts/production-task-contract.ts`：纯参数校验和统一输出 projection；不读credential、不连接依赖、不写release state。
- `Taskfile.yml`内部目标`production:guard`：未来build/deploy/release/tenant目标通过依赖调用，统一传递operation、environment、effect、dry-run、run id和approval receipt。
- `task taskfile:production-contract:test`：执行真实Taskfile guard和Bun合同测试。
- `tests/production-task-contract.test.ts`：覆盖环境、dry-run、approval、opaque ref、redaction、JSON/agent、help和退出码。

## 2. 输入合同

| Input | 规则 |
| --- | --- |
| operation | 必须是`domain:action`形式的namespaced Taskfile目标 |
| environment | 必须显式为`integration/staging/canary/production`，没有production默认值 |
| effect | `read/plan/write` |
| dry-run | 只接受`1/0/true/false`；Taskfile默认`1` |
| run id | 可选opaque id，不接受路径分隔符 |
| approval receipt | non-dry-run write必需；只接受opaque形状且输出不回显值 |
| refs | repeatable `name=value`；拒绝URL/path/credential/secret语义和值 |

Approval receipt在T0只做存在性和安全形状校验，不证明批准身份、scope、expiry、manifest digest或防重放。真实权威验证属于R5 `3.3` release state machine和`3.4d` release CLI；任何生产目标在此之前仍只能dry-run。

## 3. 输出与退出码

- default summary：简短英文`Status/Summary/Reason/Recommended next step`。
- `--json`：`spec_version=1.0`、`command=production.task.validate`的标准AI-native envelope。
- `--agent`：稳定ASCII `key=value`。
- `--explain`：redacted conclusion/evidence/risk/confidence/next action，不含内部推理。
- validator exit `0`：调用合同满足；不表示业务依赖、release readiness或批准本身有效。
- validator exit `2`：invalid input。
- validator exit `3`：approval required。
- `go-task`可能将子进程非零exit映射为Task自身非零code；Taskfile只承诺不吞错。需要精确domain code的automation直接调用validator `--json/--agent`。

T0不提供`--events`，因为guard是同步纯校验；后续soak/canary/incident长任务由真实release CLI和evidence runner提供NDJSON事件。

## 4. 安全不变量

1. validator不输出approval receipt或opaque ref值。
2. invalid input错误只返回field和稳定reason，不回显拒绝值。
3. `CONFIRM=1`不是输入，也不能替代external approval receipt。
4. Taskfile只包装validator，不解析human output写状态。
5. validator success不能让managed依赖缺失、fixture/local fallback或capability gap变为ready。
6. 所有真实write仍需后续release CLI验证批准权威并由外部系统执行。

## 5. 验证证据

```text
task taskfile:production-contract:test
bun run typecheck
python3 /workspaces/yeisme-agent/.agents/skills/ai-native-cli-output-contract/scripts/validate_cli_output.py --mode json
python3 /workspaces/yeisme-agent/.agents/skills/ai-native-cli-output-contract/scripts/validate_cli_output.py --mode agent
```

最新component evidence：`temp/integration-test-runs/20260720160748-56768834-096f-4391-9313-8d15e5b9c674/`，包含六件套、12个guard合同测试、production ops测试、Go checker和redaction检查。

## 6. 未完成边界

- T1a `3.4b1`已完成，见`production-config-doctor-baseline.md`。
- T1a与T1b-a已完成；T1b-b、T1c-T1e仍需完整worker/clean builder、container、supply-chain和artifact scan。
- T2 `3.4c`：managed PostgreSQL、backup/restore/migration/deploy目标。
- T3 `3.4d`：manifest/readiness/handoff/promotion/canary/audit真实CLI与权威approval验证。
- T4 `3.4e`：incident/diagnostics/runbook/docs parity。

因此当前仍是生产Taskfile的安全调用基线，不是production readiness、canary或GA完成证明。
