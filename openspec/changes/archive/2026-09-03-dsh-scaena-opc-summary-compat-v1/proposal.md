## Why

Workbench 已按 Scaena canonical `scaena.opc.scene_package_summary.v1alpha1` 契约完成 OPC 场景包消费，但 DSH 已发布的 alpha adapter 使用另一条既有 schema 与 enum 形状，导致两端无法用同一 package revision 做真实 cross-entry 验收。需要增加一条不破坏旧契约的 canonical 只读兼容入口，补齐 action、receipt 与 reconcile 身份的一致性证据。

## What Changes

- 新增 Scaena canonical OPC summary 的 DSH typed normalizer，接受 snake_case/camelCase ingress，并保留 package、action、gate receipt 与 reconcile 身份。
- 新增只读 cross-entry identity projection 和可传入 fixture 路径的校验命令，用 Workbench 实际 conformance fixture 验证 DSH 输出。
- 保留现有 `scaena.opc-scene-package-summary.v1alpha1`、旧类型、validator、fixture 与 UI 投影，不改名、不移除、不静默翻译 enum。
- 未知 additive 字段继续兼容；缺失、非法或含敏感字段的 canonical payload fail closed。

## Capabilities

### New Capabilities

- `scaena-opc-summary-compat`: DSH 对 Scaena canonical OPC summary/action/gate receipt 的增量只读兼容与跨入口一致性验证。

### Modified Capabilities

无。

## Impact

- 受影响公开面：`@yeisme/dsh-ai-drama-director` 新增导出；既有导出保持不变。
- 受影响代码：host canonical adapter、package contract tests、跨仓 fixture verifier。
- 依赖系统：Scaena/Workbench canonical OPC conformance fixture；不新增运行时依赖或浏览器直连。
- 回滚：移除新增 adapter、导出与 verifier 即可；旧 DSH OPC alpha surface 仍可独立工作。
