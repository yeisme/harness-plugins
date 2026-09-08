# Anatomia分析台接入基线

## 当前接入状态

本切片只完成合同核对与 consumer 合同冻结，未写任何 adapter/UI 代码。核对时 `agent/anatomia` HEAD 为 `f1e13ef`；`docs/contracts/public-interfaces.md`（v0 experimental，OpenAPI 由 `cmd/anatomia-openapi` 生成防漂移）与 `docs/contracts/video-observation-contract.md` 为消费真源。`agent/anatomia` 侧检索未发现对 `dsh-anatomia-analysis-studio-v1` 的引用，双向链接的 owner 方向须由 anatomia-owner 会话按 5.1 落地。

### 合同初查（2026-09-08）

| 能力 | 合同入口 | 版本/状态 | 当前消费决策 |
|---|---|---|---|
| 时间坐标 | 全合同统一整数微秒（`start_micros/end_micros`；production decomposition 共享 clock；机制诊断 500000us 分组） | `anatomia.*.v0`/`v1alpha1` | 微秒↔秒换算收敛到 DSH adapter 层，UI/投影不做第二套时钟；时间码展示按 locale |
| 来源/关键帧访问 | `POST /api/v1/sources`、`GET /api/v1/artifacts/{artifact_ref}/access`→`yeisme.media.result.v1`（24h capability `/media/grants/{token}`）、CLI `artifact download` | 已实现（授权读侧面） | 只用 owner rendition/授权 grant；无授权显示原因，不做客户端截帧 |
| 观察与证据 | `anatomia.multimodal_video_decomposition.v1`：ObservationTask（role=visual_observer/video_reader）、ObservationReceipt（claim=observed/inferred；`accepted` 只由 ReviewWorkspace/owner 产生）、reconciliation 产生 conflict ref 不选胜者 | video-observation-contract v1 | 候选= evidence-bound candidate；比较/冲突呈现原样，DSH 不自动采纳或删冲突 |
| 分析生命周期 | `POST/GET /api/v1/video-analyses`、`:cancel`（expected-version）、`events`、`revisions`、revisions `:freeze`（owner 审阅门禁）；202+job_ref 长任务、`Idempotency-Key`、typed errors（code/message/request_id/retryable） | 已实现 | 观察列表/详情 adapter 的状态面；unknown 只 reconcile 不重试 |
| 范围分析 | canonical scoped inspection/comparison DTO：additive SDK/OpenAPI component，**无默认 HTTP route**；canonical understanding `POST /api/v1/understandings` 默认 composition 返回 `501 canonical_understanding_runtime_not_configured` | contract-only / owner gate | 最小合同不消费这两个面；UI 缺口以「owner 未开放」禁用，不伪造 route |
| 审阅与交付 | `POST /api/v1/reviews/{review_ref}:verify`（Idempotency-Key→`review_verification_receipt`）；reviewable breakdown delivery projection 受 `ANATOMIA_REVIEWABLE_BREAKDOWN_DELIVERY_ENABLED=false` 默认关闭；long-form reading 受独立 flag 默认关闭 | 已实现但 flag 关闭 | 读面按 flag 呈现 unavailable/blocked 原因；draft `reviewable_breakdown_document` 不冒充 frozen pack |
| 固定版本参考包 | revisions freeze（versioned）、`GET /api/v1/revisions/{revision_ref}/production-decomposition` 三入口同 projection（四 component discriminator，unavailable 不伪造）、`anatomia.handoff.v0` handoffs、Scaena/Eikona/Sonora 严格 handoff eligibility 受 `ANATOMIA_STRICT_HANDOFF_ELIGIBILITY_ENABLED=false` | v1alpha1 additive；strict eligibility 默认关 | 参考包消费固定 owner/ref/version；`reverse_engineered` 标记保留；strict handoff 未开时呈现缺口不阻断只读 |
| 鉴权与边界 | `/api/v1/**` Bearer Token；operator/owner 角色分层；redaction 禁 raw prompt/payload/credential/绝对路径 | 已实现 | Host 持有凭据与 endpoint；浏览器只收 safe projection |

EvidenceCase V1Alpha1 为 planned contract，不进入最小消费面。`accepted` 事实、freeze、promote/reject/rollback 等 owner 决策不由 DSH 代行。

## 最小分析台 consumer 合同冻结（1.2）

- 读：video-analyses lifecycle（status/events/revisions）、production-decomposition projection（固定 revision version）、delivery/long-form 读面按 owner flag 的 availability 呈现。
- 媒体：`GET /api/v1/artifacts/{artifact_ref}/access` + grant；仅 owner rendition，无本地转码/截帧。
- 动作：`:cancel`（expected-version + Idempotency-Key）；观察/审阅决策动作仅在 owner 合同支持且开启时呈现。
- 时间坐标：微秒整数原样进 adapter，换算/格式化只在 adapter 层一次完成。
- 排除：canonical understanding、scoped inspection/comparison（无默认 route）、EvidenceCase V1Alpha1、任何 provider 参数注入。

UI Contract 已在 `design.md` 冻结（adopted workspace+inspector、State Matrix、Responsive、A11y，符合视觉系统 §12 字段）。脚手架复用：`CreatorActionComposer`（`packages/client/ui-creator-studio/src/projection-components.tsx`）、artifact-workspace/views 的 `SurfaceState/SurfaceSection` 诚实态、rich-media 视频 renderer（关键帧/片段授权预览）、`packages/host/creator-studio/src/{gateway,contracts,validation}.ts` 装配模式；不新建私有 atoms 或第二主壳。

## 验证

本切片为合同/文档冻结，无代码改动；门禁为 `openspec validate dsh-anatomia-analysis-studio-v1 --strict --no-interactive` 通过。adapter/组件测试与真实分析闭环保持未开始（第 2/3/4 组任务未动）。
