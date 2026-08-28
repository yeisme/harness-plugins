# DSH Selection & Annotation Agent Interaction V1

> Normative spec: `openspec/changes/dsh-selection-agent-review-v1/`（含
> proposal / design / tasks / capability delta）。本文是仓库级产品/设计摘要。

把文本选区、页面截图和桌面截图统一成可锚定的 Agent 协作对象：用户在任意
位置提问、评论、要求修改，并逐位置批准 Agent 的变更建议。

## Owner 决策（split-owner）

| 能力 | Canonical owner |
|---|---|
| 文件/Markdown 选区、截图标注 UI、批注面板 | `agent/harness-plugins` |
| 迷你 Agent 输入框、流式回复、模型和权限状态 | DSH Conversation Composer/Runtime（seam 注入） |
| 文件内容读取、版本校验、应用补丁 | File Host |
| Agent 请求执行、停止、重试 | DSH Conversation Runtime |
| 当前网页截图（可见区域/完整页面） | DSH Web capture adapter |
| 任意窗口/完整桌面截图 | Desktop Client（独立 owner，Web 永远 probe unavailable） |
| 评论、决策、审计记录 | Host annotation service |
| 多位置修改审批 | Proposal/Approval owner service |

浏览器仅保存临时选择状态；持久化对象由 annotation service 发布，文件修改
必须携带 `baseVersion`，版本漂移进入 `reconcile_required`，禁止静默覆盖。

## 交付物

- `packages/host/dsh-selection-host` — 锚点协议（五类）、Annotation Batch、
  Proposal Hunk 状态机、部分批准/依赖阻断 planner、版本围栏 apply 合同、
  Web/Desktop capture 分层合同、zod 校验与 digest；`./node` 提供内存参考
  实现（annotation service + 版本化文件存储）。
- `packages/client/ui-selection-annotation` — Markdown 源码位置映射（无提示
  诚实降级，不伪造行号）、图像归一化坐标、浮动选区工具条（翻转/键盘/Esc/
  边缘锚点/窄面板图标）、Compact Agent Composer seam（草稿保留、
  preview-first 强制、评论默认不调模型）、审批面板控制器、截图批注画布。
- `packages/bundle/dsh-selection-annotation` — 单行 profile patch 的
  ModuleLoader 单文件 bundle，真实产物冒烟。

## 能力账本（冻结）

| 能力 | 状态 | 交付 |
|---|---|---|
| 文本选中后询问 Agent | required | V1 ✅ |
| Markdown 渲染内容选区映射回源码 | required | V1 ✅（宿主提示就绪时精确映射，缺失诚实降级为 unmapped DomRegion） |
| 文件源码选区评论 | required | V1 ✅ |
| 选区人工编辑 | required | V1 ✅（编辑意图经 Composer/宿主桥接） |
| Agent 局部修改并展示 diff | required | V1 ✅（hunk 级 safeSummary + 查看局部 diff 动作） |
| 多位置逐项批准、拒绝、要求重做 | required | V1 ✅ |
| 可见页面和完整页面截图批注 | required | V1 ✅（合同+画布；真实捕获待 Web adapter seam） |
| 截图多点、多区域联合提交 | required | V1 ✅ |
| 迷你版 Agent 输入框 | required | V1 ✅（seam + overlay） |
| 系统窗口、完整桌面截图 | V2 | 独立 Desktop owner；Web probe 永远 unavailable |
| 评论跨会话恢复 | committed | V2 独立 OpenSpec；V1 不部分实现、不移除扩展点 |
| 多人实时协作评论 | exploratory | 后续，不承诺时间表 |
| 无审批自动修改 | rejected | 永久拒绝 |

## 宿主桥接

bundle 不拥有会话/文件/截图状态，宿主经两个 CustomEvent 接入：

- `dsh-selection-annotation:submit` — `{ intent, text, anchor, approvalPolicy:
  'preview-first' }`：发送/评论本地保存/展开到完整输入框时触发。
- `dsh-selection-annotation:add-to-batch` — `{ anchor }`：更多菜单"加入批
  注组"，与截图标记联合提交。

## 关键不变量

1. 锚点是唯一 join 键；五类锚点共用 artifact/version/digest/freshness。
2. 无 DOM 映射的截图/渲染选区明确标注，绝不伪造代码位置。
3. 截图锚点使用 0..1 归一化坐标，缩放/高 DPI 下保持对齐。
4. `Agent 修改` 永远 preview-first 且需要用户审批；无审批自动修改被拒绝。
5. 部分批准只应用已批准且依赖闭包完整的 hunks，依赖不完整阻断并列出。
6. 浏览器不得提交任意 patch 字符串，只使用 owner patchRef + baseVersion。
7. 页面/文件/截图内容是不可信上下文，只作引用材料，不当指令执行。
8. 所有批准、拒绝、应用结果产生 owner receipt，字段脱敏。

## V2+（不在本变更内）

- 评论跨会话恢复（committed）、多人实时协作（exploratory）。
- Desktop Capture Adapter 真实 owner seam（平台权限边界已固化在合同中）。
- 上游渲染器源码位置提示（`data-source-*`）合入前的降级路径已就绪。
