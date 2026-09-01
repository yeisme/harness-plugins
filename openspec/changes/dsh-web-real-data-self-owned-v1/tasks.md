> 状态：进行中（2026-08-31 设计定稿；起点硬门 = `ordo-dsh-plugin-visualization-v1` 归档，且排队于 G18 之后；2026-09-01 完成 §1 数据源审计 1.1/1.2，基线真数据率 4/10=40%，账本见 audit-ledger.md；其余未启动）。

## 1. 数据源审计

- [x] 1.1 盘点常用面板（ordo/team-hub、token/session/model/用量、command-first 状态中枢）数据源现状，产出三态标注审计清单与基线真数据率。
  Evidence (2026-09-01): 10 面板逐一以代码事实标注三态（真数据 4 / probe 降级 5 / 静态演示 1），基线真数据率 4/10=40%；证据 file:line 见 audit-ledger.md §1（token/session 官方 seam 链、ordo owner seam 缺席 needs_contract、session-manager placeholder、command-first fixture transport 等）。
- [x] 1.2 把审计清单落为本 change 的验收账本文件，随任务推进更新。
  Evidence (2026-09-01): 新建 openspec/changes/dsh-web-real-data-self-owned-v1/audit-ledger.md（§1 审计表+§2 真数据率+§3 seam 缺失底账+§4 变更记录表，随任务推进追加行）。

## 2. ordo/team-hub 真数据链

- [ ] 2.1 `ordo-agent-ops` host 接本地 ordo CLI：run/task/approval/evidence/team 只读拉取、错误与不可用显式上报。
- [ ] 2.2 `ui-ordo-agent-ops` 面板切换到真数据投影；CLI 不可用时显示安全离线态与原因，不显示演示数据。
- [ ] 2.3 验证投影边界与 ordo-dsh-plugin-visualization 冻结 requirement 一致（无第二 ledger、无凭据/raw prompt/绝对路径出网）。

## 3. 官方已有 seam 真数据化

- [ ] 3.1 token/session/model/用量相关面板逐一接官方已有 seam；seam 缺失处保留 probe-first 降级与原因。
- [ ] 3.2 移除主路径上的静态演示数据；演示数据仅保留在显式标注的降级/空态。

## 4. 验证与证据

- [ ] 4.1 以审计清单计算常用面板真数据率 ≥80%，未达标面板记录 seam 缺失原因。
- [ ] 4.2 相关包 `pnpm run typecheck && test && build` 全绿；openspec validate strict 通过。
- [ ] 4.3 dogfood 主路径（`pnpm dsh:dev`）实测 ordo 与用量面板真数据渲染，证据落 temp/integration-test-runs/。
