# Scaena制作台接入基线

## 当前接入状态

本切片只完成合同核对与 consumer 合同冻结，未写任何 adapter/UI 代码。核对时 `agent/scaena` HEAD 为 `087f78204cb64b4311d02739e72c2faccc56dfcb`；源码/文档存在不代表服务已部署或真实闭环已验收。声音动作在 Production API 上确认缺失（见下表）；owner 侧配套 change 与反向链接须由 scaena-owner 会话按 5.1 落地，本仓不代写。

### 合同初查（2026-09-08）

| 能力 | 合同入口 | 版本/状态 | 当前消费决策 |
|---|---|---|---|
| Production 只读投影 | `agent/scaena/docs/design/production-public-api-contract.md`：`GET /api/v1/production/{portfolio,cockpit,reviews,evidence-export}`（`/v1/**` alias 不作新消费面）；shared envelope `spec_version: 0.1` | `scaena.production.portfolio/cockpit/review_queue/evidence_export.v1`，文档声明 first-support | 制作台项目/镜头列表、审阅队列与证据视图的读面以此为源；phase/readiness/blocker 全部由 owner 派生，DSH 不建第二状态机 |
| 服务端 action descriptor | 同上 Action Descriptors：`action_id/label_key/method/href-or-command/target_ref/risk_class/requires_confirmation/idempotency_required/expected_version/disabled_reason` | 合同已定义 | 动作发现/预览/确认直接消费 descriptor；`disabled_reason` 驱动诚实禁用，不做死按钮 |
| 镜头动作 | `agent/scaena/docs/protocols/storyboard-review-package.md`：`scene-acceptances`、`:revalidate`、`visual-reviews`、`visual-acceptances`（candidate-ref + candidate/duration/dialogue digest + expected-version + idempotency） | `StoryboardSceneAcceptanceReceiptV1`/`SceneVisualAcceptanceReceiptV1`；协议状态 implemented/engineering_ready | 候选比较与采纳的 CAS 语义齐全；stale 拒绝后刷新不覆盖，与 design 决策 2 一致 |
| 资产动作 | 同上：recommendation（non-binding）+ `:confirm-recommendation` receipt；`AssetDependencyGraphV1`；Eikona Visual Job `candidate_count 1..8` 分片 | `ProductionDepthRecommendationV1` 等；additive 演进 | 推荐/确认分立、receipt 独立；技术分片不得被 UI 描述成配额 |
| 声音动作 | Production media：`/api/v1/production/media/**` 未进 catalog/runtime/generated OpenAPI，请求 `404 RESOURCE_NOT_FOUND`；review-package 仅含 dialogue-digest，无声音生成/绑定动作 | 明确缺失（future inventory only） | 最小 consumer 合同不包含声音动作；UI 以缺失原因禁用入口，缺口经 5.1 由 owner 建配套 change，不得在插件内实现 |
| 编排计划 | 同协议：`waves` plan/approve/reconcile/execute；`GenerationWaveV1` 状态机（draft→…→terminal_manual_decision）；plan digest 或版本漂移使 approval stale；无界 estimate 须对 exact wave 显式确认 | `GenerationWaveV1`；implemented | 预览消费 owner 计划面：固定范围、将执行项与范围外阻塞清单；跨领域编排走 creative-workflow 的 Ordo 通道 |
| 导出交付 | `:export` manifest（只含 `idempotency_key_digest`/`request_digest`）；formal 仅接受 current visual acceptance；draft 须显式 `--allow-draft`、水印、`production_ready=false` | 合同已实现 | 成功以 owner 回执与产物 ref 为准；部分成功保留已完成成果；UI toast 不算交付 |
| transport 验证 | HTTP 全部 project scope + `Idempotency-Key` + expected version 冲突不修改状态；SSE refs-only + numeric cursor resume；MCP 4 tools + RFC6570 resource（percent-encode 冒号）；durable replay 逐动作语义 | 协议已实现 | review-package 固定版本消费与传输验证按 owner 合同执行（任务 2.6 落地前标记未验证） |

`agent/scaena` 侧检索（`docs/`、`openspec/` 全文 grep）未发现对 `dsh-scaena-production-studio-v1` 的引用；既有反向链接先例只覆盖 `dsh-opc-scene-package-director-v1` 等其他 change（见其归档 proposal）。因此 1.1 的双向链接在本仓只能完成 DSH→owner 方向，owner→DSH 方向列为 5.1 的 owner 侧阻塞项。

## 最小制作台 consumer 合同冻结（1.2）

只消费以下已实现面；超出面一律等待 owner additive change，不猜 wire：

- 读：`GET /api/v1/production/portfolio|cockpit|reviews|evidence-export`（shared envelope `spec_version: 0.1`；alias `/v1/**` 不用）。
- 动作：storyboard-packages 下的 `:recommend`、`:confirm-recommendation`、`scene-acceptances(:revalidate)`、`:confirm-creative-contract`、`waves(:approve|:reconcile)`、`:execute`、`visual-reviews`、`visual-acceptances`、`:complete`、`:export`；全部携带 owner descriptor、expected version 与 `Idempotency-Key`。
- 观察：package events SSE（refs-only，numeric cursor resume）；关闭 Pane 不取消运行。
- 排除：Production media（声音）动作、任何未进 generated OpenAPI 的 future inventory；未知 critical 合同版本拒绝。
- review-package 消费固定 owner/ref/version，transport 校验沿用 owner 合同（2.6 实现前未验证）。

UI Contract 已在 `design.md` 的 UI Contract 与「UI Contract补全」两节冻结：surface classification adopted（ui-surface；画布节点缩略 ui-visual-kit）、workspace+inspector、三级视觉优先级、State Matrix、360–960 响应式与键盘路径，符合 `docs/design/dsh-unified-panel-visual-system.md` §12 字段。

## 脚手架复用核对（1.2）

- `packages/client/ui-creator-studio/src/projection-components.tsx`：`CreatorActionComposer`（descriptor 驱动、lockedValueKeys、receipt 回调）直接复用为动作确认面。
- `packages/client/ui-creator-studio/src/artifact-workspace.tsx`、`views.tsx`：workspace 骨架、`SurfaceState/SurfaceSection` 诚实态与既有候选比较入口。
- `packages/host/creator-studio/src/{gateway,contracts,validation}.ts`：授权连接、目录与 gateway 校验、`registerCreatorStudioOwner` 装配模式。
- 不新建私有 atoms、第二主壳或 CSS 系统；镜头/资产详情 inspector 沿用共享 token。

## 验证

本切片为合同/文档冻结，无代码改动；门禁为 `openspec validate dsh-scaena-production-studio-v1 --strict --no-interactive` 通过。adapter/组件测试与真实制作/导出闭环保持未开始（第 2/3/4 组任务未动）。
