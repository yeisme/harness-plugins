# @yeisme/dsh-client-ui-interaction-space

DSH Web 工件交互空间 client 包：以工件为中心的 agent 协作面，并作为 V2
singleton selection interaction layer 的 context/owner handoff 参与方。

## 结构

- `src/contracts.ts` — `SpaceDirectiveV1`（focus/highlight/propose/request-input/
  progress）、`SpaceProposalV1`（per-format diff 载荷）、预算与 fail-closed 校验
  （zod，unknown kind / 越界锚点 / 超预算载荷 typed 拒绝）。
- `src/controller.ts` — 空间状态机：锚点/时间线（200 滚动）/提案生命周期
  （review→applying→applied/failed/reconcile_required）、version bump 漂移、
  session attach/fork（**主选择不变量**：控制器不持有 `open()/openSubagent()/
  clear()`）、composer 锚点附着（`anchorIds` 结构化）、owner dispatch
  preview-before-mutate。
- `src/view.tsx` — 降级条 + 锚点栏 + 提案卡（逐位置审批 + diff 投影）+ 时间线
  + 会话面板。
- `src/client/index.ts` — Cordis client face：`paneWorkbench` optional probe 注册
  `interaction.space` view；`conversationEvents` optional probe 消费 `space/ref`。

## 主选择不变量

空间内一切 session 读写经 `ISessions.binding()` + `SessionFace`；新建走 fork。
控制器源码不 import、不持有 `open()/openSubagent()/clear()`；测试以 spy 计数
断言调用次数为 0。close pane = detach（只取消本地订阅）。

## 预算

锚点 ≤200 · 时间线 ≤200 条滚动 · diff 载荷 ≤256KB · 活跃提案 ≤16 ·
highlight 节流窗口 1s。

## 开发

```bash
pnpm --filter @yeisme/dsh-client-ui-interaction-space run typecheck
pnpm --filter @yeisme/dsh-client-ui-interaction-space run test
pnpm --filter @yeisme/dsh-client-ui-interaction-space run build
```

可安装形态见 bundle `packages/bundle/dsh-interaction-space/`；设计合同见
`openspec/changes/dsh-agent-interaction-space-v1/`。统一选区交互的 V2 设计、
扩展 descriptor、偏好和迁移合同见
`openspec/changes/dsh-selection-interaction-v2/`。
