# 9.3 独立审阅报告：correctness / security / accessibility / performance

日期：2026-09-01。审阅者：独立 review 会话（与实现波次不同会话，零实现提交）。
审阅对象：`details/09-closeout-evidence.md` §7 冻结的稳定 diff 范围（64+ replica 命名新增面 + 3 文档 + tracked additive 行）；同文件混编的并行 lane 行（agent-conversation-workspace / daily-ops-pane / use-agent-pane-availability 等）按边界跳过。
结论先行：**五个重点检查面全部通过；四维抽查未发现 P0/P1；3 个 P2 记录为 follow-up（含 owner 与去向），若干 P3 观察记录在案。9.3 可勾选。**

审阅方法：逐面读源码（非只读测试断言）+ 交叉核对 spec delta（`specs/spatial-replica-*/spec.md`）+ 复跑 scoped 测试确认稳定 diff 现态绿（见 §5）。`grep` 证伪式扫描：replica 源内零 `localStorage/sessionStorage/IndexedDB` 写入、零 `fps`/`time×帧率` 乘法路径。

## 1. 五个重点检查面

### 1.1 no-fourth-state — PASS

- 浏览器 state 严格七键白名单：`apps/web/src/workbench/agent/spatial/replica-review/replica-workspace-state.ts:66-74`（`pts/overlayVisibility/camera/selection/expandedGroups/viewLayout/draft`），runtime 守卫 `isReplicaWorkspaceState`（:198-207）对白名单外顶层键返回 false；未知 action 一律 no-op（:188-191）。draft 是 ephemeral typed 结构（:45-56），仅 session memory。
- reducer 清理语义符合设计：`shot/switch` 清 per-shot 派生态（:175-185）、`session/resetAll` 全清（:186-187）；draft 相关代码零持久化（`replica-action-controller.ts:2` useState 承载；grep 全目录无 storage API 调用）。
- 服务端 composition 是可重建 read model：`service/internal/spatialreplica/composition.go:18-20`（无持久化、无 canonical repository）；cache 是内存 LRU+TTL+generation fence（`cache.go:38-127`），重启/驱逐只丢 cache 不丢 canonical（`cache.go:15-18` 注释 + `Get` miss/expired/stale-generation 一律 nil 重 compose，:68-81）。`Service` 结构无 DB/repository 字段（`service.go:17-33`）；mutation 全部经 `ActionSubmitPort` 路由回既有 TaskService（`actions.go:218-227`），不自建第二套 task 通道。
- 无 migration：`cache`/`media`（`media.go:57-85` 内存 registry）/`workspaceShots`（`service.go:30-31` 内存 map）全部内存态；rollback 语义由 `RefreshCapabilities`/`Shutdown`（`service.go:122-151`）只做失效收敛，capability off 不删任何 canonical 数据。

### 1.2 single-stream — PASS（含 1 个 P2 follow-up，见 §3）

- 每 workspace 至多一个 browser stream：模块级 controller map 去重（`replica-projection.ts:223-241`），重复 `start` 返回既有 controller 不新增连接；主 Pane 是唯一 stream owner（`replica-review-pane.tsx:156-173`，`streamArmed` 只在 ready 相位启动，卸载 stop）。
- 五 Pane 共享同一 query key 工厂（`replica-projection.ts:26-29`，tenant/workspace 分域）：主 Pane 与四个辅助 Pane（`replica-owner-pane-shell.tsx:66-74`）读同一 key；auctra pane 无 shot 参数时从共享缓存解析 shot 而非二次读取（:39-56）。Inspector/Auctra/Scaena/Receipts pane 零 `watchWorkspace` 调用（grep 证实仅主 Pane 一处）。
- 服务端单 workspace log/pump：`stream.go:17-19`（连接数不随 Pane/owner 增长）；`TestStreamSingleLogPerWorkspace`（`stream_test.go:250`）断言。workspace cursor 与 owner cursor 分列（envelope 结构 + `stream.go:19-21`），不声称全局 exactly-once（receipts pane 行模型 `owner-receipts-pane.tsx:33-60` 显式 sequence gap/late marker）。
- resync envelope 只触发 snapshot 重取（invalidate），不猜测缺失状态（`replica-projection.ts:204-220` + 组件测试 `spatial-replica-pane.test.tsx:100-141`）。

### 1.3 exact PTS — PASS

- 有理数精确比较全 BigInt 交叉相乘 + gcd 约分（`replica-pts-map.ts:27-98`）；`replicaPtsEquals` 做 timescale 归一化相等（:96-98）。浮点秒仅显示/seek（:101-115），帧身份永不来自浮点。
- 无 time×fps 路径：grep 全 replica 源零 `fps`/帧率乘法；`mediaSecondsToPtsTarget`（:111-115）是秒→tick 的单位换算且产物必须再过 `lookupReplicaFrameAt` 解析 exact frame（player controller `replica-player-controller.ts:185-193` 注释与调用链证实）。
- VFR/cut/gap 显式成段：`createReplicaPtsIndex`（:180-248）把 discontinuity 声明覆盖的 segment 分类为 gap、段间洞 snap 到下一 content start（:205-215）、duplicate/零宽 interval 不虚构时长（:217-219）、超出 owner 声明范围停止累积（:220-223）、不可表示 rational fail closed（:227）。
- lookup 三态 frame/gap/unverifiable（:251-294），帧间洞不猜最近帧（:289-292）；端点约定显式（duration 端点=最后一帧，:259-264）。frame step 用 exact 相邻帧（:300-338）。
- 使用点核对：confirmed 帧回调对齐到解析帧 exact 起点、requested 不当 evidence（`replica-player-controller.ts:135-168`）；rVFC 不可用进受控 fallback 且恒 `requested` + `sync_degraded`（:195-208）；timeline 事件 identity 用 eventRef+归一化 PTS（`replica-timeline.ts`，4.4 证据复述）；对象/layer coverage 判定同样走 BigInt 比较（`replica-overlay-registry.ts:202-209`、`replica-viewport-region.tsx:490-507`）。

### 1.4 unknown preservation — PASS

- 浏览器：transport 失败/response loss → `unknown_accept`，绝不推断成功或失败、保留 idempotency key、只允许 reconcile 原 task+原 key、不自动 retry 不换 key（`replica-action-controller.ts:153-163`）；reconcile 失败保持 unknown 可再查（:188-191）；无 taskRef 时诚实无法收敛（:169-171）而非伪造。非 terminal（submitting/accepted 未收敛/duplicate/unknown）期间等价重提被阻止（:51-58 + `pendingFor` :101-104）。
- 服务端：`ErrUnknownAccept` → `UNKNOWN_ACCEPT` status + reconcile recovery hint（`actions.go:229-236`）；duplicate → `DUPLICATE` + existing task ref（:238-244）；reconcile 只查原 idempotency/Task、不生成新 mutation、且不受 capability off 影响（rollback 语义，:263-292）；`TestExecuteActionUnknownAcceptMapping`/`TestReconcileActionMapsTerminalStatus`（`action_test.go:106/120`）覆盖。
- 不伪终态：服务端 ExecuteAction 永远基于重 compose 的 current descriptor revalidation（绕过 cache，`actions.go:151-165` + `TestRevalidateActionFenceBypassesStaleCache` :166）；composition_token 只做 stale detection（`composition.go:346-347` + `TestTokenStaleDetectionOnly` :200）。receipts pane gap/late 后受影响 terminal state 保持 unknown（`owner-receipts-pane.tsx:1-8`）。

### 1.5 owner boundary — PASS

- capability truth table 十行真实执行：解析 fail-closed（`capability.go:146-157` 非法值 error）、default-off（`TestCapabilityDefaultOffAcrossAllTenRows`）、cohort 判定（:198-203，URL/query/localStorage/HTTP 200 均非 enable 路径）、prereq 链（:223-228）、`not_in_cohort` → existence-hiding `permission_denied`（`errors.go:65-70`）。runtime wiring 只读 server env（`runtime/spatial_replica.go:19-45`）。
- credential/private path 不入 wire：owner locator 只在 server 侧换 `wb:preview:*` opaque ref，绝不进 projection DTO（`ports.go:44-52` 注释 + `composition.go:139-156`）；media resolve 只回 BFF（`service.go:252-266`）；错误 detail 一律 redacted（`errors.go:10-13` + `redactedOwnerReason` `composition.go:461-475` 不回显 owner response 原文）。
- media proxy 双层 allowlist：Go registry 校验 https/无 userinfo/无 query/fragment/origin∈allowlist（`media.go:145-161`）；BFF 侧结构性拒绝客户端拼 upstream（opaque ref charset 排除 `/ ? %`，`spatial-replica-media-proxy.ts:39,80-81`）+ 独立 origin allowlist 二次校验（:108-118）+ 不跟随重定向（:140-146）+ 响应头白名单（:41,154-157）。
- deeplink host allowlist：https-only、host∈allowlist、path 前缀受 host 绑定、无 query/fragment/userinfo/port（`contract/deeplink.go:24-58`），浏览器侧 hostile deep link 全形态拒绝有 security 测试（`tests/security/spatial-replica-security.test.ts:106-127`）。
- scope isolation：transport 层跨 principal 隔离（`spatialreplicahttp/scope_isolation_test.go:37/113`）；principal 只取已认证上下文（`handler.go:225-237`），浏览器输入永不参与。

## 2. 四维抽查（每维 2–3 点）

### correctness
- **race 修复后的 proto.Clone**：`composition.go:139-156` 在附加 server-issued preview ref 前对 adapter 返回的 read-only source 做 `proto.Clone`，注释明示防 GetWorkspace + stream pump 并发 compose 写竞争；9.2 focused race 全绿 + 8.1 DATA RACE run（09-closeout §1 `20260901174041`）修复后复绿佐证。
- **错误码三面一致**：HTTP（`spatialreplicahttp/handler.go:266-306`）、JSON-RPC（`jsonrpc/spatial_replica.go:159-201`，canonical `contract.Error` 保精确 bounded code）、gRPC（`spatialreplicagrpc/handler.go:120` 同表）共享 02 §8 冻结映射；`tests/conformance/spatial-replica-transports.test.ts:111`（frozen wire codes 双 transport parity）与 http 包跨 transport parity wire 测试覆盖。浏览器消费面 `replicaErrorPhase` 保守归一、未知值永不映射 ready（`replica-projection.ts:81-90`）。
- **exact-ref join 纪律**：episode/shot 导航零 label join、零位置 fallback（`replica-navigation.ts:29-46`）；跨 owner identity 闭合逐字段 exact 相等、分歧即 `identity_mismatch`（`composition.go:187-212`）；Scaena stage evidence binding 必须闭合 Anatomia source ref（:79-90）。

### security
- **SSRF**：见 §1.5 第三点；另查 BFF 解析端点走 backendOrigin + bearer（`spatial-replica-media-proxy.ts:88-103`），浏览器无法直达 backend。
- **range**：单 range、`bytes=` 形态、end≥start、span ≤64 MiB、multi-range 拒绝（`spatial-replica-media-proxy.ts:120-131`）；方法限 GET/HEAD、request body/content-length 拒绝（:75-78）。
- **redaction / hostile input**：sentinel 矩阵（`tests/security/spatial-replica-security.test.ts`：hostile refs 全 parse 面 null、credential-bearing label 超界 fail closed / 界内 inert、unknown field 与超预算集合 fail closed、同尾缀不构成 join）+ `tests/security/spatial-replica-contract-sentinel.test.ts`（credential/raw prompt/Provider 矩阵）。capability 快照 JSON 不含 cohort 名单（`capability.go:74` `json:"-"`）。

### accessibility
- **focus trap**：`replica-focus.tsx:45-97`——Tab/Shift+Tab 循环、Escape、initial focus 落安全 control、关闭后焦点返回真实 trigger；仅用于显式确认 dialog，desktop 常驻 region no-trap（注释 + e2e `spatial-replica-accessibility.spec.ts:44-60` 真浏览器断言 trap+return）。
- **键盘替代**：3D orbit/zoom 有方向按钮 + 数值输入（`replica-viewport-region.tsx:319-366`，labelled、有 min/max/clamp）；时间轴 Space/←→/Shift←→/Home/End + input 内不抢键（`replica-review-pane.tsx:462-509`）；`/` 聚焦搜索。e2e 全键盘完成导航→选择→review 零 pointer（a11y spec `keyboard-only review flow`）。
- **DOM mirror / 非 WebGL 唯一信息源**：canvas `role="img"` 且 aria-label 注明选择走对象树（`replica-viewport-region.tsx:269-275`）；对象树带分组/aria-pressed 选择/可见性 checkbox/PTS 跳转/当前 PTS coverage 文本（:374-486）；live announcer 同步 selection（`replica-live-announcer.tsx` + e2e 断言）；axe 扫描 1920/390 critical/serious 为零（e2e）。

### performance
- **chunk 预算**：`spatial-replica-3d` lazy chunk gzip 158.2 KiB ≤250 KiB 冻结预算，three 不进静态 import 图（GLTFLoader 标记 + 从 index.html 闭包双查，`apps/web/scripts/spatial-replica-bundle-budget.mjs` + `temp/spatial-replica-bundle-budget.json`）；capability off 四路门控零 chunk 请求（lifecycle 测试 13 pass + rollback rehearsal e2e）。
- **虚拟化**：timeline 复用仓库既有 `@tanstack/react-virtual`，2000+ joint samples 仅实例化 ~13 行（`spatial-replica-timeline.test.tsx`，4.4 证据）；`view_too_large` 超预算显式拒绝不静默降采样（`replica-viewport-contract.ts:96-102` + region 状态面）。
- **释放**：adapter dispose 幂等、geometry/material/texture/render loop/observer 计数归零、`forceContextLoss` 容错（`replica-viewport-adapter.ts:369-395,639-640`）；context loss 停循环、restore 清 scene 并强制重取投影（`replica-viewport-region.tsx:118-125`）；player controller dispose 停 callback/timer（`replica-player-controller.ts:321-324`）；e2e 三次 shot switch+close 后 4 个 disposed mark 全零（5.6 证据）。

## 3. Findings

**P0：0。P1：0。**（均须修复后复跑——本审阅无需修复，稳定 diff 未被改动。）

### P2（3 项，记录为 follow-up，不阻塞 9.3 勾选）

1. **P2-1 浏览器 workspace stream 终止后无自愈**（`replica-projection.ts:204-248`）：SSE 正常结束（服务端关流）时 `run()` 的 for-await 退出既不触发 snapshot fence 也不清理 controller，死 controller 滞留模块 map——后续 `startReplicaWorkspaceWatch` 返回死条目、`replicaWatchActive` 谎报 active；错误路径也只有一次 fence 无重连。稳定 ready 相位内 freshness 静默停更（shot 切换/unmount/相位离开 ready 才恢复）。不破坏 single-stream 不变量与 mutation 安全（`ExecuteAction` 服务端恒重 compose revalidation；服务端 cursor resume 已由 `TestCursorResumeDedupeAndReconnect` 覆盖），但与 design §12「断线 catch-up」精神不完整。Follow-up：独立 change 增加 stream 生命周期恢复（以 `afterCursor` 重启 + bounded backoff + 终止 fence），owner=Workbench web。
2. **P2-2 media registry 相对 locator 的 origin 绑定不确定**（`service/internal/spatialreplica/media.go:145-151` + `firstApprovedOrigin` :228-233）：allowlist 配置 >1 个 origin 时，相对路径 locator 在 Resolve 期绑到 Go map 迭代序的随机 origin（仍 allowlist 内，无 SSRF，但可能取错 origin 的资产）。P1 fixture 单 origin 未暴露。Follow-up：Issue 期绑定 origin，或 `len(origins)>1` 时拒绝相对 locator，owner=Workbench service。
3. **P2-3 非 3D chunk 的 +30 KiB gzip delta 预算只记录不执法**（`apps/web/scripts/spatial-replica-bundle-budget.mjs`：failures 仅覆盖 3D chunk 与 three 泄漏；`temp/spatial-replica-bundle-budget.json`：index-main 463.59→519.75 KiB、`withinBudget:false` 但 `failures:[]`）。details/05 §3 冻结的「其余 chunk gzip 增量 ≤30 KiB（replica Pane/registry/i18n 代码）」在共享 dirty worktree 上无法单一归因（5.6 证据已如实注明混合贡献），但 0.5 失败复查条款（超预算收窄 import）未形成显式决议。Follow-up：并行 lane 落定后在干净树复测主入口 delta 并归因，超预算则收窄 import 或回写预算决议，owner=Workbench web。

### P3（仅记录）

- `RefreshCapabilities` 只在 `ReceiptStream.ReasonCode == server_config_disabled` 时 `closeAll`（`service.go:129-133`）：flag 保持 on 而 cohort 中途清空的场景不主动断既有流（pump 轮询与每事件门仍 fail closed），边缘无害。
- BFF media resolve 不传 `workspace_ref`（`spatial-replica-media-proxy.ts:90`），Go 侧 workspace scoping 在 BFF 路径不生效（`media.go:142` 空串跳过）；opaque ref 随机 32-hex + 15min TTL + backend 非浏览器可达，纵深防御层面可接受。
- `assembleProjection` 的 source 优先 switch（`composition.go:245-257`）：同 segment 若未来同时携带 source 与 stage，stage 会被忽略——当前 fixture adapter 结构不可能，属潜在脆弱点。
- `formatReplicaPts` 局部变量 `frames` 实为毫秒（`replica-projection.ts:166`），命名易误导，纯展示路径。

## 4. 独立审阅期间跑过的命令（稳定 diff 未被修改）

- `cd apps/web && bunx vitest run spatial-replica` → **23 files / 241 tests 全绿**。
- `CGO_ENABLED=0 go test ./service/internal/spatialreplica/... ./service/internal/adapters/... ./service/internal/transport/spatialreplicahttp/... ./service/internal/transport/spatialreplicagrpc/... ./service/internal/transport/jsonrpc/... -count=1` → 全 ok（grpc 包 no test files，parity 由 http 包跨 transport 测试覆盖）。
- 证伪式 grep：replica web 源零 storage API 写入、零 fps/帧率乘法。
- （9.2 已跑的完整门禁与 8.x run-id 不在独立会话重复，直接引用 `details/09-closeout-evidence.md` §1/§2。）

## 5. 结论

五面（no-fourth-state / single-stream / exact PTS / unknown preservation / owner boundary）+ 四维抽查均通过；无 P0/P1，3 个 P2 已给出 owner 与 follow-up 去向（独立 change），P3 记录在案。truthful claims 复核：三份长期文档与 closeout 的「local fixture / loopback、无 Provider、无真实 owner runtime、非 production、非一比一 metric」分层与证据一致，未发现夸大声明。9.3 验收达成。
