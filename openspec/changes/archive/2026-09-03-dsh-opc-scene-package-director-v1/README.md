# dsh-opc-scene-package-director-v1

为 DSH 同步交付异常优先的 OPC 场景生产导演入口，消费同一 Scaena action 与 receipt。
# DSH OPC 场景生产导演入口

本 change 为 DSH 提供个人 OPC 场景生产包的异常优先入口。它消费 Scaena 的安全摘要、server-authored action 与 receipt，不复制生产状态，不新增 scheduler、task ledger 或审批状态机。

- proposal.md：问题、范围与 owner 边界。
- design.md：/drama、Review、Evidence、Delivery、Handoff 的同步投影设计。
- specs/opc-scene-package-director/spec.md：可验证的 DSH 行为合同。
- tasks.md：实现、测试与 conformance handoff。
