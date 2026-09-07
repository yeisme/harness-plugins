# Workflow Definition Lifecycle 实施基线

## 1. 完成范围

截至 2026-07-20，R4 `1.4b` 已实现 Definition lifecycle 与 canonical checksum：

- draft version 从正整数开始，publish 要求 expected version 一致；
- published/deprecated version 通过 checksum 重算检测内容篡改；
- publish 不改变 content/version/checksum，只改变 lifecycle state；
- published/deprecated 可派生 `version+1` 新 draft，原对象与嵌套 slice 不被共享修改；
- deprecate 不改 definition version/checksum，只阻断未来 service start；
- checksum 包含 identity、version、registry digest、schemas、typed steps/bindings/edges/capability/scope；
- step、binding、edge、capability、scope 的 collection order canonicalized，transport/map iteration 不造成 digest drift；
- state 不进入 checksum，因此 publish/deprecate 不伪造新的内容版本。

## 2. 验证

```bash
task workflow:domain-lifecycle:test
task test:workflow-domain-lifecycle:component
```

Component evidence：

```text
temp/integration-test-runs/20260720184341-92e345cf-0321-40f9-9cc9-83c59605b4b0/
status=passed
exit_code=0
redaction=enabled
evidence_scan=clean
```

## 3. 未完成边界

- resource CAS revision、audit refs、definition command replay 与 start idempotency 已由 `5.3` service/store contract 绑定；domain definition version 仍不是数据库 row revision，真实 GORM/transport binding 由 `1.5b` 完成。
- `1.4c-1.4e` Run/Step/Attempt/policy state machine 仍待实现。
- release manifest 与 run start 必须继续固定 definition checksum、step registry digest 与 contract version。
