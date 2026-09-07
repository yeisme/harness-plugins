# 实施任务与验收

状态：1.x/2.x/3.x/4.x 已实现并验证（证据见各任务）；运行泳道与文本阶段事实的服务端 source 已接线（Auctra connector / showcontrol owner readiness / automation facade）。Workbench 只实现消费侧投影与可视化，不追踪 Auctra/Scaena/automation owner 的合同完成状态；owner 合同未签约时对应段如实 needs_contract。

开发文档使用中文；CLI/自动化文案、协议字段与代码注释使用英文。复用既有 transport/registry/pane 机制；component/contract 证据保存于 `temp/integration-test-runs/<run-id>/`（如触发）；失败保留退出码与脱敏日志。零匹配、全 skip 或 fake 不能充当真实验收。文档检查命令为 `openspec validate workbench-production-workflow-visualization-v1 --strict --no-interactive`。

## 1.x 合同与服务端

- [x] 1.1 productionpipeline 合同与 codec
  - Owner: client/yeisme-workbench；Depends on: 无。
  - Scope: `service/internal/productionpipeline/contract.go`（版本、closed 枚举、ref grammar、caps、Marshal/Validate/Parse DisallowUnknownFields）。
  - Acceptance: 阶段集合固定、facts ≤4、runs ≤8、漂移整体拒绝；测试覆盖枚举负例与截断。
  - Validation: `CGO_ENABLED=0 go test ./service/internal/productionpipeline/... -count=1`。
  - **Evidence (2026-09-06)**: contract/composer 测试同包 `productionpipeline_test.go` 23 tests（round-trip、未知字段/枚举/secret-ref 拒绝、阶段乱序/超 cap 拒绝、折叠规则表、诚实 unknown、运行泳道排序截断跳过、run lane 不拖垮阶段轨）；`CGO_ENABLED=0 go test ./service/internal/productionpipeline/... -count=1` → ok。
- [x] 1.2 文本/drama composer 与运行泳道
  - Scope: `service/internal/productionpipeline/composer.go` + 测试（source 接口 + fake；折叠规则表）。
  - Acceptance: §2.1/§2.2/§2.3 折叠全部有测试；unknown/needs_contract 不折叠为完成。
  - Validation: 同 1.1。
  - **Evidence (2026-09-06)**: 同 1.1 包内 23 tests 覆盖：draft blocked(conflict)/active(open)/pending(已观察为空)/unknown(未传 refs)、candidate 三阶段 unknown-until-contract、checkpoint accepted/pending、connector nil 全 unknown+needs_contract、source error offline、facts 不完整整轨降级、drama owner 阶段透传+owner facts+readiness 折叠 7 例、run lane 排序/截断/skipped/unavailable/独立性。
- [x] 1.3 BFF 路由 + runtime 接线
  - Scope: `service/internal/transport/productionpipelinehttp/`、`service/internal/runtime/productionpipeline_adapters.go`、`service/internal/runtime/runtime.go`（auctraConnector/showcontrol owner readiness/automation facade 绑定 + `GET /v1alpha1/production-pipeline` mux 挂载）。
  - Acceptance: closed 输入校验、principal/tenant fence、nil source fail-closed 投影、contract_mismatch 映射；handler 测试齐全。
  - Validation: `CGO_ENABLED=0 go test ./service/internal/transport/productionpipelinehttp/... -count=1 && CGO_ENABLED=0 go build ./service/cmd/workbenchd`。
  - **Evidence (2026-09-06)**: `handler_test.go` 8 tests（401 无 principal、text happy path（tenant 归一 tenant:local、draft active、runs 1 条、run source 恰调一次）、drama 必填 show_ref、closed 参数 8 负例（未知参数/跨 domain/非法 domain/非法与 secret ref/9 个 working_copy_ref/缺 workspace）、404 方法与路径、nil sources 诚实 needs_contract 投影、managed principal tenant 权威）全绿；query 参数 snake_case 对齐 SDK `toSnakeCase` 序列化。runtime 接线：text=auctraConnector（nil→needs_contract）、drama=`showcontrol.NewOwnerReadinessProjection(ownerService)`、runs=automation facade 逐 binding 授权读（Get=loadAuthorized+ListRuns）+ workflowRuntimeService 只读 run state；`CGO_ENABLED=0 go test ./service/internal/runtime/... -count=1` ok（18.9s）+ workbenchd/workbench-worker build ok。
- [x] 1.4 Go 门禁回归
  - Validation: `CGO_ENABLED=0 go test ./service/... -count=1`（预存外部失败如实记录，不代偿）。
  - **Evidence (2026-09-06)**: 全量 `CGO_ENABLED=0 go test ./service/... -count=1` EXIT 0（213 包全 ok，零 FAIL）；`CGO_ENABLED=0 go build ./service/cmd/workbenchd ./service/cmd/workbench-worker` EXIT 0。

## 2.x SDK

- [x] 2.1 models + normalizer
  - Scope: `packages/task-sdk/src/production-pipeline-models.ts`；closed 类型 + fail-closed normalizer。
  - Validation: `bun test packages/task-sdk/test/production-pipeline-client.test.ts`。
  - **Evidence (2026-09-06)**: normalizer 覆盖 null/版本漂移/未知 readiness/阶段乱序/runs 超限/未知 fact kind 六类漂移全部 WorkbenchError；needs_contract 投影是 succeeded 事实。
- [x] 2.2 client + http 映射 + 组合导出
  - Scope: `production-pipeline-client.ts`、`http.ts` `GetProductionPipeline` 条目（queryValues：数组 workingCopyRefs → 重复 `working_copy_ref` 参数）、`workbench-client.ts` 成员/http 工厂接线/unconfigured jsonRpc 面、`index.ts` 导出；round-trip 测试。
  - Validation: `bun test packages/task-sdk/test/production-pipeline-client.test.ts && bun run typecheck`。
  - **Evidence (2026-09-06)**: `production-pipeline-client.test.ts` 5/5 pass（safe call shape、drama 前置校验零触网、text 跨域/超限/secret ref 拒绝、漂移 fail-closed、needs_contract 事实）；typecheck 0 error。

## 3.x Web

- [x] 3.1 ProductionWorkflowPanel 组件 + i18n
  - Scope: `apps/web/src/workbench/agent/production-workflow/`（面板 + i18n 标签表）；`api/locale/source/{zh-CN,en-US}/workflow/production-pipeline.json` + agent namespace 5 keys + catalog-policy 56 条。
  - Validation: `bunx vitest run test/production-workflow-panel.test.tsx`。
  - **Evidence (2026-09-06)**: 面板测试 3/3（阶段轨 canonical+诚实 unknown+facts、run 泳道卡片+`/workflows/:tenant/:workspace?runRef=` deep link+skipped 注记、transport 错误 fail-closed 诊断无阶段渲染）；`bun run compose:i18n` OK（4030→4086 keys）+ `bun run check:i18n` OK。
- [x] 3.2 双挂载（Creative Production Lens + registered Pane）
  - Scope: `creative-production-lens.tsx` additive `pipelineClient` 挂载；`agent-pane-registry.ts`/`agent-pane-manifest.ts`/`agent-pane-host.tsx` 注册 `production.pipeline.v1`；`spatial-surface.tsx`/`agent-route.tsx`/`agent-workbench-shell-v2.tsx` 生产接线 `workbenchClient.productionPipeline`；palette TRANSPORT_READY 翻转。
  - Acceptance: drama 面板随 show scope 出现；pane 打开同面板；卸载即回滚。
  - Validation: `bunx vitest run test/creative-production-lens.test.tsx test/production-workflow-panel.test.tsx test/agent-pane-registry.test.ts test/agent-pane-manifest.test.ts && bun run typecheck`。
  - **Evidence (2026-09-06)**: creative-production-lens 31/31（含新增 2：pipelineClient 提供即挂载（drama 8 阶段）、缺省完全不挂载）；agent-pane-manifest 23/23（builtin 24 计数+closedParams 与 registry 白名单逐字段一致）；agent-pane-registry 全绿（runtime slot 含 productionWorkflow）；typecheck 0 error。
- [x] 3.3 i18n 与全局门禁
  - Validation: `bun run check:i18n` + `bun run web:build` + 全量 vitest。
  - **Evidence (2026-09-06)**: `check:i18n` OK（4086 server keys / 48 bootstrap / 446 source files）；`web:build` ✓ built；全量 vitest 见 4.2 记录。

## 4.x 文档与收口

- [x] 4.1 产品文档真源
  - Scope: `docs/product/production-workflow-visualization.md`（定位、双域阶段、诚实状态、挂载、非目标）。
  - **Evidence (2026-09-06)**: 文档已落 `docs/product/production-workflow-visualization.md`。
- [x] 4.2 change 收口校验
  - Validation: `openspec validate workbench-production-workflow-visualization-v1 --strict --no-interactive`。
  - **Evidence (2026-09-06)**: strict valid；全量回归见本轮日志——`go test ./service/...` EXIT 0（213 包）、SDK suite、`test:contract`、全量 vitest 2093+ tests（含 agent-pane-layout catalog 封闭清单已更新 productionWorkflow）。
