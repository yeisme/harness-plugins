## Why

grill-me 2026-08-31 决策（R2/R5/R7）：dogfood 最痛的四层之一是「真实数据感」——多数面板仍以静态投影或演示数据运行，「用起来不像真产品」。其中 fs/media/PTY 基础 seam 依赖 upstream 合入、节奏不可控；自控数据源有两条立即可接：ordo/team-hub（本地 ordo CLI 即可提供 run/task/approval/evidence 真数据）与官方已有 seam（token/session/model/用量）。本 change 只接自控链，把常用面板真数据率做到 ≥80%（R11 副指标）。

## What Changes

- 先审计：盘点常用面板数据源现状（真数据 / 官方 seam 可接 / 静态投影），产出面板真数据率基线清单。
- ordo/team-hub：`ordo-agent-ops` host + `ui-ordo-agent-ops` 接本地 ordo CLI 真数据（run/task/approval/evidence/team），只读安全投影；能力边界完全遵循 `ordo-dsh-plugin-visualization-v1` 冻结的 requirement，不新增 domain state。
- 官方已有 seam：token/session/model/用量相关面板全部接官方已有 seam；无 seam 处保持 probe-first 诚实降级，不伪造数据。
- 常用面板清单口径：ordo/team-hub、token/session/model/用量、command-first 状态中枢投影；真数据率以该清单计算。

## Capabilities

### New Capabilities

- `dsh-web-real-data-self-owned`：数据源审计基线、ordo 本地 CLI 真数据链、官方 seam 面板真数据化、无 seam 诚实降级与 ≥80% 真数据率验收口径。

### Modified Capabilities

无。ordo 面板行为遵循已冻结的 ordo-dsh-plugin-visualization capability；本 change 只替换数据来源，不改其 requirement 语义。

## Impact

- 主要实现：`packages/host/ordo-agent-ops`、`packages/client/ui-ordo-agent-ops`、token/session/model/用量相关 client 包。
- 硬门依赖：`ordo-dsh-plugin-visualization-v1`（16/22 在途）先归档，避免与该 lane 包重叠冲突。
- 非依赖：upstream seam（fs/media/PTY）与做剧 owner adapter 均不在本 change 范围（做剧 adapter 属第二波评估项）。
- 兼容分类：数据来源替换为 additive 切换（投影 shape 不变时直接换源；需新字段时 additive 扩展）；静态演示数据路径保留为无数据源时的降级态。
- 实现时点：V3 收尾后、G18 之后按序启动；本骨架 tasks 全不勾。
- 设计来源：`docs/design/dsh-plugin-dev-toolchain-and-experience.md` §Wave 2。
