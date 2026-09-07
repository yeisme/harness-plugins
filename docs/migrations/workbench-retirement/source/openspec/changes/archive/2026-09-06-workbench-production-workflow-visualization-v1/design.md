# Design — Workbench Production Workflow Visualization V1

## 0. 决策摘要

| # | 决策 | 理由 |
| --- | --- | --- |
| D1 | 数据通道用 BFF 只读路由 `GET /v1alpha1/production-pipeline`（Text Development BFF 先例），不用 task artifacts | task artifacts 只携带 (kind, safeRef, summary)，无法承载结构化阶段 facts；可视化需要浏览器拿到 typed 投影 |
| D2 | 合同版本 `workbench.production_pipeline.v1`，closed schema + 整体 codec 自检 | 与 `workbench.film_project_index.v1` / `workbench.show_control_room.v1alpha1` 同族；unknown 不折叠为完成态 |
| D3 | 阶段状态词汇复用 showcontrol：`unknown/pending/active/blocked/accepted` | 漫剧 8 阶段轨与 Show Home 同一语义；不引入第二套状态机 |
| D4 | 文本 canonical 6 阶段：`draft/candidate/review/accept/checkpoint/deliver` | 对应 Text Development 的 working copy / candidates / checkpoint / 交付事实面；与漫剧 8 阶段并行、互不混用 |
| D5 | 漫剧阶段轨复用 `showcontrol.ComposeShowWorkspaceProjection`（同一 OwnerReadinessSource） | 不建第二套阶段真值；owner stage projection 未签约前如实 unknown |
| D6 | 运行泳道以 Project Automation binding 的 project scope 枚举，逐 binding 授权读（facade Get + ListRuns），运行状态经 workflow runtime 只读查询 | 授权语义保留在 facade；run→stage 归属无合同，不臆造 |
| D7 | Web 统一组件 `ProductionWorkflowPanel`，双挂载：Creative Production Lens（漫剧）+ registered Pane `production.pipeline.v1` | 漫剧在既有 Show 投影入口内可见；文本/其他项目经 pane dock 打开；不新增独立路由 |
| D8 | 投影即时合成、零持久化 | 只读可视化，不产生第二份 canonical 状态；回滚零残留 |

## 1. 合同（workbench.production_pipeline.v1）

### 1.1 查询输入（closed）

```
GET /v1alpha1/production-pipeline
  ?workspaceId=…&projectId=…            (必填，opaque)
  &projectMode=…                         (可选)
  &domain=text|drama                     (必填)
  &showRef=…&episodeRef=…               (drama 必填 showRef；text 忽略并拒绝)
  &workingCopyRef=…                      (text 可选，可重复，≤8)
```

- `domain=drama` 时 `showRef` 必填；携带 `workingCopyRef` 拒绝（closed，不做静默忽略）。
- `domain=text` 时携带 `showRef`/`episodeRef` 拒绝。
- 校验失败返回 400 `invalid_argument`；未知 query 参数拒绝。

### 1.2 投影输出（closed）

```jsonc
{
  "contractVersion": "workbench.production_pipeline.v1",
  "domain": "text",
  "scope": { "tenantRef": "…", "workspaceRef": "…", "projectRef": "…" },
  "readiness": "available | needs_contract | degraded | offline",
  "stages": [
    { "stage": "draft", "state": "active", "summary": "…",
      "facts": [ { "kind": "working_copies_open", "count": 2 } ] }
  ],
  "runs": [
    { "bindingRef": "…", "workflowRunRef": "…", "runState": "running" | null,
      "receiptRef": "…", "observedAtUnixMs": 0 }
  ],
  "runsReadiness": "available | needs_contract | unavailable",
  "observedAtUnixMs": 0
}
```

- 阶段集合固定：text 6 / drama 8，顺序 canonical；缺失阶段视为 codec 失败（整体 fail-closed）。
- 每阶段 facts ≤4；`facts[].kind` closed 枚举：`working_copies_open`、`working_copies_conflicted`、`checkpoints`、`candidates_pending`、`candidates_stale`、`candidates_applied`、`candidates_unknown_accept`、`owner_segments`、`blocked_owners`。
- runs ≤8（超出截断并在 summary 注明）；refs 一律 opaque，禁止 secret 类前缀（与 showcontrol 同一 ref grammar）。
- `readiness` 是阶段轨折叠态；`runsReadiness` 独立折叠（automation 不可用不拖垮阶段轨）。

### 1.3 诚实语义

- 任一 source 未绑定/读取失败：对应段如实降级——阶段 `unknown` + `readiness=needs_contract/offline`，runs 空 + `runsReadiness=needs_contract/unavailable`；响应本身仍 200（投影是事实，不是错误）。
- 「source 可用且事实为空」≠「unknown」：如 text 传入 workingCopyRef 且全部查询成功、零 checkpoint → checkpoint 阶段 `pending`（已知为空）；未传 ref → `unknown`（无从观察）。
- 不把 candidate/owner 未签约折叠为 pending/完成；不把 automation run 存在解释为阶段进度。

## 2. Composer

### 2.1 文本折叠规则（确定性）

输入：per workingCopyRef 的 status（open|conflict|recovery_required|unknown）+ checkpoint 数；候选 facts（v1 无 owner list 合同 → 恒 unknown）。

| 阶段 | 折叠 |
| --- | --- |
| draft | 任一 conflict/recovery → blocked；否则任一 open → active；refs 全查询成功且全非 open → pending；未传 refs 或 source 未绑定 → unknown |
| candidate | owner candidate list 合同未发布 → unknown（summary 注明） |
| review | 同上 → unknown |
| accept | 同上 → unknown |
| checkpoint | 总 checkpoint>0 → accepted；refs 全查询成功且=0 → pending；否则 unknown |
| deliver | 无交付观察合同 → unknown（summary 注明，不显示为 pending） |

connector 未配置（`WORKBENCH_AUCTRA_URL` 空）→ 全部 unknown + `readiness=needs_contract`。

### 2.2 漫剧 adapter

直接调用 `showcontrol.ComposeShowWorkspaceProjection`（runtime 已绑定的同一 `OwnerReadinessSource`）：stages/owners 原样进投影；`readiness` 沿用其折叠；owner 段计数进 facts（`owner_segments`/`blocked_owners`）。阶段不重算、不推断。

### 2.3 运行泳道

1. `ListAutomationBindings(ctx, tenantRef)`（store 枚举候选）。
2. 过滤 `WorkspaceRef==workspace && ProjectRef==project`。
3. 逐 binding：facade `Get(principal, bindingRef)` 授权（失败如实跳过并计数）→ `ListRuns(principal, bindingRef, "", N)`。
4. 每个 run：workflow runtime `GetRun`（可选）取 `runState`；摘要字段仅 safe refs + observedAt。
5. 合并按 observedAt 降序，截断 ≤8；授权失败/服务不可用 → `runsReadiness=needs_contract`（部分成功=degraded 归入 runsReadiness=available + summary 注明跳过数）。

不把 run 归属到具体阶段（无合同）；无 per-stage run facts。

## 3. BFF 路由

`service/internal/transport/productionpipelinehttp`：

- Handler 持三个 source 接口（TextStageSource / DramaStageSource / RunLaneSource），nil source fail-closed。
- `security.PrincipalFromContext` 取 principal（protect 中间件已验 bearer）；tenant fence 与 dailyops 同规。
- 错误映射：输入校验 400；source 内部错误不 500 裸抛，投影内降级（§1.3）。
- 响应经 `MarshalProductionPipelineProjection` codec 自检后写 JSON。

## 4. SDK

- `production-pipeline-models.ts`：closed 类型 + `normalizeProductionPipelineProjection`（未知字段/枚举漂移 → `contract_mismatch` fail-closed）。
- `production-pipeline-client.ts`：`getProductionPipeline(request)`；method 名 `GetProductionPipeline` 映射 `http.ts` 新条目（GET `/v1alpha1/production-pipeline`，query 白名单）。
- `client.ts` 组合导出；round-trip 测试覆盖 happy/needs_contract/contract_mismatch/截断。

## 5. Web

`apps/web/src/workbench/agent/production-workflow/`：

- `production-workflow-panel.tsx`：connected 面板（client 可注入）。状态机 loading/succeeded/failed(needs_contract)/error(offline)；阶段轨 `<ol data-stage>` + 状态 chip + facts `<dl>`；运行泳道卡片（runState chip + mono refs + 「打开运行」deep link 到 `/workflows/:tenant/:workspace?runRef=`）；runsReadiness/截断如实注记。
- 挂载一（漫剧）：`CreativeProductionLens` 在 `ShowHomePanel` 之后 additive 挂 `<ProductionWorkflowPanel domain="drama" …>`；关闭即隐藏，不改 Show Home。
- 挂载二（全项目）：pane registry/catalog/manifest 注册 `productionPipeline`（`production.pipeline.v1`，closed params sessionRef/projectRef/domain[/showRef/episodeRef]，read scope `production.pipeline.read`），组件复用同一面板。
- i18n 走 `agentText` key 面（zh-CN/en-US），refs/枚举保持原文。
- 可访问性：阶段轨 `ol/li` + `aria-label`；状态不只靠颜色（chip 文本即状态词）；键盘可达（原生控件）；reduced-motion 无动效依赖。

## 6. 边界与非目标

- 不实现第二套 stage 状态机、per-stage run 归属、production GA canary、移动布局；不修改 R4 workflow runtime / showcontrol / Project Automation 任何合同。
- 浏览器不直连 owner；不保存 raw prompt/provider payload/credential；投影不落库。
- 回滚：移除路由挂载与 pane/lens 挂载即回到现状，canonical 状态零影响。
