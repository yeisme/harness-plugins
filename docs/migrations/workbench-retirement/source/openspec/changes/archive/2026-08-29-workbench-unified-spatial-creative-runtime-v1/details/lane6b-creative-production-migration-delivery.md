# Lane 6b 交付报告：6.4 Show 投影迁移 Creative Production Lens + 6.6 first-support E2E

状态：实现 + 迁移测试 + E2E spec 全部完成；规定验证全绿（见 §6）。未勾选 tasks.md（按指示留给主代理统一验收）；未 git commit。6.6 按指示本会话未实际运行 Playwright（spec 编写完成 + `--list` 通过 + `tsc` 通过；主代理收口时统一跑）。

## 1. 6.4 迁移清单（文件级）

迁移不是复制双份：lens 是唯一入口。旧 `/show-control-room` 路由/解析器/独立 shell 已在 7.1/7.2 删除（git `7c764d3`），本轮把删除前的事实面迁入 lens 目录，**未恢复任何路由/页面 shell**；`workbench/show-control-room/` 目录现为空（无残留文件）。

### 新文件 `apps/web/src/workbench/agent/spatial/creative-production/`（12 文件）

| 文件 | 来源（`7c764d3^:apps/web/src/workbench/show-control-room/`） | 转换 |
| --- | --- | --- |
| `show-home-panel.tsx` | `show-home-panel.tsx`（173L） | import 深度 `../../lib/client`→`../../../../lib/client`；文件头加迁移 provenance；eyebrow 文案 `AI 做剧 Show Control Room`→`Creative Production Lens`（data-testid/不变量注释/诚实态语义逐字保留） |
| `series-bible-panel.tsx` | `series-bible-panel.tsx`（26L） | 同上 |
| `episode-board-panel.tsx` | `episode-board-panel.tsx`（168L） | 同上 |
| `asset-wall-panel.tsx` | `asset-wall-panel.tsx`（30L） | 同上 |
| `review-inbox-panel.tsx` | `review-inbox-panel.tsx`（397L） | 同上（决定状态机/settled/unknown_accept→reconcile_required/stale 语义零改动） |
| `run-evidence-panel.tsx` | `run-evidence-panel.tsx`（173L） | 同上（transport receipt ≠ owner run receipt 标注保留） |
| `delivery-panel.tsx` | `delivery-panel.tsx`（173L） | 同上（不渲染任何 `<a>`；不推断已交付） |
| `create-show-entry.tsx` | `create-show-entry.tsx`（92L） | 同上（fail-closed 门；needs_contract 时不渲染 button/form/input） |
| `create-show-wizard.tsx` | `create-show-wizard.tsx`（231L） | 同上（本地 closed 预校验 fail closed，不触网） |
| `create-show-entry-connected.tsx` | `create-show-entry-connected.tsx`（158L） | 同上（readiness 只来自 GetOperation server 合同事实；提交只注册 typed proposal） |
| `dsh-handoff.ts` | `dsh-handoff.ts`（165L） | 同上（closed 字段整体拒绝；resourceRef/revision 是不可信提示） |
| `creative-production-lens.tsx` + `.css` + `index.ts` | **新写** | lens 容器：rail（原 spatial-surface 内联 `CreativeProductionRail` 迁入，语义不变）+ 分区组织；showRef 缺失→只呈现 Create Show 入口面（`data-creative-production-lens="entry"`），showRef 在→五面板挂载（`="projection"`）；CSS 独立前缀 `.creative-production-lens-*`，容器 `pointer-events:none` 保持 Pixi canvas 可交互，面板恢复 auto |

### 修改文件（挂载点接线）

- `spatial-surface.tsx`：内联 `CreativeProductionRail`（L193-196）删除 → `lens === "creative_production"` 时挂载 `CreativeProductionLens`；新增可选 props `showControlRoomClient`（可注入 show client 切面，缺省面板自取统一 client）、`showIngress`（`{source, showRef?, episodeRef?, handoff?}`，缺省 agent 入口）、`workspaceId`（默认 `workspace:local`）、`projectId`（默认 `agent`）；`workflow-lens` 挂载不动。
- `agent-route.tsx`：route 层把 `resolveSpatialIngress` 的 ok 结果显式透传为 `showIngress`（含 source/showRef/episodeRef/handoff——handoff 仍是不可信提示，由面板随提交交 server 重验），并透传 `workspaceId`/`projectId`；ingress 拒绝时回退 agent 入口且不带 show 定位（不伪造 show 上下文）。
- `spatial-ingress.ts`：ok-result **additive** 新增显式 `showRef`/`episodeRef: string | null`（`focusRefs` 对 dsh 入口有损：resourceRef 会并入 focusRefs，不能作 show 定位真值）；解析逻辑/拒绝语义零改动，既有 `toMatchObject` 断言兼容。

### 明确不迁移

- `product-study.ts`（282L 纯模型导出工具）：非七个投影面之一，属旧 change 的 study-export 工具，不进 lens；如需可后续单独评估。
- `show-control-room-route.tsx`：按 design §8 不恢复（route/独立 page shell 已删）。
- SDK 合同（`packages/task-sdk` show-control-room-*）：零改动，仅消费。

## 2. 6.6 E2E spec：`apps/web/e2e/creative-production.spec.ts`（4 用例）

| # | 用例 | 链路 | Task/receipt 边界断言 |
| --- | --- | --- | --- |
| 1 | Explore：/agent 直达 lens | `?entry=project&showRef&episodeRef` + spatial snapshot mock（20 nodes × show/episode/scene/shot/asset） | rail 计数来自权威 snapshot；project 入口 `data-entry-source` 如实；七面全部挂载 |
| 2 | Create Show（dsh 入口） | GetOperation（available）→ 4 步真实向导 → SubmitTask `show.create_proposal` | 结果呈现 task id/`awaiting_permission`/`等待 1 个 gate`/`这不代表 show 已创建`；请求体断言展平 `handoffTargetRef/SourceSurfaceId/ResourceRef/ResourceVersion/Nonce` + `entrySource=dsh` 原样传给 server 重验 |
| 3 | 投影成功链 | SubmitTask `show.workspace_projection.get`（succeeded）→ ListArtifacts（anchor + 2 owner segments） | Show Home 摘要 `readiness=degraded` 不推断 available；Run&Evidence/Delivery 呈现 task/projection/**transport receipt** refs；Review Inbox `review-inbox-empty` 诚实空态 + footer transport receipt 标注；≥5 次每挂载重读提交进控制面 |
| 4 | Handoff：Workflow Lens | Workflow definitions/validate/runs/getRun/events 全 mock（strict normalizer 合法形状） | server-authored 子图可见（Delivery DAG/step:3）；selected-run overlay 呈现 `receipt:step-1`/`evidence:shot-7`/`seq 7`（owner run receipt 边界，SSE 空流→listRunEvents 真实降级链）；lens 切换期零 `show.*` 提交（域隔离） |

mock 架构沿用已删除的 show-control-room e2e（git 历史）+ 现存 `agent-spatial.spec.ts` 的 agentRoutes/routeSpatialSurface 模式；locale 用 `composedMessages` bundle fixture；`test.use({ locale: "en-US" })`。

**运行命令**（主代理收口用；本会话未运行）：

```bash
cd apps/web && bunx playwright test creative-production.spec.ts --project=chromium
```

## 3. 迁移测试：`apps/web/test/creative-production-lens.test.tsx`（29 用例）

- 容器（3）：showRef 缺失只呈现入口面；showRef 在→七面挂载 + 5 面板独立重读（queries=5 断言 per-mount reread）；dsh handoff refs 透传。
- Show Home（3）/ Episode Board（2）/ Run & Evidence（2）/ Delivery（2）：succeeded 渲染事实、failed→needs_contract、transport 错→offline、诚实空态、fail-closed 子区、无 `<a>`。
- Review Inbox（5）：每挂载重读 + 诚实空态 + needs_contract；决定卡片 accept→awaiting_permission gate 链、unknown_accept→reconcile_required（submits=1 断言**绝不自动重试**）、failed→stale 重读语义。
- Create Show（4+3+2+2）：三入口 fail-closed、handoff 敏感字段整体拒绝、向导 closed 字段收集/本地预校验、connected 提交 gate 事实/dsh handoff 随提交、validator closed 合同矩阵。

## 4. design.md 歧义点与裁决

1. **目录名**：design §8 写 `lenses/creative-production/**`，既有先例是 `workflow-lens/`（无 lenses 中间层）。裁决：用 `creative-production/` 与 sibling 命名一致。
2. **lens 与 spatial canvas 的关系**：七面板是 server 投影 DOM 面，不是 viewport 图元。裁决：lens 覆盖 stage 右侧（rail+sections 两栏，`pointer-events:none` 容器），Pixi canvas 在下层保持可交互——旧独立 page grid 的"整页滚动列表"不复活。
3. **ingress showRef 语义**：`resolveSpatialIngress` 原 ok-result 只有有损 `focusRefs`。裁决：additive 显式 `showRef/episodeRef`，不改既有字段（兼容既有 `toMatchObject` 测试与 6.5 已交付消费方）。
4. **scope 缺省**：route 层 `workspaceId` 默认 `workspace:local`、`projectId` 默认 `agent`（与 AgentConversationScope 同源同默认）；面板链仍要求 showRef 齐备才挂载投影面。
5. **eyebrow 文案**：面板内 `AI 做剧 Show Control Room` 品牌小字改为 `Creative Production Lens`（lens 是唯一入口后旧名误导）；所有 data-testid、诚实态文案（"不伪造待办"等）与不变量注释逐字保留，测试与 e2e 均不依赖被改的 eyebrow。
6. **product-study.ts**：不迁移（非七个投影面，见 §1）。

## 5. 引入的既有测试修复（语义保持）

`test/spatial-surface-kernel.test.tsx` 2 处：`getByRole("status")`/`findByRole("status")` 无作用域查询在 lens 挂载后命中多个诚实 status 元素（Show 面板 readiness 本就是 role=status）。改为定位 renderer 自身 warning（`.spatial-render-warning`）与文本，断言语义不变。

## 6. 验证结果（全部通过）

| 检查 | 结果 |
| --- | --- |
| `cd apps/web && bunx tsc --noEmit` | 0 错误 |
| `cd apps/web && bunx vitest run test/creative-production-lens.test.tsx` | 29/29 通过 |
| 回归 `bunx vitest run test/spatial-`（9 文件，含 kernel/ingress/state/overlays/intent/board/change-set/worker） | 80/80 通过 |
| 相邻回归 agent-route / workflow-lens-models / workflow-lens-components | 66/66 通过 |
| `openspec validate workbench-unified-spatial-creative-runtime-v1 --strict` | valid |
| `bunx playwright test creative-production.spec.ts --list` | 4 tests listed（编译/fixture 通过；运行留主代理） |

## 7. 交接事项

- 6.6 实际 Playwright 运行由主代理收口统一执行（webServer 由 playwright.config 自起 `WORKBENCH_WEB_PORT=4273 bun run dev`；首次冷启动已被 global-setup 预热覆盖）。
- `spatial-surface.tsx` 的 `showControlRoomClient` prop 当前 route 层未传（面板自取统一 `workbenchClient.showControlRoom`）；预留注入点供未来桌面多 transport/测试需要。
- Review Inbox 例外项在 server 投影携带 `ShowActionDescriptorV1` 后自动点亮（`items` 恒空是 server 事实，不是客户端写死分支之外的假设）。
- 树内另有 7.3 并行代理的未提交改动（canvas/pane 系文件），与本 lane 文件集不相交；合并时以各自 diff 为准。
