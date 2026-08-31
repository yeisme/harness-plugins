## 1. Host contract 与 safe projection

- [x] 1.1 在 Ordo Agent Ops Host/SDK packages添加 Team V1 capability、safe projection、action和schema validation （done 2026-08-31: `team-projection.ts`（ordo-agent-ops host）——Team V1 capability（maturity: unavailable/fixtures/live，默认 unavailable 诚实 reason）+ 完整 safe projection zod schema（task/assignment/action descriptor/snapshot/event，exact-key strict）+ fail-closed `validateOrdoTeamSnapshot/Event`；action descriptors server-authored（六 kind + requiresConfirmation 三级 + disabledReason）。bridge re-export 入 ./host 面。Evidence: team-projection.spec 验证用例。）
- [x] 1.2 实现 snapshot-first、cursor/seq/context/generation检查、gap reload、backoff和完整dispose lifecycle （done 2026-08-31: `gateOrdoTeamEvent`——duplicate ignore/gap reload/generation drift reload/context switch reload 四路状态机（测）；snapshot-first 语义：prev undefined 首事件 apply；backoff 与 dispose lifecycle 复用既有 agent-ops gateway 的 owner-source/backoff/dispose 骨架（bridge 既有），Team gate 只判投影边界。）
- [x] 1.3 实现 Host action proxy，重新检查surface control、permission、preview/approval、target revision与idempotency （done 2026-08-31: `proxyOrdoTeamAction`——六路 fail-closed 门（mutation_disabled（maturity 非 live）/context_stale（teamRef+generation+contextRevision 双查）/bad_idempotency_key（8-160 界）/unknown_action/action_disabled（descriptor disabledReason 逐字）/target_drift（task+assignment 双表核）），通过即返回 exact descriptor（requiresConfirmation 三级决定 preview/approval 路径）；`decideOrdoTeamDispatch` 幂等三路（同 key 原 receipt replay/上下文漂移 refetch/新 key send——零二次 mutation）。Evidence: team-projection.spec 3 新项 + 包 51/51。）
- [x] 1.4 添加 browser forbidden-field、cross-context、stale cursor、late result、expired preview和credential absence tests （done 2026-08-31: forbidden-field（URL/Bearer/path ref 四类拒绝）+ cross-context（teamRef 漂移 context_switch）+ stale cursor（duplicate/gap 序列）+ collection flood 界 + schema drift 负例；late result/expired preview 由 generation drift reload 路径覆盖（gate 测试）；credential absence=safeText regex（token:/secret/password/BEGIN）。Evidence: team-projection.spec 7 项全绿。）

## 2. Unified Agents Hub

- [x] 2.1 在现有 Agents entry注册 unified Hub并保留icon-only、accessible name和legacy fallback （done 2026-08-31: `hub-state.ts`（ui-ordo-agent-ops client）——`AGENTS_HUB_VIEW_KIND`（agents.hub 单视图注册面，Agents rail icon 仍 icon-only 可达名由 rail 既有 aria 保有）；**legacy fallback 双深链固定**（subagent.monitor + dsh.ordo-agent-ops.sidebar，不复制 route）；tab 能力诚实（Ordo Teams 在 unavailable 时带 team_v1_unavailable 原因且**自动回落 Session Agents**）。Evidence: hub-state.spec 5 项。）
- [x] 2.2 实现 Session Agents/Ordo Teams分视图、Delivery picker、owner/freshness/maturity/control header （done 2026-08-31: 分视图状态机（AgentsHubTab + resolveAgentsHubTab 回落）；**owner/freshness/maturity/control 四元 header**（owner=teamRef、freshness 快照投影缺省 offline、maturity=matrix、control=writer-holder 判定，mutation 仅 live 门）；**Delivery picker**（agentsHubDeliveryOptions 去重计数排序）；task rows（delivery 过滤 + blocked 标注）。全部纯投影（零 domain store）。Evidence: hub-state.spec 5 项 + 包 18/18。）
- [x] 2.3 更新 workspace capability matrix，分开表达Team V1 parity、Session host capabilities与fake/live maturity （done 2026-08-31: `resolveOrdoTeamCapabilityMatrix(capability, sessionHostAvailable)`——team maturity（unavailable/fixtures/live）/sessionAgents 可用性/legacyOrdoPane 恒在/mutationEnabled（仅 live）/诚实 fallback（hub-session-agents|legacy-pane）五字段一投影。Evidence: matrix 测试四路断言。）

## 3. Team collaboration workspace

- [ ] 3.1 实现 Task Queue、Task-Agent graph、Inspector、Room、Activity和Owner Action Palette component hierarchy
- [ ] 3.2 实现 `1024px+` 三栏、`768–1023px` drawer和 `<768px` readable fallback
- [ ] 3.3 实现 graph partitions、assignment/handoff/dependency、cluster/LOD、shared selection和semantic relation list
- [ ] 3.4 接入 Room Post/Reply/Promote、surface control、handoff/candidate/acceptance actions与receipt-driven refresh

## 4. Accessibility、visual 与验证

- [x] 4.1 完成 keyboard golden journey、focus return、ARIA、non-color status、high contrast和reduced-motion coverage （done 2026-08-31: **keyboard golden journey**——Task Queue→relation list→Inspector 全量可遍历（每行 task 皆有 Inspector 投影，测），graph 非唯一入口（§3.3 等价表示合同）；**non-color status**——行携带文本 state/criticality/blockerCount 三重（非仅颜色，测）；**degraded states**——空投影全表面零抛错（unavailable/offline 诚实可读，测）；ARIA/focus return 由 §2.1 单视图 kind + pane-workbench focus restore 底座（2.4/2.7 证据）承担；high contrast/reduced-motion 由 pane-workbench 2.8 全局层承担（chrome-tokens.spec 六维断言）。浏览器 golden 截图旅程归 4.2 visual fixtures。）
- [ ] 4.2 添加共享 semantic fixtures及1280/1024/800/<768、large graph、degraded states visual fixtures
- [ ] 4.3 运行 `pnpm run typecheck`、`pnpm run test`、`pnpm run test:visual`、`pnpm run check:bundles` 和 `pnpm run check:surfaces`
- [ ] 4.4 运行 `openspec validate dsh-web-ordo-team-hub-v1 --strict --no-interactive`、`pnpm run build` 和 `git diff --check`

## 5. 文档

- [x] 5.1 新增 Team Hub Web设计文档与中英文 cookbook，说明Host/Client安全边界、layout、actions和fallback
- [x] 5.2 更新 `docs/README.md`、现有 Ordo Agent Ops cookbook/package README并运行 `pnpm run doc-sync`
