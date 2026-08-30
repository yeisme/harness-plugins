# 使用 DSH Web Ordo Team Hub

[English](dsh-web-ordo-team-hub.md) | [中文](dsh-web-ordo-team-hub.zh.md)

> 状态：V1 合同已完成，bundle 实现尚未落地。当前 Ordo Agent Ops Pane 继续作为 fallback。

## 1. 检查实际 profile 组合

查看真实 DSH Web 组合：

```bash
dsh --profile web --dump-config
```

只有 Host 与 Ordo 同时声明兼容的 `team_collaboration.v1` capability 时，Team V1 入口才能出现。能力缺失必须显示 unavailable reason，而不是死按钮。

## 2. 打开 Agents Hub

使用现有 Agents 图标。Hub 保持两个明确视图：

- `Session Agents`：当前 DSH session descendants。
- `Ordo Teams`：Ordo Delivery tasks、role slots、Room、Activity、control 与 receipts。

Browser 不直接连接 Ordo broker，也不启动 CLI process。Harness Host 加载 authoritative snapshot、校验 events，并代理 server-authored actions。

## 3. 执行 Golden Delivery 旅程

Ordo Team V1 commands 实现后，在打开 Web 前检查 Delivery：

```bash
ordo team delivery show <delivery-id> --json
ordo team delivery watch <delivery-id> --events
```

在 Hub 中：

1. 选择 Delivery 和一个 blocked 或 active task。
2. 确认 Task Queue、graph 与 Inspector 使用相同 task/role refs。
3. 打开 Room，显式 Post/Reply，并且只通过可用 typed action Promote。
4. 如果另一 surface 持有 control，使用 `Take Control` 并检查 current holder、revision 与 effect。
5. 只有 owner preview 仍有效时才提交 handoff、candidate 或 acceptance action。
6. 只有 accepted receipt 与 integration facts 出现后才把 Delivery 视为 complete。

Hub 不提供 target-branch merge、push 或 deploy action。

## 4. 理解 maturity 与 control

- `experimental_fixture`：只有合同/UI fixture。
- `fake_runtime`：模拟 attempts；8-writer fixture 不等于 live qualification。
- `qualified_live`：Ordo 有当前 runtime 与 fanout evidence。
- `unavailable`：owner contract 或 Host seam 缺失/不兼容。

`Read only · TUI has control` 表示 Web 可完整 inspect，但不能提交 mutation。Surface control 不替代 writer lease、approval、verification 或 runtime qualification。

## 5. 从降级状态恢复

| 状态 | 预期行为 |
| --- | --- |
| `stale` / `offline` | 可信 facts 保持只读，重新连接或读取 snapshot。 |
| `cursor_expired` / `event_gap` | 停止 delta，加载新 snapshot。 |
| `lost_control` | 关闭 stale confirmation，提供 server-authored Take Control。 |
| `approval_required` | 展示 preview 与精确 approval action，不自批。 |
| `unknown` / `reconcile_required` | 禁用 retry、replacement writer 与 lease release。 |
| `contract_mismatch` | 禁用 Team V1，有 legacy fallback 时继续使用。 |

## 6. 验证插件仓库

在 `agent/harness-plugins` 运行：

```bash
openspec validate dsh-web-ordo-team-hub-v1 --strict --no-interactive
pnpm run doc-sync
pnpm run typecheck
pnpm run test
pnpm run test:visual
pnpm run check:bundles
pnpm run check:surfaces
pnpm run build
```

集成证据写入 `temp/integration-test-runs/<run-id>/`，并脱敏 token、prompt、provider payload、private tool arguments、absolute path 和完整 reasoning。

## 7. 回滚

禁用 Team V1 capability 或 view registration。保留 Session Agents 与 legacy Ordo Agent Ops Pane。Browser 侧不需要 domain migration 或 cleanup。

