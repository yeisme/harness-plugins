# Canonical Operation Registry Snapshot 实施基线

## 1. 完成范围

截至 2026-07-20，R4 `5.0b2b2c1` 已实现 handler-free canonical operation snapshot：

- snapshot 只能从 sealed `registry.Registry` 生成；
- contract version 固定为 `workbench.operation_registry.v1`；
- digest 直接来自现有四 transport 共用 registry digest，并规范化为 `sha256:<hex>`；
- descriptor 包含 compatibility 所需 operation flags、project modes、transport projections、canonical schema 和 schema ref；
- snapshot 不包含 handler、runtime client、credential、provider payload 或 private path；
- JSON round-trip 后重新计算 registry digest，tamper、重复、乱序、schema/ref drift 一律 not-ready；
- snapshot 实现 production dependency checker 所需 `CheckReady` 与 `Digest` 接口；
- managed bootstrap 已用真实 snapshot contract test 证明可直接消费，不再需要 worker 手写 operation digest provider。

实现位置：

```text
service/internal/registry/snapshot.go
service/internal/registry/snapshot_test.go
service/internal/workers/bootstrap/bootstrap_test.go
```

## 2. 验证

```bash
task registry:snapshot:test
task test:registry-snapshot:component
CGO_ENABLED=0 go vet ./service/internal/registry ./service/internal/workers/bootstrap
```

Component evidence：

```text
temp/integration-test-runs/20260720180147-c249977d-f4f8-4008-956b-6e9233d324eb/
status=passed
exit_code=0
redaction=enabled
evidence_scan=clean
```

## 3. 未完成边界

- snapshot 目前是内存合同，尚未由 R0 release CLI 生成签名/溯源 artifact；如果未来持久化，必须由 CLI 或 application service 生成，不能手写 JSON。
- typed workflow step 的 input/output schema 尚未由 R4 `1.2` 交付，因此 step registry snapshot 不得用空 schema ref 或静态 digest 冒充完成。
- `5.0b2b2c2` 完成后，release manifest 必须同时绑定 operation snapshot digest 和 step snapshot digest。
