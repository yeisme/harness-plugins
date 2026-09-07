# Workflow Scheduler Policy / Fairness 合同基线

## 1. 完成范围

截至 2026-07-21，R4 `5.1d` 已完成纯 Go、无 I/O 的 scheduler policy/fairness/capacity 合同：

- `PolicySnapshot`消费已经校验且冻结的current policy facts，不拥有R4 `7.3`的kill store、管理API、审计或传播职责；
- policy decision按固定优先级执行contract/unsupported、snapshot current、global、tenant、definition、capability、Owner、quota、cost检查；
- policy拒绝统一返回`deny_policy`与低基数stable reason，不包含tenant/run/step/Owner ref或底层错误；
- tenant公平采用有界deficit round-robin，descriptor cost class映射为`none/low=1`、`medium=2`、`high=4`；
- tenant内固定按priority、`ready_at_db`、run ref、step run ref排序，跨批次从上次tenant之后轮转；
- `CapacityLimiter`提供global/tenant/Owner三级并发预留与幂等归还，供claimer在数据库claim前调用；
- 单Owner kill或Owner capacity耗尽只影响对应Owner，不阻塞其他Owner候选；
- evaluator、fairness与capacity不访问数据库、网络，不创建goroutine，不写workflow业务状态，也不授予claim authority。

实现路径：

```text
service/internal/scheduler/evaluator.go
service/internal/scheduler/policy.go
service/internal/scheduler/fairness.go
service/internal/scheduler/capacity.go
service/internal/scheduler/*_test.go
```

## 2. Policy Decision 合同

新增kind：

- `deny_policy`：current policy snapshot明确拒绝；
- `deny_transient`：预留给claimer把capacity/readiness等可恢复失败映射为typed decision，当前纯capacity primitive返回stable reason。

新增policy reason：

- `invalid_policy_snapshot`；
- `global_killed`；
- `tenant_killed`；
- `definition_killed`；
- `capability_killed`；
- `owner_killed`；
- `quota_exceeded`；
- `cost_exceeded`。

新增capacity reason：

- `global_capacity_exhausted`；
- `tenant_capacity_exhausted`；
- `owner_capacity_exhausted`；
- `invalid_capacity_scope`。

固定pipeline为：

```text
Candidate contract evaluation
  -> current policy evaluation
  -> deterministic tenant ordering
  -> pre-claim capacity reservation
  -> 5.2b1a PostgreSQL fenced claim
```

`5.2b1a`必须在claim失败、context取消、drain或executor完成后归还reservation，并把capacity reason映射为`deny_transient`；本任务不提前实现claimer产品逻辑。

## 3. 公平与边界

- 单次输入最多`10000`个candidate，单批最多`1024`个；
- duplicate step run、unsafe ref、zero `ready_at_db`、unknown priority和非法state全部fail closed；
- deficit state只保留当前active tenant，输入不得超过`maxFairnessDeficit - fairnessQuantum`，避免下一轮量子累加越界；
- fixed input + fixed state产生相同order与next state，不依赖Go map迭代顺序；
- capacity limit必须为正数、不得超过validated worker `MaxConcurrency`，tenant/Owner limit不得超过global；
- reservation采用mutex和`sync.Once`，并发竞争不得超过任一级上限，重复release无副作用。

## 4. TDD、性能与证据

测试先以缺少policy/fairness/capacity symbols失败，再通过红灯测试补齐duplicate candidate、unknown priority、deficit overflow和并发capacity竞争边界。

验证命令：

```bash
task scheduler:policy:test
task test:scheduler-policy:component
```

1000 candidates / 100 tenants / batch 100基准：

- 初始：约`36.14 ms/op`、`12.27 MB/op`、`43877 allocs/op`；
- snapshot兼容检查改为构造期校验、evaluation期比较不可变contract/digest后：`4.94 ms/op`、`4.24 MB/op`、`19820 allocs/op`；
- 该数值是当前共享CI主机上的防回退基线，不是生产SLO。

Component evidence：

```text
temp/integration-test-runs/20260721160422-b280842e-5c14-4bb6-adb8-cdc8e0feadd5/
status=passed
exit_code=0
directory_mode=0700
file_mode=0600
redaction_scan=clean
```

## 5. 未完成边界

- `5.1b`仍需真实PostgreSQL additive ready queue projection；
- `5.1c`仍需GORM-owned bounded per-tenant candidate query；
- `5.1e`仍需运行中scan freshness/backlog/capability readiness；
- `5.2b1a`仍需把policy/order/capacity合同接入PostgreSQL fenced claim；
- R5仍需candidate-bound claim authority与真实production authorization。

因此当前`production_authorized=false`，没有代码路径扫描数据库、claim workflow step或启动真实scheduler loop。
