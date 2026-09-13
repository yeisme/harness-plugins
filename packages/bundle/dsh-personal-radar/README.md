# @yeisme/dsh-personal-radar

DSH Personal Drama Radar 可安装 bundle：Context badge、`/drama radar` 命令族、按需 Radar Pane，以及独立的 `drama-radar.market` 市场变化视图与 `drama.radar.market` 命令入口。声明 `dsh.bundle.patch`，未安装时既有 DSH/Director Pack 行为不变。

## 安装

从本仓库 checkout 安装：

```bash
dsh plugin --profile web add ./packages/bundle/dsh-personal-radar
```

发布后安装：

```bash
dsh plugin --profile web add @yeisme/dsh-personal-radar
```

## 启用

安装并满足以下 probe 后入口出现：

- Radar binary 可达（用户级配置 `radar`）。
- owner handoff 合同为 `radar.mcp.handoff.v1`。
- `radar mcp capabilities` 报告 `personal_profile_feedback` / `opportunity_edition` / `mcp_stdio_lanes` ready。
- 官方 Pane slot 可用。

任一缺失：入口禁用并显示 `needs_radar` / `contract_mismatch` / `capability_blocked` / `seam_unavailable` 原因，不渲染死按钮。

## 市场变化入口（dsh.radar.market-projection.v1）

市场面与个人机会面相互独立，复用同一 Pane slot 与命令注册 seam：

- 市场视图仅当宿主提供 `radarMarketHost` typed seam 时挂载；缺失市场 capability 时按 `market_capability_*` 原因禁用市场入口，个人 Radar 入口不受影响。
- 读取路径只消费 owner 发布的 `radar://market/*` 资源投影；浏览器不启动 CLI、不读用户目录。
- 已读／撤销／关注（watch/unwatch/pause/resume）是显式的 typed mutation（`dsh.radar.market-mutation.v1`），带幂等键、payload digest 与 reader revision；pending 不伪装成功，unknown 只按原键对账，不自动重发，也不与个人 save/dismiss 反馈混用。
- 证据问答草稿绑定当前会话、信号修订与 policy revision，仅用户显式发送；缺会话 composer seam 时证据阅读保留、问答禁用。

## 回滚

```bash
dsh plugin --profile web remove @yeisme/dsh-personal-radar
```

回滚只移除 badge/命令/Pane 入口（含市场视图与命令）；Radar canonical state（读者已读、关注、观测数据）不动，不恢复任何独立 Workbench 目标。

## 验证

```bash
pnpm --dir packages/bundle/dsh-personal-radar run test
pnpm --dir packages/bundle/dsh-personal-radar run test:profile
pnpm run check:bundles
pnpm run check:plugins
```
