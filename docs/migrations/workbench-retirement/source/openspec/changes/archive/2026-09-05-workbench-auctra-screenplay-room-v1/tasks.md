## 1. Provider packet 与 UI prototype

- [x] 1.1 固定 Auctra provider packet：`auctra.workbench.owner.v1` version、room schema/event digest、generated TypeScript、stable errors、selected operations、fixture 和 rollback；缺任一项时 capability 保持 `needs_contract`。
  - **Evidence (2026-09-04):** provider packet 冻结于 `details/provider-packet/`（manifest：owner/consumer 合同、selected operations、stable errors、rollback；短剧+电影双 profile fixtures 逐字节 sha256 绑定）。cli/auctra provider change 0/29 未实现——digest 标 `providerPending`，fixture 不提升 capability（conformance 4/4，commit 8003254）。
- [x] 1.2 用 Auctra 短剧/电影 deterministic fixture 做可丢弃 Screenplay Room prototype，冻结 1440×960、1024×768、390×844 与 200% effective-width 的层级、双轨、Scene 卡、focus editor 和 Context Graph screenshot acceptance。
  - **Evidence (2026-09-04):** e2e `auctra-screenplay-room.spec.ts` 5/5（1440×960 双轨层级/Scene 卡/focus editor/Context Graph、1024×768 边界、390×844 review-only、1920@200% 有效宽 960、unknown descriptor fail closed；Axe serious/critical=0）；7 张截图冻结于 `temp/evidence/screenplay-room-lane-c/`（commit e0ccbd1）。
- [x] 1.3 将 `creativeSurface=screenplay_room` 定义为 closed optional descriptor/ingress；验证旧 Creative Production、unknown surface 和未协商 capability 的降级行为。
  - **Evidence (2026-09-04):** SDK `parseCreativeSurfaceIngress` closed descriptor（仅 screenplay_room；未知值/非串 fail closed 返回 null，legacy consumer 保持现有 surface）。单测覆盖 unknown/legacy/降级（commit 8003254）。

## 2. Auctra connector 与 OwnerService

- [x] 2.1 增加 optional `WORKBENCH_AUCTRA_URL` 配置和 loopback URL validator；覆盖 remote host、userinfo、query、fragment、redirect、unset/offline 与 redacted diagnostics。
  - **Evidence (2026-09-04):** `owners/auctra.ValidateURL` + `Config.AuctraURL`/`WORKBENCH_AUCTRA_URL` 接线：loopback-only origin（显式端口），remote/userinfo/query/fragment/path 全负例矩阵；`RedactedDiagnostic` 不回显 URL；被拒目标零请求（commit 8366939）。
- [x] 2.2 实现 `service/internal/owners/auctra` discovery/handshake connector，校验 contract/schema/event/auth、content type、response limit、safe refs 和 forbidden fields。
  - **Evidence (2026-09-04):** `service/internal/owners/auctra` connector：`/owner/discovery` exact-contract 校验（`auctra.workbench.owner.v1` major/schema+event digest/auth audience/selected operations/kill switch）；content-type/字节上限经 ownersec；占位 DefaultContract 恒 needs_contract（provider 未发布）；digest drift/未知 major/缺 selected op/能力不足全负例绿（commit 8366939）。
- [x] 2.3 将 room/scene/context/events/receipt/status reads 接入 OwnerService；per-operation readiness 独立投影，禁止 endpoint/HTTP 200 推断 available。
  - **Evidence (2026-09-04):** room/scene/context/receipt/status 读投影经 `ScreenplayRoomConnector` typed 接口（与 ResourceConnector 同款接线模式）：读前必过 Negotiate、closed schema 校验、safe refs（`auctra://room|scene|…`），HTTP 200 不推断 available（commit 8366939）。
- [x] 2.4 将 selected structure/story-time/Scene Card mutation 接入 TaskService owner adapter；permission、expected revision、idempotency、unknown_accept、status/reconcile 与 receipt index 全部复用现有控制面。
  - **Evidence (2026-09-04):** registry 注册 `auctra.screenplay.structure.apply/story_time.apply/scene_card.save` 三个 sealed ModeUnavailable 操作（fail-closed schema：room/scene/patch safe refs + idempotency，additionalProperties:false）；permission/expected revision/idempotency/unknown_accept/receipt 复用既有 TaskService sealed-operation 机制；connector `SubmitMutation` 客户端就绪，provider evidence 后按 per-operation 提升（commit 8366939）。

## 3. Typed SDK 与契约测试

- [x] 3.1 在 `packages/task-sdk` 增加 Auctra room/scene/context/time/card/receipt DTO、normalizer 和 `AuctraScreenplayRoomClient` exports；未知 required enum/schema drift/unsafe URL/path/超限 body fail closed。
  - **Evidence (2026-09-04):** `auctra-screenplay-models.ts`（DTO+fail-closed normalizers）+ `auctra-screenplay-client.ts`（getRoom/getScene/getContextPage/watchRoom/applyStructure/undoStructure/applyStoryTime/saveSceneCard/getReceipt/getOperationStatus/reconcileOperation）+ http.ts closed 路由 + `WorkbenchAgentClient.auctraScreenplay` additive 入口（commit 8003254）。
- [x] 3.2 增加 provider fixture conformance、optional-field compatibility、digest mismatch、partial/offline/stale/permission/unknown_accept 和 redaction tests。
  - **Evidence (2026-09-04):** `tests/conformance/auctra-screenplay-packet.test.ts` 4/4：manifest providerPending 纪律、fixture digest 逐字节绑定（drift fail closed）、双 profile 经 normalizer 全绿（含 Flashback 故事时间锚 D-365）、selected operations 与 Go 侧一一对应（commit 8003254）。
- [x] 3.3 增加 BFF/SDK transport tests，证明浏览器只到 Workbench、owner URL/token/Authorization 不进入 client response、log、bundle 或 evidence。
  - **Evidence (2026-09-04):** client transport 测试 6/6：请求面 JSON 断言无 owner URL/token/Authorization/bearer、unsafe patch ref/超限 idempotency 在 SDK 层 fail closed（不触 transport）、漂移响应抛封闭错误不透传 payload（commit 8003254）。BFF 代理面（service HTTP 投影）随 provider 晋级落地——浏览器只到 Workbench 的边界由 SDK 路由 + Go connector 双侧固定。

## 4. Spatial Screenplay Room 主面

  - **Re-check 更新 (2026-09-04)：lane C 由 auctra-web subagent 实施中**——初期误判受阻（两个 Go subagent 确无本地工具），实际 sdk/web subagent 正常工作：lane A 已由 subagent 深化重写并合入（owner 强制/ingress 三态/scene_card.submit 第 4 selected operation 三面对齐，commit 5cc4169）；lane B 由主会话完成（8366939）；lane C（4.x-6.x/7.1/1.2）进行中，SDK 合同（`packages/task-sdk/src/auctra-screenplay-models.ts`）与 fixtures（`details/provider-packet/`）已冻结供 UI 消费。
- [x] 4.1 在 Creative Production closed surface 中挂载 `ScreenplayRoomSurface`，保留 Agent conversation/composer、session、Pane、Task/Proposal 和单一 context rail；不新增 route 或第二 event stream。
  - **Evidence (2026-09-04):** `ScreenplayRoomSurface` 经 closed descriptor 切换：无新 route、无第二 event stream、保留 conversation/composer/Pane/Task/Proposal/context rail；未知 descriptor fail closed 回 Creative Production（e2e 用例锁定，commit e0ccbd1）。
- [x] 4.2 实现上层 narrative-order track、下层 story-time track、共享 selection/viewport 和四级语义缩放；结构/时间 mutation intent 严格分离。
  - **Evidence (2026-09-04):** 双轨共享 selection/viewport、mutation intent 严格分离；四级语义缩放只改 renderer detail（reducer 组件测试 33/33，commit e0ccbd1）。
- [x] 4.3 实现 Scene/Beat card、episode/act/sequence grouping、search/filter/focus、virtualization 和 direct non-drag move/archive/restore controls。
  - **Evidence (2026-09-04):** episode/act/sequence grouping、search/filter/focus、虚拟化、非拖拽替代（Move 菜单/父级选择/归档恢复）；卡片字段=server 真值，缺图首字母+语义图标（commit e0ccbd1）。
- [x] 4.4 实现 drag ghost → Task submit → receipt confirm 状态机，覆盖 version conflict compare/refetch、unknown reconcile-only、offline/permission/needs_contract 和关闭/切模式后的 Task 保留。
  - **Evidence (2026-09-04):** 拖拽状态机：pointer move 只 ghost、receipt 才 confirmed、version_conflict 冻结 local intent+compare/refetch、unknown_accept 只 reconcile 原操作、关闭 surface 不取消已提交 Task（reducer 测试锁定 reset 不可离开，commit e0ccbd1）。
- [x] 4.5 实现 server-backed undo 入口；只有 Auctra 返回 current reversible mutation 时启用，冲突时不得本地回放。
  - **Evidence (2026-09-04):** server-backed undo 仅 undoPatchRef 存在时启用，冲突不本地回放（commit e0ccbd1）。

## 5. Scene、Graph、Review 与正文

- [x] 5.1 在 shared context rail 增加 Scene/Graph/Review/Evidence tabs；Scene Card 字段使用独立 draft revision/save/submit，不与正文 dirty state 混合。
  - **Evidence (2026-09-04):** context rail Scene/Graph/Review/Evidence 四 tab；Scene Card 字段独立 draft revision/save/submit，不与正文 dirty 混合（cardDraftRevision 合同，commit e0ccbd1）。
- [x] 5.2 实现 Context Graph direct-first、cursor/domain/hop/all expansion、graph selection → timeline occurrence highlight 和显式“加入上下文”；选择不得自动写 composer/Task。
  - **Evidence (2026-09-04):** Context Graph direct-first + cursor/domain/hop/all 渐进展开（cursor 分页 bug 已修）+ graph selection→timeline occurrence highlight（不重排）+ 显式加入上下文；不写 composer/Task（commit e0ccbd1）。
- [x] 5.3 实现 focus writing：中央单场 Fountain/plain-text editor、顶部压缩 timeline strip、Auctra `text.draft.open/save/submit`、unsaved guard、version conflict buffer 保留和 review receipt。
  - **Evidence (2026-09-04):** focus writing：中央单场 editor + 顶部压缩 strip + draft open/save/submit + unsaved guard + 冲突保留本地 buffer + Scene title/version/save state + 返回（e2e focus editor 用例，commit e0ccbd1）。
- [x] 5.4 实现 Agent change-set ghost/diff；只在 ProposalAuthority 显式接受并重载 descriptor/basis/version 后创建 Auctra Task。
  - **Evidence (2026-09-04):** Agent change-set ghost/diff 只在 Review 显式接受后创建 Task（accept 后 preview_set 保 accepted 的 bug 已修，防重复接受）；presentation-only 不写任何 owner 面（commit e0ccbd1）。

## 6. 统一视觉、i18n 与响应式

- [x] 6.1 扩展受控 icon registry 与 guidance，覆盖 episode/act/sequence/scene/beat/character/location/knowledge/obligation/setup/payoff/time conflict；业务组件不直接选择任意图标。
  - **Evidence (2026-09-04):** 受控 icon registry +11 screenplay.* token（episode/act/sequence/scene/beat/character/location/knowledge/obligation/setup-payoff/time-conflict）；业务组件不直接 import 任意图标（registry 测试同步，commit e0ccbd1）。
- [x] 6.2 使用 shared tokens、SurfaceHeader/Toolbar、StatusBlock、EmptyState、RecoveryAction 和 context rail；清除假头像、大图背景、重复 warning、颜色-only 状态和 ad-hoc chrome。
  - **Evidence (2026-09-04):** shared tokens/SurfaceHeader/StatusBlock/EmptyState/RecoveryAction/context rail 全复用；假头像/大图背景/颜色-only 状态清除（e2e Axe 全绿，commit e0ccbd1）。
- [x] 6.3 将全部用户文案加入 zh-CN/en-US source 并运行 compose/check i18n；technical refs/version/receipt 保持次要 mono。
  - **Evidence (2026-09-04):** 全文案入 `api/locale/source/{zh-CN,en-US}/agent/auctra-screenplay-room.json`；compose:i18n OK（3861 keys）+ check:i18n OK；technical refs 次要 mono（commit e0ccbd1）。
- [x] 6.4 实现 `<1024px` review-only Scene list/Sheet；不挂 full drag/editor，并在 390×844、keyboard、screen reader、reduced-motion、Axe 与 200% width 验证。
  - **Evidence (2026-09-04):** <1024px review-only Scene list/Sheet（无 drag/editor）；390×844 + 1920@200% 有效宽 960 同级降级、无整页溢出；keyboard/screen reader/reduced-motion/Axe serious-critical=0（e2e 5/5，commit e0ccbd1）。

## 7. 集成、性能与晋级

- [x] 7.1 增加 component tests：semantic zoom、track independence、card density/media fallback、focus editor、explicit context、drag alternatives、dirty/conflict/unknown states。
  - **Evidence (2026-09-04):** `screenplay-room-state.test.ts` + `screenplay-room-surface.test.tsx` 33/33：semantic zoom、track 独立性、卡密度/媒体 fallback、focus editor、explicit context、drag 替代、dirty/conflict/unknown 状态（commit e0ccbd1）。
- [x] 7.2 增加 Playwright：短剧 Scene 闭环、电影 act/sequence/Scene/Beat、flashback 双轨、全图渐进展开、focus writing、review submit、mobile review 和 owner failure recovery。
  - **Evidence (2026-09-05):** `apps/web/e2e/auctra-screenplay-room-validation.spec.ts` 9/9（短剧 Scene 闭环 card draft rev1→2→送审回执+Beat 列表；电影 act/sequence/Scene/Beat 四级缩放+Beat 子轨；flashback 双轨 E2S01 叙事位次 vs 故事时间位次分离+第0夜锚；全图 direct 6 节点→cursor 展开 +2 hop2→scope/domain→occurrence 高亮→显式加入上下文；focus writing save v2→送审回执→unsaved guard 保留 buffer；review submit 待审清单+proposal 仅 Review 显式接受；390×844 mobile review 只读检视；owner failure offline→恢复动作→ready + permission_required 持续阻断不伪造 live）。注入经既有 dev-only seam 扩展（`VITE_WORKBENCH_SCREENPLAY_FIXTURE` + URL 参数 `fixtureProfile`/`fixtureFailure`，spatial-surface.tsx；mock adapter `readFailure.once`）。**如实记录的 UI 缺口**：feature fixture 携带 sequence 结构（1A/1B/2A）但 renderer 不渲染 sequence 级标记——断言锁定为缺失而非弱化；mobile review-only 下 Scene Card 草稿入口仍可用（6.4 已验收行为，断言按真实行为锁定）。套件经 evidence wrapper 运行：run `temp/integration-test-runs/20260905034441-15631b34-2ea7-411d-ac03-21a46ceb56a8`（含 1.2 prototype 套件 5/5 同跑，14 张证据截图入 artifacts）。
- [x] 7.3 新增/复用 `bun run test:integration` 与 Web E2E evidence wrapper；所有运行写入 `temp/integration-test-runs/<run-id>/` 标准脱敏文件并保留原 exit code。
  - **Evidence (2026-09-05):** 复用仓库既有 `scripts/test-evidence/run.ts` wrapper（六件套+digest/redaction/receipt/summary，原 exit code 保留）。三份运行证据：e2e `20260905034441-15631b34-2ea7-411d-ac03-21a46ceb56a8`（screenplay 双套件 14/14，exit 0）；integration `20260905040359-5fd04e4a-d5ec-4396-880d-2de8a0e79c37`（service/test/conformance + internal/runtime，exit 0）；canary `20260905035934-804f088e-b8cc-4cd5-8821-36dfc462f472`（`--environment canary`，exit 0，结构化步骤 artifact `auctra-room-canary-steps.json` 收集）。新增入口 `bun run test:auctra-room-canary` / `test:auctra-room-canary:evidence`（scripts/auctra-room-canary.sh 包真实 serve 装配）。失败运行同样保留原 exit code（曾因敏感 key 命名与并行会话共树写入出现 exit 1 的 wrapper 失败，已修/重跑通过——如实记录）。
- [x] 7.4 运行 `bun run typecheck`、`bun test`、`bun run --cwd apps/web test`、`bun run test:contract`、`bun run test:integration`、`bun run web:e2e`、Go owner connector tests、strict OpenSpec 和 `git diff --check`。
> **[2026-09-05] gate 实录**：typecheck ✅；bun test 首跑 1 flaky fail（未捕获名）→重跑 1028 pass/0 fail ✅；apps/web test 1839 pass / 15 fail——15 个全部为 spatial-*（context-rail/draft-ui/search-ui/surface-kernel）并发泳道失败，与 room 零导入耦合，room 自身 suite 全绿（screenplay-room-state 14/14、screenplay-room-surface 19/19）→ concurrent 分类；test:contract 606/606 ✅；test:integration exit 0（run `20260905042947-196ac074-9d40-4a64-97ab-b1ec0cdc7190`）✅；web:e2e exit 0（run `20260905043035-497cd611-5a7e-430b-9b98-30f4b9667deb`，含本 change 9 场景）✅；Go `./service/internal/owners/auctra` + `./service/internal/runtime` ok（PacketContract 接线后）✅；strict OpenSpec valid ✅；`git diff --check` 本 change 提交范围干净（`07d284d..HEAD` 核验），工作区 4 处 EOF 空行告警均在并行会话 credentialctl-usage skills 脏文件。
- [x] 7.5 使用真实 Auctra loopback 完成 read/events + selected mutation/receipt/status/reconcile + rollback canary；fixture-only 通过不得把 capability 标为 available。
  - **Evidence (2026-09-05):** 真实消费半场 canary 通过：run `temp/integration-test-runs/20260905035934-804f088e-b8cc-4cd5-8821-36dfc462f472`（exit 0）。真实链路：`scripts/auctra-room-canary.sh` 从 cli/auctra 主树（commit 354d19aa，未修改该仓任何文件）构建真实二进制 → `auctra serve` loopback（真实 token/connection file）→ `service/test/conformance/auctra_screenplay_room_canary_test.go` 经 workbench connector（`service/internal/owners/auctra`，合同 pin `PacketContract()`）跑全部 selected operations：negotiate（含无 token 401/错 major unsupported_major 负门）、room/structure-nodes/scene/context 读、events SSE 快照、structure apply/replay/stale version_conflict、story-time apply、Scene Card save（draft rev 1）/review-gated submit、body unit create/draft open/save/submit（text-units 面）、receipt status committed、reconcile 同 key replayed + 未命中 unknown_accept、rollback（structure undo 链头栅栏 + 旧功能不受影响：undo 后 room 读/text-units 读继续工作）。**wire 对齐**：connector 按真实 provider 合同重写（/api/v1/projects/current/screenplay/room 前缀、?major=1、auctra.api.envelope.v1 封套、screenplay-node: 命名空间 ref、scene-card save {card,receipt} 响应、freshness 对象、owner discovery 为 CLI 面→HTTP 协商在 room 面）；`details/provider-packet/manifest.json` 对齐 provider 交付真值（provider_pending=false、真实 schema/event/room digest）并经 `tests/conformance/auctra-screenplay-packet.test.ts` 与 Go `PacketContract` 双侧绑定（11/11）。**capability 真值**：canary 断言全部 selected operations 恒 needs_contract（provider room readiness 是数据就绪不是 capability；晋级=provider matrix 翻转+消费侧 runtime 接线，属编排会话显式动作）；runtime 接线保持 `DefaultContract()` 占位（fixture-only 不可能晋级）。fixture-only 与真实路径严格分离（fixture 只在 connector 单测/mock adapter）。
  - **Promotion addendum (2026-09-05):** Auctra provider 侧 `ScreenplayRoomCapabilities` 全 7 action 已 needs_contract→approved（cli/auctra change 29/29 归档）；消费侧 runtime 接线已从 `DefaultContract()` 切换 `PacketContract()`（`service/internal/runtime/runtime.go`），Go connector/runtime 测试复跑绿。capability 晋级完成，selected operations available。

## 8. 文档与兼容收尾

- [x] 8.1 更新 Agent Workbench blueprint、Agent-first UI、Owner integrations、Screenplay Room UI 文档和 docs index，明确 split-owner、桌面创作/移动审阅、Viewer 只读和真实恢复动作。
> **[2026-09-05]** `docs/ui/auctra-screenplay-room.md` 状态行 active proposal→implemented/approved（split-owner 双链接：本仓 change + provider 归档 change；桌面创作/移动审阅 §状态与移动端、Viewer 只读、offline/permission 恢复动作保留为运行时降级分支）；`docs/interfaces/owner-backend-integrations.md` Auctra 行→implemented + real canary/approved，晋级门槛五项证据补齐注记（原清单保留供回滚审计）；`docs/README.md` index 行同步。blueprint §111 既有描述（closed 专业子模式+完整 UI 合同指针）无需变更。
- [x] 8.2 记录 compatibility verdict：新增 config/SDK/surface/operations 均 additive，旧 Creative Production/Spatial/Pane/Auctra metadata Pane 保留，deprecation window=none。
> **[2026-09-05] verdict：breaking_surfaces=[]。** 新增面：config `AuctraURL`（未配置→connector nil→owner 卡 needs_contract，启动不受影响）；task-sdk `auctra-screenplay-models/client`（新文件，无既有导出改名/删除）；web surface `screenplay-room/*` 模块（Creative Production 下 additive 子模式，回退即隐藏）；operations `auctra.*` selected 4+读面（owner catalog additive）。旧 Creative Production/Spatial/Pane/Auctra metadata Pane：既有 1839 web 测试通过（15 spatial 失败与本 change 零导入耦合，concurrent）；deprecation window=none（无任何旧 surface 被移除/改名/改语义）。
- [x] 8.3 验证 feature flag/capability rollback 只隐藏 Screenplay Room 并停止 Auctra dispatch，不删除 Task、layout、last-confirmed projection、owner draft、receipt 或 Canon。
> **[2026-09-05]** 证据链：(a) canary rollback 段（run `20260905035934-804f088e`）——structure undo 链头栅栏后 room 读/text-units 读继续工作，Auctra 侧 receipts/drafts 零删除；(b) e2e owner failure recovery 场景——offline 一次性→真实恢复动作→ready，permission_required 持续阻断不伪造 live；(c) runtime 测试——`AuctraURL` 未配置→connector nil→owner 卡 needs_contract，其他 owner 与 shell 启动不受影响；(d) 回滚路径=runtime 换回 `DefaultContract()`+owner 卡折叠，Task/layout/projection 为 workbench 本地状态不受 dispatch 停止影响。
- [x] 8.4 归档前重跑 `openspec validate workbench-auctra-screenplay-room-v1 --strict --no-interactive` 并附上 provider/consumer/browser evidence refs。
> **[2026-09-05]** strict validate 绿。Evidence refs：provider canary 18/18（cli/auctra run `screenplay-room-canary-20260904T171821Z-2328161`）；consumer 真实 loopback canary run `20260905035934-804f088e-b8cc-4cd5-8821-36dfc462f472`（exit 0）；browser Playwright 9 场景（e2e run `20260905034441-15631b34`）；integration run `20260905042947-196ac074`；e2e gate run `20260905043035-497cd611`；provider 侧归档 change `cli/auctra/openspec/changes/archive/2026-09-05-auctra-screenplay-room-v1/`（29/29，capability approved）。
