# Closeout evidence 汇总（8.x 测试证据 + 9.1/9.2 最终门禁）

日期：2026-09-01。基线：develop@`81cc221` + 本 change working-tree（未提交；树脏属正常，多并行 lane 共存）。
本文件是 9.4 的长期引用锚点：9.3 独立审阅与 9.5 owner delivery packet 从这里取 run-id、分类账与未证明项。

## 1. Evidence run inventory（六件套 schema-valid，原退出码保留，redaction 0 泄漏）

| run-id | layer | 状态 | 覆盖 |
| --- | --- | --- | --- |
| `20260901173934-7826e3b4-a7a8-4f35-873b-21b6ffe6c5b2` | component | passed | replica vitest 家族 + agent-pane-registry + SDK + security + media proxy（8.3/8.5） |
| `20260901174041-ab4ffdd7-cd33-4e2f-bd1a-d68116d9e1e3` | integration | failed（保留） | 8.1 DATA RACE 最小复现（readOwnerSegment 共享 source 写竞争），修复后复绿；backpressure 满载假红同窗口 |
| `20260901174213-051bbf1e-0a69-442c-b091-860c68253005` | integration | passed | Go spatialreplica/adapters/transport 全树 CGO0 + focused race + SDK/conformance parity（8.1/8.2） |
| `20260901174256-f8fb5ea4-9506-4b50-95d8-8da094105d82` | e2e | passed | replica Playwright 57 tests（critical paths 5 + responsive 7 + zoom 6 + accessibility 4 + visual matrix 35），SwiftShader 软渲染口径（8.4） |
| `20260901174435-0105afe9-42b0-4a70-b3e7-d24cbb8bd158` | integration | passed | 8.6 验收命令对：`bun run test:integration`（service/test/conformance + internal/runtime） |
| `20260901174559-b9552a0e-2636-4224-b864-5cb75b74b628` | e2e | failed（保留） | 全套件 `web:e2e`：184 passed/11 skipped/7 failed——7 个失败全数 concurrent（并行 lane dirty diff，见 §5），replica 面全绿 |
| `20260901181913-6cd7c8c0-c90d-4467-b85b-d57480ce5939` | integration | passed | 9.2 最终门禁 `bun run test:integration` |
| `20260901182030-a575d6df-ddc8-448a-94d9-19815098d5c0` | e2e | passed | 9.2 最终门禁 replica scoped e2e（57 passed/3 skipped/0 failed） |

全部 run 仅声明 local fixture/loopback 层级（dev-server + deterministic safe fixture + `:memory:` sqlite），无 production/staging 声明。

## 2. 9.2 最终质量门禁数字（单窗口完整跑，2026-09-01）

- `CGO_ENABLED=0 go test ./service/... -count=1`（umask 077）：exit 0，**203 包全 ok 零 fail**（-p 8；期间主机 load 377–533/128 CPU）。两次默认并行全量的负载 flake 见 §5。
- focused race：`CGO_ENABLED=1 go test -race ./service/internal/spatialreplica/... ./service/internal/transport/spatialreplicahttp/... ./service/internal/transport/spatialreplicagrpc/... -count=1` 全 ok。
- `bun run typecheck` exit 0；`bun test`（全根）853 pass/8 skip/0 fail；`bun run build` exit 0。
- `bun test packages/task-sdk` 527/0；`bun run test:contract` 530/0。
- `bun run --cwd apps/web build` exit 0；`bun run --cwd apps/web test` vitest 194 files/1644 tests + bun server 147 pass/6 skip/0 fail。
- `bun run test:integration` 与 replica scoped e2e 见 §1 末两行。

## 3. 9.1 格式/生成/schema/strict 门

- `buf lint` exit 0；`buf generate` 复跑 service/gen 46 个 .go 文件 byte-identical（gen 与 proto 完全同步）。
- `openspec validate workbench-spatial-replica-review-v1 --strict --no-interactive` valid；`--all --strict` 全仓 60 passed/0 failed。
- `git diff --check` 全 tracked diff clean；gofmt 本 change 自有 Go 面全 clean（修复一处 introduced struct 对齐）。

## 4. Additive / default-off / rollback 语义（长期口径）

- **Additive**：新 proto 包 `workbench/spatialreplica/v1alpha1`（5 rpc）、schema、SDK facade、五个 Pane、BFF media proxy 全部新增；不改既有 Agent/Pane/Task/ProposalAuthority/Spatial Surface/owner contract 原义（冻结记录见 `02-contract-freeze.md`）。
- **Default-off**：十个 capability 全部独立 default-off，server capability 是唯一 enable authority；off 时三 transport fail closed `capability_disabled`，浏览器零 `spatial-replica-3d` chunk 请求（rollback rehearsal e2e 断言）。
- **Rollback**：无 DB migration、无 owner state 依赖——rollback = 关 capability flag（config/capability rollback）。Go 侧 `CapabilityRollbackOnToOffConvergesUnavailable`/`ShutdownStopsStreamsAndFailsClosed` + e2e revoke（on→off canvas 卸载、对象树/时间轴存活）双证。ordinary `/agent`（conversation/existing Panes/Task/proposal/receipt）在 capability off 后不受影响（agent-first/agent-direct-panes/agent-spatial 回归族）。

## 5. Concurrent / external 分类账（非本 change 引入，未代修）

- 全套件 web:e2e 7 失败：agent-direct-panes CLI palette（committed `cli: true` availability 翻转 + 并行 lane dirty diff）、agent-first:223 重复 Conversation 文本（pi-workspace lane `agent-conversation-workspace` dirty diff）、pi-workspace rail 在制品——全部 parallel lane。
- Go 全量两次负载 flake（workflows/outbox 20ms startup deadline、workers/authority 2s readiness 窗口）：environmental/pre-existing，3/3 孤立复跑绿，包面本 change 零触碰。
- 8.7 外部红灯（`workbench-owner-backend-integrations` 归档后 canonical release 列表漂移）由协调者修复 `service/cmd/workbench-release/requirements.go`；本 closeout 补齐其未完成的 Go 测试期望对齐（`requirements_test.go` 1 行，测试期望、零业务逻辑），随后 release 门双绿。
- gofmt 未格式化 6 文件（backup.go=GA-R5 lane tracked M；canvas_v3/daily-ops/service-identity lane untracked；temp/diagnostics spatial-pa=r4 lane）。

## 6. 未证明项（9.5 owner packet 输入，非本 change 可代办）

- **Provider / 真实 owner runtime 未接**：Anatomia/Auctra/Scaena projection 现由 deterministic fixture adapter（`service/internal/adapters/spatialreplica_fixture.go`）供给；真实 owner runtime 合同未发布（`needs_contract`）。
- **Replica video 未做**：视频生成/合成归 Scaena 后续 change（PRD 移交项）。
- **非一比一 metric**：metric_verified 之外的任何视觉相似性不构成验收；真实 metric accuracy 由 owner canary 单独证明。
- **Local fixture 层级**：全部 evidence 是 local fixture/loopback，不证明 production。
- 性能数字（e2e performance spec）为 fixture 口径，非 production SLO。

## 7. Diff 范围摘要（9.3 独立审阅输入）

新增（untracked，本 change 自有，约 64 个 replica 命名面 + 3 文档 + openspec）：
- 合同/生成：`api/proto/workbench/spatialreplica/`、`api/schema/workbench/spatialreplica/`、`service/gen/workbench/spatialreplica/`
- Go：`service/internal/spatialreplica/`（18 文件：contract/composition/cache/stream/actions/capability/media/errors/ports/service + tests）、`service/internal/adapters/spatialreplica_fixture*.go`、`service/internal/transport/spatialreplicahttp/`、`service/internal/transport/spatialreplicagrpc/`、`service/internal/transport/jsonrpc/spatial_replica.go`、`service/internal/runtime/spatial_replica.go(+test)`
- SDK：`packages/task-sdk/src/spatial-replica-{client,models}.ts` + `packages/task-sdk/test/spatial-replica-*`（5）+ conformance fixture
- Web：`apps/web/src/workbench/agent/spatial/replica-review/`（Pane family）、`apps/web/server/spatial-replica-media-proxy.ts(+test)`、`apps/web/test/spatial-replica-*`（25）、`apps/web/e2e/spatial-replica-*`（6 spec + mount.ts + playwright.replica-performance.config.ts）
- 根测试：`tests/conformance/spatial-replica-transports.test.ts`、`tests/security/spatial-replica-security.test.ts`
- i18n：`api/locale/source/{en-US,zh-CN}/agent/replica-review.json` + catalog 三件
- 文档：`docs/product/spatial-replica-review-workspace.md`、`docs/ui/spatial-replica-review-workspace.md`、`docs/interfaces/spatial-replica-review.md`

既有 tracked 文件的 additive 追加（diff 内 replica 行可辨识）：`agent-pane-manifest.ts`/`agent-pane-registry.ts`（五 Pane 注册）、`apps/web/server/handler.ts`（BFF media route）、`packages/task-sdk/src/{index,http,json-rpc,models}.ts`（export/错误归一化）、`Taskfile.yml`（`test:spatial-replica:component|integration|e2e` 三个 evidence target）、`docs/README.md`（三行索引）。`api/proto/**` 的 agent/spatial append 属合同层波次（0.x/1.x 冻结口径）。

同文件混有并行 lane 编辑（`agent-conversation-workspace`/`daily-ops-pane`/`use-agent-pane-availability` 等）——审阅以 replica 行为界。

## 验收复跑（2026-09-02，定时收口提交 318af5d 后的干净树）
- Go 全量 `CGO_ENABLED=0 go test ./... -p 8`：**exit 0，203 包全 ok**
- bun：typecheck 0 / `bun test` 853 pass 8 skip 0 fail / build 0 / `test:contract` 0
- apps/web：build 0；vitest **194 文件/1644 测试全绿**+server 153/153（一次全量出现 1 个顺序型 flake `agent-conversation-workspace › restores historical unknown_accept`，隔离复跑 92/92 绿、全量复跑 1644/1644 绿，判负载 flake 非回归）
- buf lint 0；`buf generate` 后 service/gen **零漂移**（byte-identical）
- three chunk budget：failures=[]，threeInStaticImportGraph=false
- evidence 新 run-id：component `20260902022214-1d87bdd2`、integration `20260902022301-2e8fafbe`、e2e `20260902022347-a74332a1`（均 exit 0）；全量 web:e2e `20260902022528-6f41e777`（184 passed/11 skipped/7 failed——7 个失败逐一定位均非本 change 面：agent-direct-panes×2=daily-ops 8.3 palette 翻转与 CLI 可用性翻转后旧断言未同步；agent-first×3=agent-route 桌面模式条与 conversation-header 的 Conversation 文本重复；agent-pi-workspace×2=rail 在制品；归属各自在途 lane 的收口任务）
- `openspec validate --strict` valid；全仓 `--all --strict` 60/60
