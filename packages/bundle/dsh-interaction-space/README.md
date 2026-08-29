# @yeisme/dsh-interaction-space

DSH Web 工件交互空间 bundle：把预览面升级为 agent 原生协作面——锚点栏、
附着会话、typed space directive、per-format 提案与 preview-before-mutate 应用。

## 安装

```bash
# 发布后
dsh plugin --profile web add @yeisme/dsh-interaction-space

# 本地 checkout
dsh plugin --profile web add ./packages/bundle/dsh-interaction-space
```

## 能力

- **`interaction.space` pane view**（resourceKey `space:<owner>:<ref>@<version>`，
  retention snapshot）：锚点栏 + 提案区 + directive/receipt 时间线 + 附着会话面板。
- **锚点层**：selection-host `SelectionAnchorV1` 全家族（含 additive `table-range`
  数据坐标锚点）；rich-media 格式渲染器带 `data-source-*` 提示，无提示诚实降级
  `dom-region`，绝不伪造行列号。
- **对话层**：空间内 attach/fork session（`ISessions.binding()/fork()`）；主对话
  current selection 全程不动（计数测试钉死）；composer adapter 把锚点作为结构化
  `anchorIds` 附着。
- **指令层**：agent 只能发 typed directive（`space.focus/highlight/propose/
  request-input/progress`，经 conversationEvents `space/ref`）；unknown kind、
  越界锚点、超预算载荷丢弃并显示 typed 原因；高频 highlight 节流合并。
- **提案层**：per-format diff 投影（行级 hunk / cell 变更矩阵 / 图片对比 /
  docx 片段）+ 逐位置审批；应用经宿主注入的 owner dispatch adapter
  （preview-before-mutate），receipt 回写时间线，unknown/stale 不自动重试。

## 降级矩阵（fail-closed）

| 缺席 seam | 行为 |
| --- | --- |
| composerAdapter | `composer-adapter-unavailable`，发送禁用 |
| ISessions binding/fork | 对话层 needs_contract，锚点/提案不受影响 |
| conversationEvents | directive 面板禁用 + 原因 |
| owner dispatch adapter | 应用禁用 `owner-adapter-unavailable`，diff 只读 |

## 预算与围栏

锚点 ≤200 · 时间线 ≤200 条滚动 · diff 载荷 ≤256KB · 活跃提案 ≤16；
version bump 后 digest 失配锚点标 `stale`、依赖提案 `reconcile_required`。

实现包：`packages/client/ui-interaction-space/`；设计合同：
`openspec/changes/dsh-agent-interaction-space-v1/`。
