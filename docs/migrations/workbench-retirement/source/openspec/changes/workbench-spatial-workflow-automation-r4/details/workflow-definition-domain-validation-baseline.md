# Workflow Definition Domain Validation 实施基线

## 1. 完成范围

截至 2026-07-20，R4 `1.4a` 已实现纯 deterministic Workflow Definition/DAG validator：

- 直接消费 `1.2d1` canonical snapshot，并强制 `contractVersion` 与 `stepRegistryDigest` 一致；
- 拒绝 unknown/legacy step、descriptor output schema drift、timeout 超过 descriptor upper bound；
- 校验 tenant/workspace/definition/step/edge/policy refs、schema refs、safe codes 与 typed input source；
- 限制 `1..1024` steps、`0..4096` edges、每 step 最多 `128` input bindings；
- 拒绝重复 step/edge/binding、dangling endpoint、self-loop、duplicate relation 与 cycle；
- 允许合法 multiple roots、fan-in/fan-out；
- 使用 bounded iterative Kahn traversal，1024 深链不递归；
- domain error 只返回 stable code，不回显 unsafe ref 或用户输入。

实现位置：

```text
service/internal/workflows/domain/definition.go
service/internal/workflows/domain/definition_test.go
Taskfile.yml
```

## 2. 验证

```bash
task workflow:domain-definition:test
task test:workflow-domain-definition:component
```

Component evidence：

```text
temp/integration-test-runs/20260720184103-25a46f15-8934-4904-824e-aac9bcb13afd/
status=passed
exit_code=0
redaction=enabled
evidence_scan=clean
```

## 3. 未完成边界

- `1.4b` 尚需完成 canonical checksum、published immutability、derive-new-version 与 deprecate lifecycle。
- `1.4c-1.4e` 尚未实现 Run/Step/Attempt/retry/cancel/compensation state machine。
- validator 已接入 `5.3` publish/start service；当前 `ValidateDefinition`、durable `ListRunEvents` 与基于同一 durable source 的 bounded `WatchRunEvents` 已通过同一 service 绑定本地 HTTP、JSON-RPC、gRPC 与 typed SDK，并保持 validation 不持久化、event projection 只读安全。`ReconcileRun`、managed publisher/restart、Web designer 与全消费点 conformance 仍由 `1.5b`、`8.1` 和 `1.2d2` 关闭。

## 4. ValidateDefinition 本地绑定

`ValidateDefinition` 使用与 publish/start 相同的 principal、tenant/workspace 与 domain validator，但只接受 draft，不创建 definition/version，也不写入 Store。错误只投影 stable `contractVersion`、`code`、`reasonCode` 与可选 safe refs/versions/evidence。

本地 loopback runtime 已通过 HTTP、JSON-RPC、gRPC 的 valid/invalid validation parity 与 event list sequence/cursor parity；typed SDK 通过 HTTP transport 复用同一接口。该绑定是 local/component evidence，不代表 PostgreSQL、provider、browser 或 production readiness。

验证入口：

```bash
task workflow:definition-validation-runtime:test
task test:workflow-definition-validation-runtime:component
```

Component evidence：

```text
temp/integration-test-runs/20260801205000-6ab70fce-5981-4703-b51b-4a6bbb270757/
status=passed
exit_code=0
redaction.total_redactions=0
```
