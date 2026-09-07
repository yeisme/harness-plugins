## Context

Harness Platform 的跨项目设计已判定此能力为 `split-owner`：Harness Control Plane 拥有 tenant-scoped workspace、installation、grant、runtime binding、quota、audit 和 operation projection；Identity 拥有 principal/tenant/membership；插件与各领域 owner 保留 manifest、runtime、ProductionGraph、run、asset、review、rights、evidence 和 receipt 的 canonical state。Workbench 只拥有导航、布局、查询缓存、可访问的展示和受控 typed action UX。

此 change 是 Workbench 的消费者 implementation packet，不宣称任何 owner API 已可用。现有 Workbench 也已规定浏览器仅经过同源 BFF 和 `WorkbenchClient`，不得取得 session/owner token 或私自连接 domain owner。并行工作树中存在其他功能修改；本 change 只定义新增租约内的合同，后续实施必须适配而不覆盖这些工作。

## Goals / Non-Goals

**Goals:**

- 定义可跨 tenant/workspace 安全复用的 Harness Studio 壳、context reset、Panel/slot、typed query 和 action 状态。
- 将原生审核插件与不可信第三方 iframe 分开，保留 server-authorized descriptor、receipt、reconcile、audit 与 owner handoff。
- 让 Studio 可组合 Eikona、Scaena、Anatomia、Ordo/MCP 的最小安全投影，展示生产进度、证据、资产、审批和准备度，但不代替任何专业产品。
- 使桌面 Studio、窄屏操作视图与 DSH Web compact bridge 在同一合同下承担不同体验，而不是共享私有 React state。

**Non-Goals:**

- 不实现 Harness Control Plane、Identity、插件安装/执行、DSH/Pi runtime、Ordo scheduler、MCP server 或任何 owner API。
- 不让浏览器直连领域 owner、provider、MCP endpoint、数据库或 artifact store；不接收用户提供的 owner URL。
- 不保存 raw prompt、provider payload、signed URL、credential、完整 transcript、private path、asset bytes 或 canonical domain state。
- 不将 Canvas 发展为 ProductionGraph/asset/Agent/knowledge 的第二真相，也不实现 Scaena 的 Candidate Wall、镜头抽卡、production acceptance 或 delivery。

## Decisions

### 1. 一个 server-authored Studio context 是所有 UI 状态的根

路由和 every `WorkbenchClient` request 使用不可伪造的 `{tenant_ref, workspace_ref, context_revision}`，由 BFF 从已验证 session 绑定而非浏览器自报 tenant。Studio shell 在顶部和无障碍名称中显示 tenant/workspace；context revision 变化时按顺序取消 queries、关闭事件流、丢弃选中项/草稿/overlay/action preview，清空 scoped caches，然后读取新 context。所有 query key 至少包含 tenant、workspace、installation/resource ref、contract digest 与 projection version；不得用相同 resource ID 猜测新上下文的对象。

替代方案是保留跨 workspace 客户端缓存并用 ID 过滤。它不能处理 subscription、stale draft 或 opaque ID 的同值碰撞，且容易泄露旧 tenant 展示，因此拒绝。

### 2. 插件只有受控 slots，UI 只相信 typed descriptors

Control Plane 的插件目录返回不可变 release digest、installation ref、effective grant、runtime health 和 surface descriptors。descriptor 固定 `surface_id`、kind、title/icon semantic、slot、minimum viewport、accessibility label、resource scopes、contract digest、lifecycle/readiness、view/action/event schemas 和允许的 deep-link target；Workbench 的静态 slot registry 决定可显示的位置，未知 slot 或 major contract mismatch fail closed。

`native-reviewed` 是 Workbench 已随构建审核、版本锁定的 renderer，不等于插件任意执行 JS；它只接收 schema-validated typed view model。`sandboxed-iframe` 只能加载控制平面批准的 immutable content-addressed document；descriptor 必须同时冻结 artifact/release digest、URL/path、media type 与 exact origin，allow-listed mutable origin 本身不构成代码完整性。Gateway/host 在执行前验证实际字节 digest，并通过 sandbox 与 iframe 文档自身 CSP（默认 `default-src 'none'`，仅开放精确 bridge/connect 目标或等价隔离 proxy）禁止共享 origin、top navigation、credential/token/secret query parameter、未批准网络和持久化 truth。Versioned `postMessage` bridge 对每条消息验证 exact source window、origin、channel nonce、installation/release/context revision 与 schema；任何漂移返回 `blocked_supply_chain` 或 `contract_mismatch`。iframe 不能获得 Workbench session、任意网络、local storage truth 或未经 descriptor 声明的 action。Native renderer 更适合可信、性能关键、需深度 a11y 的专业投影；sandbox 适合经审核的第三方/host surface。两者都不可绕过 typed facade。

### 3. 五类 typed envelope 分离读、动作、事件与最终性

Studio 只消费以下经 schema 校验的模型，字段仅为 opaque/safe refs、版本、digest、状态、freshness、display-safe summary、links、allowed actions 和 redacted diagnostic：

| Model | 必需语义 |
| --- | --- |
| `HarnessView` | context、slot、projection type/version、resource refs、freshness、readiness、布局提示；不含 canonical payload。 |
| `HarnessResource` | tenant/workspace/owner/installation scoped ref、resource version、rights/access state、lineage/evidence refs。 |
| `HarnessActionDescriptor` | owner、target、expected version、idempotency requirement、permission/approval/cost/rights gate、confirmation copy、supported receipt/reconcile links。 |
| `HarnessEvent` | scoped cursor、monotonic source sequence、event type、safe delta/ref、freshness；不能把未验证 event payload 写为 canonical query data。 |
| `HarnessReceipt` / `HarnessReconcile` | correlation/idempotency/owner receipt ref、authoritative/pending/partial/unknown status、redacted error、next safe actions。 |

点击动作将 descriptor 和 user confirmation 交给 Workbench TaskService/BFF，而不是直接请求 owner。BFF/Service 校验 session context、installation、contract digest、expected version、permission、rights、budget/cost 和 idempotency 后才代理到对应 control/domain owner。网络接受或 HTTP 2xx 不等同成功；`unknown_accept`、`unknown`、`reconcile_required`、`partial` 始终显示 receipt/reconcile，不自动再发。用户显式授权的 retry 也重用/关联原 idempotency identity，且只有 owner 的 eligible action descriptor 才可出现。

### 4. 生产投影按 owner authority 分层

Eikona Produce 显示过程、attempt、候选比较、成本摘要、rights、review evidence 和其 owner decision；选择 candidate、Visual Library promotion、Scaena subject freeze、shot acceptance 与 delivery 是不同 actions。Eikona accepted 不等于 Scaena admitted，Workbench 必须显示两个 authority 与各自 receipt。Eikona generation 默认经 owner 的 canonical model policy，UI 不调用 provider，也不持久化 prompt/provider request。

Scaena Episode Workspace 以其 facade 的 server-authored projection 呈现六阶段：`story`、`breakdown`、`look-development`、`production-preflight`、`shot-production`、`review-delivery`。每阶段显示 ProductionGraph ref/version、scene/shot summaries、gate/readiness、evidence/receipt、owner-authorized next action；缺合同、stale preflight 或 subject 未 freeze 时只显示真实 blocker/candidate-only。Workbench 不直连 Auctra、Eikona、Sonora 或其他 owner 来拼装 production mutation。

Anatomia 的视频 evidence 和 MCP projection 仅作为 schema-validated、tenant-scoped、read-only resource/evidence refs；UI 可查看 safe timeline/identity/region/readiness 摘要和 owner-published repair/action descriptor，但不显示 raw video analysis payload、geometry/image bytes、signed URL、MCP private tool arguments，也不把 MCP 当浏览器必需 transport。MCP 仍只通过批准的 server-side projection/bridge 暴露。

统一 Asset Library 读取 owner-authorized typed asset projection，按 owner、rights、lineage、freshness、resource type 与 release binding 聚合；预览走 owner grant proxy，grant 只作为短暂响应使用且不得落盘或跨 tenant 复用。Canvas 只写 layout node position、viewport、group、annotation、panel preference 与 versioned safe refs；owner revision/digest 改变时节点及相关 proposals stale，任何 accept/export 都受 descriptor gate 阻止。

### 5. 互补客户端、响应式、性能和安全

DSH Web bridge 用紧凑会话/插件入口：显示当前 context、safe status、少量 approved action 与到 Studio 的已授权深链；不得重建 tenant admin、复杂 Asset Library、Canvas 或 Episode Workspace。Workbench 是全尺寸 Studio，桌面可使用多 pane；平板以 drawer/sheet 和一列优先级工作流替代自由 docking；手机仅保留 context、观察、单项审批/receipt/reconcile 等低风险核心操作，复杂/高风险 mutation 只读或打开受控继续入口。所有路线支持键盘、语义 label、可读 status/live region、焦点 trap/return、contrast、非颜色状态和 reduced motion。

性能策略为 slot lazy-load、按 context cancellation、cursor resume、bounded virtualized lists、按 owner/resource 定向 invalidation、请求/response byte limit 和 event coalescing；不预取受限 asset、无限 transcript 或 plugin bundle。安全策略为 server-side authorization、CSP/frame policy、schema size/depth validation、opaque IDs、existence-hiding deny、redacted telemetry/evidence，以及全链路禁止 secrets/raw prompt/provider payload/signed URL/canonical state。

## Owner Handoffs and Acceptance

| Owner | 必须交付给 Workbench 的合同 | Workbench 允许消费 | 不可由 Workbench 推断 |
| --- | --- | --- | --- |
| Identity + Harness Control Plane | validated context、installation/grant、slot descriptor、action/receipt/reconcile、audit-safe event | tenant/workspace selector、plugin admin、runtime/readiness | membership、quota、permission 或 runtime liveness 已成功。 |
| Harness Plugins / DSH bridge | signed release/digest、native/iframe descriptor、bridge schema/compatibility | catalog/slot 与 compact deep link | 任意 bundle、iframe 或 host session 可安全执行。 |
| Eikona + Aigora | run/candidate/review/cost/rights/asset/decision receipt | Produce、comparison、library projection | owner decision 即 Scaena production admission，或 cost unknown 为 zero。 |
| Scaena | six-stage Episode/ProductionGraph/shot/gate/readiness/action/receipt projection | Episode Workspace、safe action entry | 浏览器可协调跨 owner production mutation，或 candidate 已 accepted/delivered。 |
| Anatomia + MCP | safe video evidence/projection schema、rights/readiness、evidence refs | timeline/evidence explorer、typed repair entry | raw analysis/provider/MCP payload 可展示或 MCP 为 browser transport。 |
| Ordo | Agent Ops DAG/lease/approval/verification/evidence/reconcile projection | observe、approved action descriptor | timeout 可安全 restart 或 Workbench 成为 scheduler。 |

每个 provider 与 consumer handoff 必须分别提供 contract digest/version、schema fixtures、failure/reconcile/tenant isolation evidence 和 release compatibility。Workbench 只能在 provider ready 与 consumer adoption evidence 同时存在时把 capability 显示为 `available`；其余状态是 `needs_contract`、`permission_required`、`degraded`、`offline` 或 `contract_mismatch`。

## Risks / Trade-offs

- [Owner contract 未成熟] → UI 按 readiness fail closed，保留 server-authored handoff/diagnostic，不用 fixture 模拟生产成功。
- [iframe 或 host bundle 扩大攻击面] → 仅审核的 immutable content-addressed release、实际字节 digest、exact origin、sandbox/文档 CSP、schema bridge 和独立 tenant runtime；任何偏离拒绝加载。
- [tenant 切换 race/cached leakage] → context revision、abort、cache key scope、event cursor teardown 与并发切换测试。
- [复杂生产 UX 复制 owner] → Episode Workspace 仅消费 six-stage projection/action；Canvas layout-only，专业 editor/deck 以 owner surface/deep link 处理。
- [高频事件/大资产影响前端] → server pagination、bounded payload、lazy/virtual rendering、owner grant proxy 和不持久化 bytes。

## Migration Plan

1. 先在 test tenant 发布 Control Plane/Identity 与每个 owner 的 versioned safe descriptor/fixture，Studio 仅显示 `needs_contract`。
2. 落地 Workbench context shell、slot registry、typed clients、redaction/schema gates 和 read-only projections；运行 unit/contract/accessibility tests。
3. 以一个 native-reviewed Eikona/Scaena consumer 和一个 sandboxed iframe canary 验证 tenant reset、grant、receipt/reconcile、CSP 与 stale handling；不启用 provider/production mutation。
4. 在独立 test tenant 依次开放 descriptor-authorized action、Ordo observation、Episode Workspace 和 Asset Library；每项与 provider evidence 共同验收。
5. 回滚时禁用 release/slot/action capability，清除 session-scoped presentation cache 和 event streams，保留 owner receipts/evidence 的只读查询；不删除 canonical state、不重放 unknown mutation、不降级跨 tenant authorization。

## Open Questions

- Harness Control Plane 最终的 view/action/event JSON Schema package、compatibility window 和 `postMessage` channel origin 列表。
- test tenant 中 native-reviewed 与 sandboxed plugin 的首个 release 及其 signed/SBOM verification evidence。
- Scaena 六阶段枚举的最终 API spelling，以及哪些 low-risk actions 可以在 tablet/mobile 直接批准。
- owner grant proxy 的缓存 TTL、预览 content policy 与端到端 performance SLO。
