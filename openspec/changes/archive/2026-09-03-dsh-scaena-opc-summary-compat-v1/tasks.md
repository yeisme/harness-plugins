## 1. Canonical contract adapter

- [x] 1.1 增加独立的 Scaena canonical OPC summary/action/gate 类型与 fail-closed normalizer；验收：snake/camel ingress、未知字段兼容、敏感字段拒绝、旧 schema/export 不变。
- [x] 1.2 增加只读 cross-entry identity projection；验收：package/action/gate receipt/receipt/reconcile 字段逐值复制，不生成 idempotency key、不翻译 enum。

## 2. Cross-entry verification

- [x] 2.1 增加 canonical redacted package contract tests，并验证 legacy OPC contract tests 无回归。
- [x] 2.2 增加显式 fixture 路径 verifier，直接读取 Workbench conformance fixture 并在任一身份不一致时非零退出。

## 3. Acceptance

- [x] 3.1 运行 focused package tests、Workbench/DSH cross-entry fixture evidence、typecheck、build、bundle checks 与 strict OpenSpec validation。
- [x] 3.2 记录 affected surface、兼容等级、无弃用窗口和可逆回滚路径，确认旧 DSH OPC alpha surface 未改变。
