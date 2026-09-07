# Workflow Domain Conformance Gate 基线

## 1. 完成范围

截至 2026-07-20，R4 `1.4f` 已建立统一 domain 门禁：

- 运行 Definition/DAG、lifecycle/checksum、Run、Step/Attempt、retry/cancel 与 compensation 全量 unit tests；
- 全包执行 Go vet 与 race tests；
- `FuzzValidateDefinitionBounded` 使用固定 seed 覆盖 unsafe ref、edge endpoint、schema ref、capability 与长度边界，验证 bounded、panic-free 和错误不泄漏输入；
- `FuzzCompensationPlanRejectsRehashedTamper` 覆盖重算摘要后的 operation/policy/dependency/schema/input 篡改，验证 fail-closed；
- fuzz 输入在进入 domain 前限制长度，不创建不受控图或递归遍历。

## 2. 验证

```bash
task workflow:domain:test
task test:workflow-domain:component
```

Component evidence：

```text
temp/integration-test-runs/20260720192037-cf1e6a0b-9609-461e-9b07-96e866497285/
status=passed
exit_code=0
redaction=enabled
evidence_scan=clean
```

本次 fuzz gate 分别完成 75,776 与 96,529 次执行；这些次数属于本地基线，不作为跨机器固定阈值。

## 3. 生产边界

Domain conformance 只证明纯业务合同稳定。`1.5` transport、repository/service、scheduler、worker claim loop、Web designer 与真实 PostgreSQL gate 仍必须独立完成并提供证据。
