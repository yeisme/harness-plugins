# workbench-agent-pane-composition-r1 · Review Report

扫尾会话（R9）验收记录。范围：任务 3.3 残留（contextMap stub 删除）+ 4.x 验证门禁与视觉证据。切片 A（hero/dock 组合、PaneChrome 统一、palette fail-closed）与切片 B（四态骨架、五 pane 接入、人读化）已在早前会话完成，本报告对全量 Requirement 给出最终验证结论。

## 实现摘要（本扫尾会话的增量）

- `apps/web/src/workbench/agent/panes/agent-pane-host.tsx`：删除 contextMap stub 渲染分支（原先永远渲染 unavailable StateBanner）。palette 已 fail-closed（disabled + 原因、不可打开），该分支不再可达；按 spec「stub rendering path MUST be removed」改为空渲染 `() => null`——即使未来路由绕过 palette，空渲染也比伪造 unavailable 卡更诚实。`AgentPaneComponentRuntime.contextMap` 接口成员保留（registry/manifest/catalog 合同不变）。
- `apps/web/e2e/agent-pi-workspace.spec.ts`：修 3 条 R7 时间线改造的遗留断言（原计划 2 条，实际 3 条同属该 fallout）：
  1. 取消回合：run card 标题已是静态「回合/Run」，取消语义由 StatusChip 承载 → 改断言 `[data-wb-status-chip][data-status='blocked']` 含「Cancelled」（cancelled → blocked tone 映射 + 本地化文案双重校验，强度不降）。
  2. thinking 块：标题已从「Thinking」改为「推理摘要/Reasoning summary」→ 断言「Reasoning summary」。
  3. run card 密度：「用时」升入卡头右侧、「N 个安全事件」降为次级 meta 行，二者不再以「 · 」连接 → 拆为同一张 card 内「Elapsed 3.9s」与「8 safe events」两条断言（真实时间戳派生语义保留）。

## 逐 Requirement 验证结论

### 1. The hero composer SHALL compose correctly with the pane dock — ✔ 通过

- 代码：`heroActive = conversationEmpty && visiblePanes === 0`（dock 维度补齐）；composer 单实例，pane 开合不重挂载。
- 证据：`after-r9-empty-pane-1440.png`（空会话 + context pane 打开：composer 贴对话列底部、hero 品牌块与下方 spacer 均不渲染、无浮空无大空白）；`after-r9-conversation-dock-1440.png`（会话中 + run/review 双 pane dock，composer 仍贴底，组合稳定）。
- e2e：agent-first / agent-pi-workspace 全量通过（含 sheet 模式 Escape 后焦点还原断言）。

### 2. Pane frames SHALL render the title once through the shared chrome — ✔ 通过

- 证据：`after-r9-pane-chrome-closeup.png`——标题「Run」单处渲染，版本 `agent.run.v1·r1` 为次级 mono meta，无 eyebrow 重复；`after-r9-mobile-sheet-390.png` 与 `after-r9-tablet-1024.png`——sheet 帧头同为共享 PaneChrome（标题 + 关闭），与桌面同构。

### 3. Every pane SHALL implement the four-state content matrix — ✔ 通过

- 代码：`panes/agent-pane-state.tsx` 四态骨架（PaneContentSkeleton / PaneEmptyState / PaneUnavailableState / PaneTechnicalDetails），context/run/review/evidence/operations 五 pane 接入；unavailable 统一为诚实卡 + 结构占位（`placeholderNote`），非孤卡。
- 证据：`after-r9-context-unavailable-1440.png`——runtime unavailable 时 context pane 渲染既有 ContextCanvas 结构 + 「Runtime or context capability is unavailable. No pack was fabricated.」诚实横幅，未伪造上下文包。

### 4. Panes without a contract SHALL be fail-closed in the catalog — ✔ 通过

- 代码：palette 侧 contextMap disabled + 「上下文地图合同尚未注册」，不可打开；host 侧 stub 分支本扫尾会话已删除（见上）。
- e2e：「compact rail palette inserts registered panes and keeps disabled candidates visible」通过——palette 中 contextMap/operations 以 disabled + 原因呈现，选中不开 pane。

### 5. Pane content SHALL lead with user-meaningful labels — ✔ 通过

- 证据：`after-r9-review-pane-1440.png`——review pane 主文本为人读「Proposal」+「Needs contract」StatusChip；`needs_contract` 以 mono code 紧邻 chip（spec 明示允许的次级位置）；`outputRef`/`task-live`/`sequence` 仅以带标签的次级 mono meta 出现于 context 卡，并同时收进默认折叠的「Technical details」 disclosure。无 raw UUID 充当主文本。

## 截图清单（temp/agent-shell-visual-r1/）

| 文件 | 内容 | 审查结论 |
| --- | --- | --- |
| `after-r9-empty-pane-1440.png` | 空会话 + context pane（1440） | composer 贴底、hero/spacer 不渲染 ✔ |
| `after-r9-conversation-dock-1440.png` | 会话中 + run/review dock（1440） | 组合稳定、composer 贴底 ✔ |
| `after-r9-pane-chrome-closeup.png` | run pane 帧头特写 | 标题单处、版本次级 meta、无 eyebrow ✔ |
| `after-r9-review-pane-1440.png` | review pane 人读化 | 人读主文本、ref/序号次级化、技术明细折叠 ✔ |
| `after-r9-context-unavailable-1440.png` | context pane unavailable | 诚实横幅 + 结构在位、无伪造 pack ✔ |
| `after-r9-tablet-1024.png` | 1024 视口（tablet sheet） | sheet + backdrop 正常，无横向溢出 ✔ |
| `after-r9-mobile-sheet-390.png` | 390 视口（mobile sheet） | 全宽 sheet、共享帧头 ✔（内容少时下方留白为 sheet 固有形态） |

截图由临时 Playwright 脚本（fixture 复制自 `e2e/agent-pi-workspace.spec.ts`，dev server :4173）捕获，脚本用完即删。

## 门禁数字

| 门禁 | 结果 |
| --- | --- |
| `bun run typecheck` | ✔ 通过 |
| `bun run --cwd apps/web vitest run` | 961 tests / 958 passed / 3 failed——全部为已知 HEAD 失败（orbit-visual-blacklist ×2、studio-file-preview ×1），与本 change 无关，按要求未修 |
| `bun run --cwd apps/web e2e -- agent-first agent-pi-workspace` | ✔ 17 passed（agent-first 9 + agent-pi-workspace 8），0 failed |
| `bun run compose:i18n && bun run check:i18n` | ✔ OK（2491 keys / 21 namespaces；2491 server keys / 48 bootstrap / 179 compatibility-only） |
| `openspec validate --all --strict` | ✔ 33 passed, 0 failed |

vitest 备注：首次全量运行曾出现 4 failed（3 已知 + 1 未识别），随后两次全量复跑均稳定为 3 个已知失败，未复现的第 4 个按偶发 flake 记录。

## 遗留项

- locale key `agent.detail.contextMap.unavailable` 已无任何代码引用（stub 删除后），仍留在 `api/locale/source/**` 与生成产物中；check:i18n 通过，属无害残留。若 contextMap 合同后续注册可复用，否则可在后续 locale 清理中移除。
- context pane 在 runtime unavailable 时仍显示「Prepare context pack」CTA（ContextCanvas 既有形态）；是否在该态下禁用 CTA 超出本 change 范围，建议后续评估。
- 390 sheet 在内容较少时下方有大片固有留白，属 sheet 全屏形态现状，非本 change 回归。
- tasks.md 勾选与 spec 归档归主会话处理，本扫尾未改动 tasks.md / spec。
