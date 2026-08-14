# 任务分派

本文件遵循 Ordo OpenSpec 任务导入合同（供 `ordo goal target bind` 驱动）。跨 change 依赖（ordo-dsh-plugin-visualization-v1 的 snapshot remote 与 dsh-agent-composition-preview-v1 的投影服务）在 Scope 或 Acceptance 中注明，Dependencies 只使用本 change 内的纯任务 ID。

## Lane: commands-core

- [x] 1.1 实现 ordo 命令注册与 read 子命令。Owner: DSH implementer；Lane: commands-core；Dependencies: none；Scope: `packages/host/ordo-commands/`；Exclusions: 不实现第二调度器或 lease 或资质账本、不解释 shell 与 URL 与 executable、不伪造事实；Acceptance: 仅在 ordoAgentOps 或 agentCompositionPreview 任一数据源 mount 时注册、子命令语法只接受安全 ref、read 子命令返回四段式摘要并只用冻结状态词汇表、owner 不可用返回 needs_contract、依赖已实现的 ordoAgentOps remote（ordo-dsh-plugin-visualization-v1）；Verification: `pnpm run typecheck && pnpm run test -- packages/host/ordo-commands`；Expected: 正负语法与双源分支全绿；Failure recheck: 结果出现未冻结状态词或伪造事实即回 spec 修正；Automation: safe-local。
- [x] 1.2 注册 invariant 并编写双语 README。Owner: DSH implementer；Lane: commands-core；Dependencies: 1.1；Scope: `packages/host/ordo-commands/`；Exclusions: 不空置 invariant、不写与行为不符的文档；Acceptance: invariant 校验命令注册与数据源存在的运行时关系、README 含 Known Limitations 与四段式格式文档且双语准确；Verification: `pnpm run verify-package-invariants && pnpm run doc-sync`；Expected: exit 0；Failure recheck: 空 invariant 或文档与行为不符即回修；Automation: safe-local。

## Lane: commands-actions

- [ ] 2.1 实现 action 子命令的 preview 与 CAS。Owner: DSH implementer；Lane: commands-actions；Dependencies: 1.1；Scope: `packages/host/ordo-commands/`；Exclusions: 无 preview 不得 mutate、不伪造远端调用、不自行执行 canary、qualify 依赖的 agentCompositionPreview 服务由 dsh-agent-composition-preview-v1 提供；Acceptance: qualify 与 reconcile 先返回 exact target 与 effect 与 owner 与 expiry 与 preview_digest、approve 按 decision-ref 做 digest 与 context revision 与 tenant 的 CAS、run launch 与 cancel 与 redispatch 一律 not_available、reconcile 仅 reconcile_required 可用且复用 ordo.reconcile.request；Verification: `pnpm run typecheck && pnpm run test` 加真实组合测试（boot cordis.yml 经 Loader 断言 command/run 与 command/done 与文本）；Expected: 状态机负向（stale 与重放与 unknown）全绿；Failure recheck: 若 mutate 可绕过 preview 或 decision-ref 可重放则保持 blocked；Automation: safe-local。
- [ ] 2.2 编写 slash 命令 cookbook。Owner: DSH docs；Lane: commands-actions；Dependencies: 2.1；Scope: `docs/cookbook/ordo-slash-commands.md`；Exclusions: 只描述 DSH owner 边界与已开放动作；Acceptance: 命令语法表与 read 与 action 示例与 staging 说明双语配对一致；Verification: `pnpm run doc-sync`；Expected: exit 0；Failure recheck: code block 或 heading 或 link 不一致先修源文档；Automation: safe-local。

## Lane: client-ux

- [ ] 3.1 实现 popup 菜单与面板联动。Owner: DSH client implementer；Lane: client-ux；Dependencies: 1.1, 2.1；Scope: `packages/client/ui-ordo-agent-ops/`；Exclusions: 联动只导航不自动 mutate、popup refs 只来自 safe snapshot；Acceptance: decorate ordo 提供裸调用子命令菜单、onSelect 提交精确行、command/executed 打开并聚焦 Agent Ops 面板、面板以命令运行 popup 提交精确行；Verification: `pnpm run typecheck && pnpm run test -- packages/client/ui-ordo-agent-ops`；Expected: 既有面板测试绿加新交互测试绿；Failure recheck: 联动出现 mutation 或 refs 来自用户输入即回修；Automation: safe-local。
- [ ] 3.2 实现结果行与 popup 的可访问性。Owner: DSH client implementer；Lane: client-ux；Dependencies: 3.1；Scope: `packages/client/ui-ordo-agent-ops/`；Exclusions: 状态表达不只靠颜色、stale 与 offline 与 denied 与 contract_mismatch 下 mutation 不可提交；Acceptance: 结果行键盘可达且焦点可回归、screen reader 播报状态、reduced motion 生效、禁用态可见并解释原因；Verification: `pnpm run test -- packages/client/ui-ordo-agent-ops` 加 a11y 断言；Expected: 全键盘可完成 read 与 preview 流；Failure recheck: 任何 mutation 在 stale 下可提交即回修；Automation: safe-local。

## Lane: verify

- [ ] 4.1 端到端验证命令面与快照语义一致。Owner: DSH maintainer；Lane: verify；Dependencies: 2.1, 3.2；Scope: 不新增 tracked 实现、只产出验证证据；Exclusions: 不伪造 owner 证据、不开放外部动作门；Acceptance: profile 装载 host 与 client 后 ordo status 与 ordo preview 与 qualify CLI handoff 与 reconcile 负向与 stale 重放证据齐备、生命周期事件落会话；Verification: `pnpm run build && pnpm run test:e2e`（无 key 自跳过）加 keyless snapshot；Expected: exit 0；Failure recheck: 语义漂移回 conformance fixture；Automation: safe-local。
- [ ] 4.2 校验 change 并撰写 Agent Note。Owner: DSH maintainer；Lane: verify；Dependencies: 4.1；Scope: `openspec/changes/dsh-ordo-command-interaction-v1/`、`.agents/notes/`；Exclusions: 不修改已冻结的 spec 语义；Acceptance: openspec strict valid、Agent Note 记录语法归属与 decision-ref CAS 决策；Verification: `openspec validate dsh-ordo-command-interaction-v1 --strict && git diff --check`；Expected: exit 0；Failure recheck: 生成目录被手改时回源修复；Automation: safe-local。
