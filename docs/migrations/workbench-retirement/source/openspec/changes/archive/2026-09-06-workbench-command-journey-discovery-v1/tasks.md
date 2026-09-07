# Tasks

## 1. Typed ingestion contract

- [x] 1.1 Add the typed projection client for Gateway `gateway_capabilities_search` / `gateway_journeys_suggest` results and owner-direct typed projections (single shared shape, source-tagged `gateway` vs `owner:<name>`).
  - **Evidence (2026-09-06)**: `packages/task-sdk/src/discovery-models.ts` + `discovery-client.ts`——Gateway `gateway_capabilities_search`/`gateway_journeys_suggest` 结果 envelope（`gateway_capability_search_result.v1`/`gateway_journey_suggestion_result.v1`）与 owner-direct 三 schema（`yeisme.command_catalog.v1`/`command_suggestion.v1`/`journey_descriptor.v1`）归一化为单一共享 camelCase 投影形状，source 标注 `gateway` vs `owner:<name>`；`WorkbenchClient.discovery` 组合 + index 导出。单测 `packages/task-sdk/test/discovery-client.test.ts` 7/7。
- [x] 1.2 Validate every ingested projection against root `docs/contracts/discovery/` schemas (`command_catalog.v1`, `command_suggestion.v1`, `journey_descriptor.v1`); invalid projections fail closed with a typed error state, never partial render.
  - **Evidence (2026-09-06)**: 全部 normalizer 对齐根 schemas 严格语义（additionalProperties:false——catalog/suggestion/journey descriptor 未知字段即 invalid）；digest `[0-9a-f]{16,128}`、journey_id 语法、reason code/effect/approval/availability 封闭词表、candidates≤3、queryLanguage 封闭枚举。invalid 投影 fail closed 为 null → client 抛 `contract_mismatch`（typed error state），绝不 partial render。fixture 验证见 1.3。
- [x] 1.3 Consume the root valid/invalid discovery fixtures in conformance tests without importing owner modules (mirror the bridge-consumer fixture pattern).
  - **Evidence (2026-09-06)**: `tests/conformance/discovery-fixtures.test.ts` 镜像 bridge-consumer fixture 模式：`WORKBENCH_DISCOVERY_FIXTURES_DIR` 指向根 `docs/contracts/discovery/fixtures/`，零 owner module import；valid 7 件全部归一化成功、invalid 4 件（bad-digest/four-candidates/snake-reason/unknown-field）全部 fail closed、敏感键零命中、candidates≤3；环境缺失即 skip。evidence run `20260906081953-76e0337f-23a3-43c0-bcfc-a29c66e3edd0`（六件套，11 pass/0 fail/exit 0）。
- [x] 1.4 Keep ingestion session-scoped only: memoization with explicit refetch, no durable projection cache.
  - **Evidence (2026-09-06)**: session-scoped memoization 落在 `WorkbenchDiscoveryClient`（实例内 Map，参数 key；`refetch: true` 显式覆盖、`clearMemoizedProjections()` 刷新入口）；无 durable 存储——单测断言同参数第二次读零 SubmitTask、refetch 后重新提交；session 结束实例即弃，无投影残留。

## 2. Read-only discovery surface

- [x] 2.1 Capability search results list: owner, command, effect class, approval requirement, availability badge.
  - **Evidence (2026-09-06)**: `apps/web/src/workbench/command-discovery/lens.tsx` 能力搜索列表：owner、capabilityRef、effect 徽标（逐个渲染）、approval 徽标、availability 徽标；组件测试断言 paid/conditional 徽标与命令紧邻渲染。
- [x] 2.2 Journey detail panel: steps, prerequisites, gates, effects, approvals, availability — read-only, sourced from typed projections.
  - **Evidence (2026-09-06)**: journey detail 面板（同文件）：steps（owner/capabilityRef/gate/approval/effects/blocked/reconcile）、prerequisites、逐 journey 展开；数据只来自 typed 投影（`DiscoveryJourneySuggestions`），组件测试覆盖 gate/blocked/reconcile 渲染。
- [x] 2.3 Copyable exact commands (or deep links to existing owner-approved action surfaces); effect/approval/gate badges rendered adjacent to every command.
  - **Evidence (2026-09-06)**: copy-to-clipboard 是唯一命令交互（`navigator.clipboard.writeText`，2s 已复制回显）；public tool name 可复制；effect/approval 徽标紧邻每个命令与步骤渲染；组件测试断言不存在 run/execute 按钮（copy-only）。
- [x] 2.4 Honest state badges for `stale` / `degraded` / `policy-hidden` / `unavailable` with owner-reported reason codes; known owner with no projection renders `unavailable`, never an empty success.
  - **Evidence (2026-09-06)**: `badges.tsx` 将 stale/degraded/policy-hidden/unavailable 渲染为一等徽标（文本+图标双表达，非仅颜色）；reason code 原样透传（REASON_LABELS 中文说明 + 原码兜底）；已知 owner 无投影 → outcome unavailable 渲染 unavailable 面板，绝不空成功（组件测试断言 capabilities-list 与 empty 态均不出现）；七种 availability 状态逐一断言渲染。
- [x] 2.5 Feature flag gating with rollback = flag off (no data migration).
  - **Evidence (2026-09-06)**: `flag.ts` `COMMAND_DISCOVERY_ENABLED`；flag off → 路由渲染 disabled 说明（`command-discovery-disabled`），不请求数据；rollback = flag 关闭，无数据迁移（SDK 只有 session memoization）。服务端同构 fail-closed：不配置 `WORKBENCH_DISCOVERY_GATEWAY_URL` 时 operation 保持 ModeUnavailable。

## 3. Boundary enforcement and tests

- [x] 3.1 Boundary tests: no `--help` parsing, no local CLI process spawning, no suggestion execution, no durable registry/DAG/owner-state copies, no Gateway policy bypass paths.
  - **Evidence (2026-09-06)**: 无 `--help` 解析、无本地 CLI 进程 spawn、无建议执行、无 durable registry/DAG/owner-state 副本、无 Gateway policy 绕过路径——数据面只有两个 typed reader operation（`workbench.discovery.reader.capabilities_search|journeys_suggest`），Go adapter 只调用两个 allowlisted loopback REST route（`service/internal/adapters/discovery_gateway.go` + 测试断言非 loopback/userinfo/query/fragment 拒绝、unknown route 404 fail closed）。
- [x] 3.2 Redaction assertions on rendered output: no prompt bodies, provider payloads, credentials, or raw query audit content.
  - **Evidence (2026-09-06)**: redaction 断言：SDK `containsSensitiveDiscoveryKey`（prompt_body/provider_payload/credential/password/secret/raw_tool_arg/upstream_url 递归扫描）单测；Go adapter `DisallowUnknownFields`（未知字段如 prompt_body 直接 decode 失败 fail closed）+ 测试用例；组件测试断言渲染 DOM 不含 prompt_body/provider_payload/credential/sk-/Bearer；fixture conformance 断言 valid 投影零敏感键。
- [x] 3.3 Unit + component tests for both data paths (gateway projection, owner-direct fallback) and every availability state.
  - **Evidence (2026-09-06)**: 双数据路径 + 全状态覆盖——gateway 路径（Go adapter httptest 6 测试 + SDK envelope 单测 + 组件 gateway source 徽标）与 owner-direct 路径（根 fixture conformance + `normalizeDiscoveryCommandCatalog/Suggestion/JourneyDescriptor` + 组件 owner source 徽标测试）；七种 availability 状态组件矩阵 + honest unavailable（gateway_not_configured/gateway_unreachable/timeout/contract_mismatch/invalid_argument/unknown_operation Go 侧逐一测试）。
- [x] 3.4 Run repo gates (`go`/`bun`/contract suites as applicable) and record evidence under the repo integration evidence convention.
  - **Evidence (2026-09-06)**: repo gates——`CGO_ENABLED=0 go test ./service/...` 全绿（零 FAIL）；`bun test` **1084 pass / 0 fail**（9 skip 为外部 fixtures env 缺席）；`bun run test:contract`（含 fixtures env）**653 pass / 0 fail / 85 files**；`bun run web:test` **251 files / 2081 tests 全绿**（含本面 6 测试；顺带修复 15 个预存红——`LocaleProvider` 无 Router 上下文 useLocation 崩溃根修 + 4 个 spatial 测试文件补 MemoryRouter，stash 对照归因非本 change 引入）；`bun run typecheck` 全绿；`bun run check:i18n` OK（4030 keys/23 namespaces）。integration evidence run `20260906081901-94eb4b4a-9f46-4454-826a-7541319be2b1`（conformance+runtime 双包 ok/passed/exit 0）；conformance 专项 run `20260906081953-76e0337f-23a3-43c0-bcfc-a29c66e3edd0`。

## 4. Closeout

- [x] 4.1 Update repo docs for the new surface; record the root change reference (`cross-project-command-discovery-and-journeys-v1` Wave 5) in the change README.
  - **Evidence (2026-09-06)**: 新增 `docs/ui/command-journey-discovery.md`（surface/边界/回滚/验证）并登记 `docs/README.md` UI 列表；change README 记录根 change 引用（`cross-project-command-discovery-and-journeys-v1` Wave 5）。
- [x] 4.2 `openspec validate workbench-command-journey-discovery-v1 --strict --no-interactive` exit 0; archive after review.
  - **Evidence (2026-09-06)**: `openspec validate workbench-command-journey-discovery-v1 --strict --no-interactive` exit 0（valid）；15/15 任务全勾、四层测试证据齐备（Go/SDK/conformance/component/integration），按本任务条款归档。
