# @yeisme/dsh-client-ui-selection-annotation

DSH Web selection & annotation client for the Selection & Annotation Agent
Interaction V1 program.

The `./client` entry grafts onto the conversation DOM without slot
registration or host shadowing; host contracts live in
`@yeisme/dsh-selection-host` — the browser never sees patch text,
credentials or screenshot bytes. Kill-switch:
`localStorage['dsh-selection-annotation'] = 'off'`.

## 入口（./client）

```ts
import { apply } from '@yeisme/dsh-client-ui-selection-annotation/client'

const dispose = await apply(ctx, {
  artifactRef: 'projection:rendered',   // 渲染面 opaque ref
  artifactVersion: 'pv1',
  sourceArtifactRef: 'file:README.md',  // Markdown 预览的源码 artifact
  narrow: false,                        // 窄面板：工具条降级为图标按钮
  composerAdapter: {                    // 宿主 Conversation Composer/Runtime seam
    send: async input => { /* intent | text | anchorIds | approvalPolicy */ },
    modelLabel: () => 'GLM-4.7',
    permissionLabel: () => 'preview-first',
    stop: () => {}, retry: () => {},
  },
})
```

无 `composerAdapter` 时诚实降级：评论本地保存（不调模型）、询问 blocked
（`composer-adapter-unavailable`）、修改强制 preview-first 无法绕过。

### 桥接事件（CustomEvent）

| 事件 | detail | 触发 |
|---|---|---|
| `dsh-selection-annotation:submit` | `{ intent, text, anchor, approvalPolicy: 'preview-first' }` | 发送成功 / 评论本地保存 / 展开到完整输入框 |
| `dsh-selection-annotation:add-to-batch` | `{ anchor }` | 工具条"更多 → 加入批注组" |

宿主/工作台监听这两个事件即可把锚点接进批注面板与 Proposal/Approval
owner service，不需要 fork 本包。

## 模块 API（包根导出）

- **dom-anchors** — `selectionToAnchorDraft(capture, ctx)`（异步，含 digest）：
  有 `data-source-*` 提示 → `markdown-range`/`file-range`（单调性校验）；
  无提示 → `dom-region` + `unmappedReason`，绝不伪造行号。
  `resolveSourceRange` / `resolveSelectionSourceRange` / `captureFromSelection`。
- **image-region** — `toNormalized`/`fromNormalized`/`clampRegion`/
  `pointInRegion`/`roundTripRegion`（缩放/高 DPI 不变式）/
  `pixelOffsetToNormalized`。
- **composer** — `CompactComposerController`：意图切换、草稿跨展开保留、
  1–6 行自增、280–480px 宽度、输入历史、preview-first 拒绝非预览提交、
  评论默认不调模型（`setModelResponseForComment(true)` 显式开启）。
- **toolbar** — `placeToolbar`（纯定位：上方 8px/翻转/水平 clamp）、
  `edgeAnchorSide`（滚出视口收缩为边缘锚点）、`SelectionToolbarController`
  （DOM：键盘导航、Esc、窄图标模式）。
- **approval** — `ApprovalPanelController`：逐位置决策（approve/reject/
  revision/defer）、`approveSelected`、依赖阻断与版本冲突行投影、行级键盘
  焦点、`viewSource/viewDiff/openWorkbench` 事件、`apply()` 交回 owner。
- **AnnotationCanvas**（React）— 点/矩形标记（归一化坐标百分比布局）、
  `#N` 编号、每标记备注与删除、`onMarkersChange`/`onSubmitBatch`、
  `maxMarkers`（默认 200）、无 DOM 映射时标注"无 DOM 映射"。
- **locales** — `labelsFor(language)` zh/en 全量标签。

## 测试

`pnpm test`：unit（映射/坐标/Composer/工具条/审批/画布）+ integration
（jsdom 端到端闭环：选择→提交事件；批注→提案→逐位置审批→版本围栏应用
receipt；漂移协调）。正式安装走 bundle：
`dsh plugin --profile web add @yeisme/dsh-selection-annotation`。

Spec: `openspec/changes/dsh-selection-agent-review-v1/`；
仓库级摘要：`docs/design/dsh-selection-agent-review-v1.md`。
