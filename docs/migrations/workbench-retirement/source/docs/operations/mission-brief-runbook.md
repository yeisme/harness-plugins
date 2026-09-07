# Mission Brief Operations Runbook（任务 8.4）

> 本 runbook 只读诊断优先，不建议 unknown auto retry。所有命令无 secret argv。
> Mission Brief 当前是 **rules-only degraded**（Slice A）；approved generator 保持 `needs_contract`（0.2 blocked）。

## Capability 状态查询

```bash
# 查询 readiness（mission_brief_generator component state）
curl -s http://127.0.0.1:8787/readyz | jq '.components[] | select(.name | startswith("mission_brief"))'

# 查询 metrics snapshot（低基数 event/outcome/mode/reason）
curl -s http://127.0.0.1:8787/admin/metrics | jq '.missionBrief'
```

**状态语义**：
- `degraded` + reason `rules_only_ready`：rules-only 可用（Slice A），generation_mode=rules_only，state=degraded。
- `needs_contract` + reason `approved_needs_contract`：approved provider 未冻结（0.2 blocked），approved_generator 不可用。
- `unavailable`：source adapter 未接（R1 authority bridge 未建）或 config invalid。

## Flag 与 Kill Switch

```bash
# 启用 missionbrief（rules-only degraded；默认 off）
WORKBENCH_MISSION_BRIEF_ENABLED=true WORKBENCH_MISSION_BRIEF_CURSOR_KEY="<32+ bytes secret>" workbenchd ...

# 关闭（kill switch；operation 立即 unavailable，不删 additive data/history）
WORKBENCH_MISSION_BRIEF_ENABLED=false
```

Flag 关闭后：operation 不注册（unavailable）；已持久化 brief/attempt/event 只读保留；additive schema 不回滚 migration。

## 诊断（只读优先）

1. **brief 卡在 generating**：查 `mission_brief_attempts` 表 status + lease 过期时间。lease 过期后 reconcile-required，零自动重发。
2. **read 返回 unavailable**：检查 identity context（managed session）+ source adapter（OfflineSources → needs_contract 是诚实降级）。
3. **rate quota 超限**：observability `mission_brief.rate_quota_exceeded`；短暂等待 sliding window 翻转。
4. **unknown_accept**：item decision_state=decision_unknown，只 reconcile（不重发）；查 receipt/event 确认。

## 数据保留

- brief TTL：`BriefTTLSeconds`（默认 8h，config 可调）。
- event retention：`EventRetentionSeconds`（默认 30 天）。
- generation request retention：默认 24h，超期 GC。

## 禁止操作

- ❌ unknown_accept 自动重试（reconcile-only）。
- ❌ 绕过 authority gate 直接读 repository（cross-tenant 风险）。
- ❌ 关闭 TLS verify 或注入 arbitrary base URL。
- ❌ 把 rules-only 标为 AI/approved 生成。

## Verification 命令（无 secret argv）

```bash
openspec validate workbench-mission-brief --strict --no-interactive
CGO_ENABLED=0 go test ./service/internal/missionbrief/... -count=1
CGO_ENABLED=1 go test -race ./service/internal/missionbrief/... -count=1
bunx vitest run test/mission-brief-  # apps/web 下
```
