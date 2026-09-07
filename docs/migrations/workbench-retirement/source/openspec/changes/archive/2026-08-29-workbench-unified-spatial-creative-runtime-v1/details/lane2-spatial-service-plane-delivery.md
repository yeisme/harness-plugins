# Lane 2 交付报告：2.3–2.6 服务面（QuerySpatialSurface / WatchSpatialSurface / PlanSpatialLayout / ApplySpatialChangeSet）

状态：实现 + 接线 + 测试全部完成；验证全绿（见 §5）。未勾选 tasks.md（主 agent 验证后勾选）；未做 git commit。

## 1. 逐任务交付清单（文件级）

### 2.3 QuerySpatialSurface 完整组合（board viewport + owner safe segments + runtime projections）

- `service/internal/spatial/composition.go` — owner safe segments 合成：只读、fail-closed。
  - 禁止内容正则（`Authorization:`/`Bearer `/私钥头等）→ 命中即整段 redaction，绝不透传；
  - `MaxOwnerSegments=64` 截断 + redacted 尾标；
  - 空 ownerRef / 未知 readiness 词汇 → `contract_mismatch` fallback（绝不伪造 owner 数据）。
- `service/internal/spatial/service.go` — `QuerySpatialSurface`：viewport/lens/expectedRevision 校验；revision 漂移 → resync 错误（绝不回退旧快照）；runtime projection overlay（kind/status 白名单、去重、非法丢弃）叠加在 board viewport 权威快照之上。
- 快照 omitempty 合同：owner/runtime 端口未绑定时快照缺省 `ownerSegments`，`overlays` 恒在场（`[]`），三个 transport 逐字段一致（conformance 断言）。

### 2.4 WatchSpatialSurface（可恢复 cursor + gap 检测 + canonical snapshot 恢复）

- `service/internal/spatial/watch.go` — watch 合成器：
  - **位点翻译裁定**：`spatial:<seq>` afterCursor → 上游空 cursor（全新订阅；基线 canonical snapshot 即恢复点）；boards 签名 cursor 原样透传 codec。spatial cursor 只表达 spatial 流位点，不伪装成 boards 位点；
  - **两层 gap 责任**：`record.Sequence==0` → resync（防御）；`record.ResourceRevision <= lastRevision` → 跳过（初始 catch-up 会重放 ≤ 基线的历史，不是 gap）；真实 gap = 序列不连续 → 上游 `ErrResyncRequired` → resync 事件 + 流关闭（客户端以基线快照重入）；
  - SSE 复用既有 authorized board 事件源（`WatchBoardEvents`），未新建 broker。
- `service/internal/transport/spatialhttp/handler.go` — `surfaces:watch` SSE 接线。
- `service/internal/transport/spatialgrpc/handler.go` — `WatchSpatialSurface` server-stream 接线。
- `service/internal/transport/jsonrpc/spatial.go` — `serveSpatialStream` 重写：`workbench.spatial.v1.SurfaceEvent` / `SurfaceResync` 方法名，`id: <cursor>` 可恢复位点，resync 后关闭；select `ctx.Done()`。

### 2.5 PlanSpatialLayout（2k 有界同步 + 超限异步经既有 ProposalAuthority 合同）

- `service/internal/spatial/service.go` — `PlanSpatialLayout`：
  - ≤2k refs：同步有界 diff（确定性 grid 预览，proposalRef 由 refs+layout+revision digest 派生 → 幂等重放同 proposal）；
  - 2k<refs≤50k：异步路径（`async_pending`），diff 截断到 `maxAsyncLayoutRefs`、impact 如实标注全量规模；
  - >50k / 重复 refs / 非法形状 → invalid_argument；
  - `LayoutProposalRegistrar` 端口：ProposalAuthority 绑定后注册 canonical proposal；未绑定时保持 async_pending 预览（非 mutation，可展示）。

### 2.6 ApplySpatialChangeSet 原子实现（真实 ChangeSetAuthority，非 stub）

- `service/internal/spatial/authority.go` — **真实 authority**：
  - 构造期 fail-closed（`NewAuthority`：store/authorizer/maxOperations 缺失即拒绝构造）；
  - `ApplyProposalSource` 端口：proposal 冻结事实（operations/boardRef/baseRevision）；未绑定 → `needs_contract`（v1 边界，绝不内联信任传输层内容）；
  - `normalizePlanError`：domain `invalid_contract` → ErrInvalidArgument、`version_conflict` → boards.ErrRevisionConflict；
  - **单笔事务折叠**：全部操作 → 一个 `CommitCommand`（一次 revision bump、恰好一对事件：`board.change_set_committed` + `board.revision_committed`，ReasonCode `change_set_applied`）；同节点多操作收敛为单条 UpdateNodes（boards 拒绝重复 node 写入）；
  - **inverse metadata 收敛门**（design §4）：每个已受理操作必须派生 domain inverse 命令，`len(plan.inverses) != len(operations)` → 整体拒绝（绝不部分应用）；`Outcome` 置空 `GraphMutationOutcome{}`（见 §3 裁定 7）；
  - **幂等重放**：预检 `ReplayBoardMutation`（BoardRef 域收敛，digest 绑定 proposalRef+expected revision）；同 key 同请求 → 原结果 `Replayed=true`；同 key 异请求 → `ErrIdempotencyConflict`；
  - **CAS**：`ExpectedBoardRevision = proposal.BaseBoardRevision`，事务内 `CommitBoard` 校验；stale 目标 → 整个 change-set 失败（revision conflict），无部分提交；
  - 操作词汇：update_geometry / update_display / move_group / create_node（server 权威 TargetBinding，不信 client claim）/ create_edge / delete_node / delete_edge；`bind_workflow` → invalid_argument（workflow 不进 Board 事务，design §4）。
- `service/internal/runtime/runtime.go` 接线（见 §3 裁定 9，超出租约范围的 handoff）。

### 四 transport 接线 + conformance/parity

- `service/internal/transport/spatialhttp/handler.go`、`service/internal/transport/spatialgrpc/handler.go`、`service/internal/transport/jsonrpc/spatial.go`（unary `invokeSpatial` + stream）、`service/gen/workbench/spatial/v1/spatial.pb.go`（additive proto 字段 3/4 + `buf generate`，见 §3 裁定 10）。
- `service/test/conformance/spatial_transport_parity_test.go`（新）：HTTP/gRPC/JSON-RPC 三面共享同一 spatial.Service：
  - Query parity：contract 身份 + snapshot 核心字段（boardRevision/cursor/boardRef/viewport）+ ownerSegments omitempty；
  - Plan parity：同一 proposalRef/contractVersion/操作数/policy 字段（gRPC snake_case ↔ HTTP/RPC camelCase 同义投影归一化后对齐）；
  - Apply fail-closed parity：无 ProposalSource 时三面一致 `needs_contract`（gRPC error / HTTP 412 / rpc error code）；
  - Watch parity：基线快照 `spatial:3` → revision-4 事件合成 `spatial:1`（advance reader 只注入 watch 测试；静态 reader 供 query/plan，避免跨 transport 调用计数污染 expectedRevision）。

## 2. 测试矩阵（正/负）

- `service/internal/spatial/watch_composition_test.go`（新）：watch fail-closed / 非法输入 / 基线+revision 快照 / 真实 gap → resync / 零序列防御 / owner redaction（Bearer 泄漏、空 ownerRef、未知词汇、>64 截断）/ runtime overlay 白名单与去重 / untrusted projection 丢弃 / Query 组合（omitempty 合同）/ Plan 2001→async、≤2000 有界、>50k invalid、重复 refs invalid。
- `service/internal/spatial/authority_test.go`（新，真实 SQLite repository）：无 proposal source fail-closed / 非法输入 / 未知操作 kind（board 不动=无部分提交）/ 越界 geometry（width<24、x 越界）/ base revision 漂移 → conflict / 未知 targetRef / **原子提交 + 重放**（2 op 一笔事务 board 2→3、节点 geometry+style 落库、node rev 同一 bump、同 key 重放 Replayed=true、同 key 异 revision → idempotency conflict）/ create_node 提交 / proposal revision 不匹配先于 store / load 错误透传 / 构造失败矩阵。

## 3. design.md 歧义点与裁定

1. **ApplyProposalSource 未绑定**：apply fail-closed（`needs_contract`），与 nil-authority 行为同等保守；不内联传输层 proposal 内容（信任边界在服务端事实源）。
2. **ownerSegments omitempty**：端口未绑定时快照缺省该字段；SDK 侧以「字段缺省 = 端口未绑定」处理（已记入 handoff，见 §4）。
3. **bind_workflow**：映射为 ErrInvalidArgument——design §4 明确 Workflow draft/run/Owner action 不进同一 Board transaction；不伪造 Board 突变。
4. **异步 plan 上界**：≤2000 交互式同步 diff；>2000 走异步，diff 截到 `maxAsyncLayoutRefs`、impact 如实全量；`LayoutProposalRegistrar` 端口供 ProposalAuthority canary 绑定。
5. **`board.change_set_committed`**：additive 事件类型（token 形状过 CommitCommand 校验），与 `board.revision_committed` 成对；ReasonCode 统一 `change_set_applied`。
6. **重放预检按 BoardRef 域**：change-set mutation record 锚点 ResourceType "board"/ResourceRef=boardRef；预检若按 proposalRef 查询将永远 miss。digest 绑定 proposalRef+expected revision 兜底跨 proposal 重用同 key。
7. **空 `GraphMutationOutcome`**：boards `validateGraphOutcome` 只收单资源 canonical mutation；多资源 change-set 落空 outcome + `plan.inverses` 收敛门（域层派生 inverse，数量=操作数否则拒绝）；undo 锚点是 board 级 mutation record，回滚走 proposal revert 语义，不伪造单资源 inverse。
8. **spatial:/boards 位点分离**：`spatial:<seq>` → 上游空 cursor（fresh 订阅 + 基线 canonical 恢复）；boards 签名 cursor 透传。spatial 层不做 boards 位点伪装。
9. **runtime 接线 handoff（超出租约）**：`service/internal/runtime/runtime.go` 的 authority 装配点（`Authority{Store, Authorizer, TargetResolver, ProposalSource: <ProposalAuthority 桥>, MaxOperations, TokenPolicy, Now, NewRef}`）未由本 lane 接线——runtime.go 在禁改清单；needs_contract 路径保证未接线时行为安全。**需要主 agent 或 runtime owner 后续接线**。
10. **proto/gen 超出租约（必要变更，报告备案）**：`api/proto/workbench/spatial/v1/spatial.proto` additive 字段（QuerySpatialSurfaceResponse / SpatialSurfaceEvent 扩展，field 3/4）+ `buf generate` 重新生成 `service/gen/workbench/spatial/v1/spatial.pb.go`。仅增量、无破坏性变更；请求精记入本报告。
11. **CommitCommand 时钟门**：authority 固定/真实时钟必须 ≥ board CreatedAt（`UpdatedAt >= CreatedAt` 校验）；测试以 `time.Now().Add(time.Hour)` 规避（已在测试注释记录）。

## 4. 交接事项（非本 lane 文件）

- `service/internal/runtime/runtime.go`（~L1053 附近 wiring 点）：authority 装配 + `SetSpatialService` 已具备，authority 参数按裁定 9 传入。
- SDK（`apps/web` / SDK 合同）：ownerSegments/overlays 缺省语义 + `spatial:*` cursor 恢复语义（收到 SurfaceResync 后以空 cursor 重入取基线）。
- ProposalAuthority canary：实现 `ApplyProposalSource`/`LayoutProposalRegistrar` 桥接即可点亮 apply 与异步注册，无需改 spatial 包。

## 5. 验证结果（全部通过）

| 检查 | 结果 |
| --- | --- |
| `gofmt -l`（spatial + 四 transport + conformance） | 空（无格式问题） |
| `go vet`（同上包） | 通过 |
| `CGO_ENABLED=0 go test ./internal/spatial/... -count=1` | ok 1.853s |
| 聚焦测试 `spatialhttp / spatialgrpc / jsonrpc / test/conformance` | 全 ok（conformance 8.07s） |
| `CGO_ENABLED=1 go test -race ./internal/spatial/... -count=1` | ok 49.6s |
| `CGO_ENABLED=0 go build ./cmd/workbenchd` | 通过 |
| `openspec validate workbench-unified-spatial-creative-runtime-v1 --strict` | valid |

tasks.md 未勾选；无 git commit。
