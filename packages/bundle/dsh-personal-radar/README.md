# @yeisme/dsh-personal-radar

DSH Personal Drama Radar 可安装 bundle：Context badge、`/drama radar` 命令族与按需 Radar Pane。声明 `dsh.bundle.patch`，未安装时既有 DSH/Director Pack 行为不变。

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

## 回滚

```bash
dsh plugin --profile web remove @yeisme/dsh-personal-radar
```

回滚只移除 badge/命令/Pane 入口；Radar canonical state 不动。

## 验证

```bash
pnpm --dir packages/bundle/dsh-personal-radar run test
pnpm --dir packages/bundle/dsh-personal-radar run test:profile
```
