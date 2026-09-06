## Context

DSH 当前公开的 `OPC_SCENE_PACKAGE_SUMMARY_SCHEMA` 为 `scaena.opc-scene-package-summary.v1alpha1`，其 gate state、side-effect enum、字段命名与 Workbench 已消费的 Scaena canonical `scaena.opc.scene_package_summary.v1alpha1` 不同。旧面已发布且已有 UI、fixture 与测试，不能通过改名或隐式 enum 映射来“对齐”。

本变更在 host 包增加第二条 canonical ingress。它只读取安全 projection，并为跨入口验收投影 package/action/gate receipt/reconcile 身份；Scaena 仍是全部生产状态与动作的 owner。

## Goals / Non-Goals

**Goals:**

- 接受并规范化 Scaena canonical OPC summary 的 snake_case/camelCase 形状。
- 对 action identity、gate receipt、receipt refs 与 reconcile ref 做逐字段只读复制。
- 用 Workbench 实际 conformance fixture 运行可复现的跨仓验收。
- 保持旧 DSH OPC schema、类型、validator、fixture 与投影行为不变。

**Non-Goals:**

- 不合并或替换两条 alpha schema。
- 不把 canonical enum 翻译成旧 DSH enum，不复用旧 UI state machine。
- 不新增 mutation transport、浏览器 owner store、下载器或 Scaena 私有 API 连接。
- 不在本变更中弃用或移除旧 surface。

## Decisions

1. **新增并行 canonical adapter，而非修改旧 adapter。** 新模块使用独立常量、类型和函数名，避免已有消费者在升级后改变语义。备选方案是直接修改旧 schema 常量或增加 union ingress；该方案会让旧 validator/UI 无法区分两条不同 enum 语义，因此拒绝。
2. **只投影跨入口需要的 owner 身份。** normalizer 校验 package/version/freshness/surface state、human gates、primary action 与 receipt refs；未知 additive 字段忽略，缺失必需身份 fail closed。DSH 不推导 readiness 或生成 idempotency key。
3. **action 与 receipt 保持 canonical 命名和值。** `side_effect_class`、`confirmation_required`、`idempotency_required`、`expected_version`、`target_ref`、gate `receipt_ref` 和 action `reconcile_ref` 原样进入只读 projection，不经过 legacy 枚举映射。
4. **跨仓 verifier 接受 fixture 路径参数。** verifier 不硬编码 monorepo 相对路径；验收时传入 Workbench `conformance.json`，独立发布仓仍可使用任意兼容 fixture。
5. **沿用现有 TypeScript/Vitest/tsdown。** 不增加依赖或平行测试框架。

## Risks / Trade-offs

- [两条 alpha surface 暂时并存，命名相近] → canonical 导出统一使用 `ScaenaCanonicalOpc*` 前缀并在注释中标明 legacy surface 保持冻结。
- [fixture 未来增加字段] → normalizer 忽略未知 additive 字段，但对核心身份与敏感字段继续 fail closed。
- [重复实现导致与 Workbench parser 漂移] → 仅实现跨入口所需最小合同，并直接对 Workbench 实际 fixture 运行 verifier，不复制整套 Workbench view model。
- [跨仓命令依赖对方文件存在] → verifier 使用显式路径参数；包级单测另有本仓 redacted fixture，跨仓缺失不会破坏普通发布测试。

## Migration Plan

1. 发布新增 canonical adapter/export，不改旧导出。
2. DSH/Workbench 验收显式调用 canonical adapter 与 Workbench fixture。
3. 后续消费者可按 schema 常量选择 adapter；本变更不自动迁移旧消费者。
4. 回滚时移除新增模块、导出、测试与 verifier；旧 DSH OPC 路径继续可用。

## Open Questions

无。本变更不决定两条 alpha surface 的长期合并或弃用窗口；如需收敛，另开带迁移期的 OpenSpec 变更。
