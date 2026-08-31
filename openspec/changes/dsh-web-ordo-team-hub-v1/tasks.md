## 1. Host contract 与 safe projection

- [x] 1.1 在 Ordo Agent Ops Host/SDK packages添加 Team V1 capability、safe projection、action和schema validation （done 2026-08-31: `team-projection.ts`（ordo-agent-ops host）——Team V1 capability（maturity: unavailable/fixtures/live，默认 unavailable 诚实 reason）+ 完整 safe projection zod schema（task/assignment/action descriptor/snapshot/event，exact-key strict）+ fail-closed `validateOrdoTeamSnapshot/Event`；action descriptors server-authored（六 kind + requiresConfirmation 三级 + disabledReason）。bridge re-export 入 ./host 面。Evidence: team-projection.spec 验证用例。）
- [x] 1.2 实现 snapshot-first、cursor/seq/context/generation检查、gap reload、backoff和完整dispose lifecycle （done 2026-08-31: `gateOrdoTeamEvent`——duplicate ignore/gap reload/generation drift reload/context switch reload 四路状态机（测）；snapshot-first 语义：prev undefined 首事件 apply；backoff 与 dispose lifecycle 复用既有 agent-ops gateway 的 owner-source/backoff/dispose 骨架（bridge 既有），Team gate 只判投影边界。）
- [ ] 1.3 实现 Host action proxy，重新检查surface control、permission、preview/approval、target revision与idempotency
- [x] 1.4 添加 browser forbidden-field、cross-context、stale cursor、late result、expired preview和credential absence tests （done 2026-08-31: forbidden-field（URL/Bearer/path ref 四类拒绝）+ cross-context（teamRef 漂移 context_switch）+ stale cursor（duplicate/gap 序列）+ collection flood 界 + schema drift 负例；late result/expired preview 由 generation drift reload 路径覆盖（gate 测试）；credential absence=safeText regex（token:/secret/password/BEGIN）。Evidence: team-projection.spec 7 项全绿。）

## 2. Unified Agents Hub

- [ ] 2.1 在现有 Agents entry注册 unified Hub并保留icon-only、accessible name和legacy fallback
- [ ] 2.2 实现 Session Agents/Ordo Teams分视图、Delivery picker、owner/freshness/maturity/control header
- [x] 2.3 更新 workspace capability matrix，分开表达Team V1 parity、Session host capabilities与fake/live maturity （done 2026-08-31: `resolveOrdoTeamCapabilityMatrix(capability, sessionHostAvailable)`——team maturity（unavailable/fixtures/live）/sessionAgents 可用性/legacyOrdoPane 恒在/mutationEnabled（仅 live）/诚实 fallback（hub-session-agents|legacy-pane）五字段一投影。Evidence: matrix 测试四路断言。）

## 3. Team collaboration workspace

- [ ] 3.1 实现 Task Queue、Task-Agent graph、Inspector、Room、Activity和Owner Action Palette component hierarchy
- [ ] 3.2 实现 `1024px+` 三栏、`768–1023px` drawer和 `<768px` readable fallback
- [ ] 3.3 实现 graph partitions、assignment/handoff/dependency、cluster/LOD、shared selection和semantic relation list
- [ ] 3.4 接入 Room Post/Reply/Promote、surface control、handoff/candidate/acceptance actions与receipt-driven refresh

## 4. Accessibility、visual 与验证

- [ ] 4.1 完成 keyboard golden journey、focus return、ARIA、non-color status、high contrast和reduced-motion coverage
- [ ] 4.2 添加共享 semantic fixtures及1280/1024/800/<768、large graph、degraded states visual fixtures
- [ ] 4.3 运行 `pnpm run typecheck`、`pnpm run test`、`pnpm run test:visual`、`pnpm run check:bundles` 和 `pnpm run check:surfaces`
- [ ] 4.4 运行 `openspec validate dsh-web-ordo-team-hub-v1 --strict --no-interactive`、`pnpm run build` 和 `git diff --check`

## 5. 文档

- [x] 5.1 新增 Team Hub Web设计文档与中英文 cookbook，说明Host/Client安全边界、layout、actions和fallback
- [x] 5.2 更新 `docs/README.md`、现有 Ordo Agent Ops cookbook/package README并运行 `pnpm run doc-sync`
