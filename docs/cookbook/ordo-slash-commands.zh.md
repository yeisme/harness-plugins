# Ordo Slash 命令

[English](ordo-slash-commands.md) | 中文

DSH 命令面是安全投影与 owner handoff。Ordo 仍然拥有 run、task、lease、approval、
receipt、reconcile 和 composition facts；命令插件不创建本地 ledger，也不对未知动作自动重试。

## 语法

| 命令 | DSH 行为 | 是否 mutation |
| --- | --- | --- |
| `/ordo` / `help` | 展示四段式命令合同 | 否 |
| `/ordo status [safe-ref]` | 读取当前 owner snapshot | 否 |
| `/ordo capacity` | 读取 owner 提供的 capacity facts | 否 |
| `/ordo preview <safe-ref>` | composition owner 已挂载时读取预览 | 否 |
| `/ordo qualify <preset-id>` | 返回仅预览的 Ordo owner handoff | 否 |
| `/ordo reconcile <safe-ref>` | 展示当前 server-authored reconcile descriptor | 否 |
| `/ordo approve <decision-ref>` | 将当前 decision ref 与 preview digest 转给 owner CAS 边界 | 仅 owner 确认 |
| `/ordo run launch\|cancel\|redispatch` | 说明 DSH 当前不开放这些操作 | 否 |

每个成功结果固定包含 `Conclusion`、`Freshness / status`、`Safe refs / summary` 和
`Next action`。不安全 ref、路径、URL、credential、控制字符和多余参数会被拒绝，且不会回显输入。

## Action 分阶段

只有 owner snapshot 同时为 fresh、ready 且明确标记 `reconcile_required` 时，
`reconcile` 才可用。descriptor 必须提供精确 target、effect、owner、decision ref、
expiry、preview digest 和 contract digest，DSH 只负责展示这些 owner 字段。

`approve` 会重新读取当前 snapshot，检查 decision ref 与 expiry，再把 decision ref、
preview digest 以及绑定的 tenant/workspace/principal context 转给注入的 owner action source。
accepted receipt 才会显示为 owner-confirmed；`still_unknown` 与 `reconcile_required` 都是
不可重试结果，DSH 不自行补造成功或替换动作。

若独立 composition owner 已挂载，`qualify` 只读取安全 preview envelope，返回 target、health/drift
摘要、`capability_digest` 与精确 owner CLI handoff；缺失、格式错误或读取失败的 projection 继续
保持 unavailable。在独立 composition 与 Ordo owner 暴露完整 typed action contract 之前，DSH
不在本地计算 maturity、risk、qualification、approval 或 receipt。

## 本地验证

```bash
pnpm --filter @yeisme/dsh-ordo-agent-ops run typecheck
pnpm --filter @yeisme/dsh-ordo-agent-ops run test
pnpm --filter @yeisme/dsh-ordo-agent-ops run build
openspec validate dsh-ordo-command-interaction-v1 --strict --no-interactive
```

真实 owner action source 和 DSH client popup/面板联动仍属于 owner-gated 合同。不要用 browser
fetch、本地 optimistic state 或第二 scheduler 替代这些合同。
