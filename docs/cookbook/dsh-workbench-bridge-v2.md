# DSH × Workbench 做剧桥 V2：使用与运维

面向使用者和插件运维者。合同与架构真值见 `docs/design/dsh-workbench-ai-drama-bridge-v2.md` 与 OpenSpec change `dsh-workbench-ai-drama-bridge-v2`；跨仓交付物见 `docs/integrations/dsh-workbench-ai-drama-bridge-v2-packet.md`。

## 用户视角

在 DSH 的 Drama pane 或 `/drama handoff`：

- **V2 可用**：显示将打开的 Workbench lens（Creative Production / Review / Evidence）、intent（`open_show` / `open_episode` / `open_artifact` / `open_review` / `open_evidence`）、合同版本与有效期；激活只经 host 批准 launcher，浏览器不拼接任何 URL。
- **legacy 兼容**：目标只支持旧合同时，入口显示 `[legacy_bridge]`；旧路径成功不会被报告为 V2 消费。
- **禁用态**：capability 过期（`stale`）、无批准目标（`target_unavailable`）、consumer 不兼容（`contract_mismatch`）时按钮禁用并给出稳定原因；不出现死按钮或猜测链接。
- **未知结果**：超时/未知结果不自动重试；显式重发会得到新的 nonce 与 launchRef，旧尝试保留为独立证据。

## 运维：target registry 配置

Host 侧 `WorkbenchBridgeTargetRegistry` 只接受封闭形态的批准条目：

```ts
registry.register({
  targetSurfaceId: 'workbench.agent.spatial',   // 固定逻辑标识，不是 origin
  targetApplication: 'yeisme-workbench',        // 固定目标应用
  supportedContracts: ['dsh.workbench_ai_drama_bridge.v2', 'drama.workbench-handoff.v1'],
  capabilityVersion: 'wb-2026.08',              // ≤32 字符
  probedAtMs: Date.now(),                       // 探测时间；超过 5 分钟视为 stale
})
```

- 条目携带 `origin`、`baseUrl`、`accessToken` 等任何额外键都会被 `denied` 拒绝——registry 永不保存目标地址或凭据。
- `probedAtMs` 需随真实 capability 探测刷新；超过 `BRIDGE_CAPABILITY_FRESHNESS_MS`（默认 300000ms）后入口禁用并报 `stale`。
- V2 签发由 provider 的 feature flag 控制（默认 off）；canary profile 显式开启。

## 运维：诊断与证据

- 证据类别固定为 `bridge_issued`、`bridge_launch_requested`、`bridge_consumed`、`bridge_reconcile_required`、`bridge_denied`、`bridge_expired`、`bridge_contract_mismatch`、`bridge_target_unavailable`。
- 每条证据只含 contract version、intent、target surface、稳定 reason code、时间、版本与 opaque correlation ref；不含 nonce、完整 envelope、目标 origin、凭据或绝对路径。
- 排障顺序：无 `bridge_issued` → 查 registry/flag；有 issued 无 `bridge_launch_requested` → 查 client 激活；有 launch_requested 无 `bridge_consumed` → 查 Workbench ingress（版本/replay/权限按 reason code 定位）。

## 运维：回滚

1. 关闭 host provider 的 V2 flag（`setEnabled(false)`）：立即停止新 V2 签发。
2. 已签发 launchRef 在 TTL 内自然过期（≤15 分钟），无需吊销列表。
3. consumer 兼容时自动回落显式 `legacy_bridge`；否则入口禁用并显示原因。
4. 回滚不迁移、不删除、不回写任何 Workbench/Ordo owner state。
