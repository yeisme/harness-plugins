# Workflow explicit compensation 执行基线

## 1. 结论

截至 2026-07-29，R4 `7.2` 已在既有 deterministic reverse-DAG planner之上实现explicit compensation执行服务。每个plan item独立绑定definition/plan digest、operation/schema digest、authority policy、cost approval、input digest、idempotency与receipt/reconcile truth；服务不推断通用rollback，也不修改原mutation的成功事实或receipt。

R1/R2真实authority、approval与Owner adapter handoff完成前，production compensation capability仍须保持 `needs_contract`。当前基线冻结consumer-side contract、durable intent与no-double语义，不用fixture结果声明真实Owner补偿成功。

## 2. Explicit linkage 与 ready gate

执行请求必须携带完整 `CompensationPlan`、目标 `compensation_ref` 与当前item states。服务调用domain `AssessCompensationPlan`：

- 目标必须显式存在于plan，且处于reverse-DAG ready集合；
- dependency未成功、plan reconciling或failed时不得越序执行；
- `source_run_ref` 与 `compensation_run_ref` 必须不同，禁止递归补偿run；
- plan digest、definition checksum、operation registry/schema digest继续由domain validator固定；
- 任意不存在的operation/item、scope expansion或plan drift fail closed。

## 3. 独立 authority、approval 与 identity

首次创建intent前依次执行fresh authority与approval revalidation：

- authority绑定tenant、source/compensation Run、compensation ref、operation与authority policy/version；
- approval绑定compensation ref、approval safe ref/digest与cost policy；
- deny/revoke/stale/digest mismatch时零intent、零gateway；
- 补偿idempotency由tenant、compensation Run、plan digest与compensation ref派生，不复用原mutation idempotency；
- intent同时绑定input digest、authority version、approval digest、operation digest与original receipt safe ref，任一drift返回conflict。

## 4. Receipt 与 reconcile truth

- gateway accepted只进入 `reconciling`，不会直接标记succeeded；
- rejected进入failed，并由plan assessment收敛为needs_intervention；
- timeout、unknown、invalid ref或send后commit uncertainty进入reconciling；
- restart先读取既有intent，只调用receipt reconciler，不重复dispatch；
- succeeded必须同时具有safe receipt与evidence ref；invalid terminal result继续reconciling；
- authority在首次发送后撤销不阻断既有intent收敛truth，但不能创建新的compensation intent。

原mutation receipt只作为只读safe linkage传给adapter；服务没有修改原Run、原Step、原receipt或原operation outcome的接口。

## 5. 故障矩阵

测试覆盖：

- accepted后receipt success与restart零重复dispatch；
- authority revoked与approval denied零intent/零gateway；
- unknown与send后commit failure只reconcile；
- explicit item不存在、recursive run、input identity drift拒绝；
- gateway rejected、receipt failure与plan intervention语义；
- reverse-DAG planner的dependency、digest、policy、schema与authority revoked矩阵。

## 6. 验证与证据

可重复命令：

```bash
task workflow:compensation-execution:test
CGO_ENABLED=0 go test ./service/internal/workflows/compensation
task test:workflow-component SCENARIO=workflow-compensation-execution
```

Component evidence：

```text
temp/integration-test-runs/20260729033650-3ce6b710-1e5e-4680-8a1b-08f7b43d71ce/
status=passed
exit_code=0
redaction=enabled
total_redactions=0
```

证据包含service/domain tests、race detector、`go vet`与标准六件套/digest/redaction gate。首次生成的 `20260729033624-258e6f2f-cdd7-429d-a225-abbff63ffd9a` 因测试名过滤未覆盖新service tests而不作为验收证据；Taskfile已移除错误过滤并重新执行。

## 7. 后续边界

- `0.1b/0.1c`：注入真实service identity、approval与Owner receipt/status/reconcile adapter。
- `7.3`：operator只能reconcile/requeue明确failed-before-send item，不得force compensation success或删除原receipt。
- `7.4`：真实canary必须证明original truth保留、补偿unknown零重复dispatch与部分失败intervention。
