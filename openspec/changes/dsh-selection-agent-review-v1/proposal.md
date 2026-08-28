## Why

DSH Web 已能渲染会话、文件与 Markdown，但文本选区、页面截图与桌面截图只是瞬态浏览器状态：无法锚定、无法评论、无法逐位置审批 Agent 的修改建议。用户需要在不离开当前上下文的情况下，对任意可见位置提问、评论、要求修改，并按位置批准或拒绝 Agent 提案。现在需要在浏览器不成为真相源、不绕过 File Host 版本围栏的前提下，把这些交互统一成可持久化的 Agent 协作对象。

## What Changes

- 将产品准入冻结为 `split-owner`：`agent/harness-plugins` 拥有选区/截图标注 UI 与批注面板；Conversation Composer/Runtime 复用 DSH 既有输入与执行；File Host 拥有文件读取、版本校验与补丁应用；Web capture adapter 只提供可见区域与完整页面截图；系统窗口与完整桌面截图保留给未来跨平台 Desktop Client owner。
- 新增 Selection Anchor V1 协议：文件范围、Markdown 渲染→源码范围、DOM 区域、图像单点、图像矩形五类锚点，统一携带 artifactRef、artifactVersion、quotePreview、quoteDigest、freshness 与 reanchorEvidence。
- 新增 Annotation Batch：一次把多个锚点（含同一截图的多个标记）联合提交给 Agent；Agent 回复必须引用标记编号（`#1`/`#2`/`#3`）。
- 新增可复用 Compact Agent Composer seam：紧凑密度下的询问/评论/修改三意图，展开到主输入框不丢草稿，`修改` 强制 `preview-first`，评论默认不调用模型。
- 新增截图标注画布：点、矩形、文本区域、DOM 元素区域锚点，坐标使用图像归一化值，缩放/高 DPI 下保持对齐；密码输入框遮盖、private DOM 区域不进入截图。
- 新增多位置 Proposal 与逐位置审批：批准/拒绝/要求修改/暂不处理，部分批准只应用已批准且依赖完整的补丁，依赖不完整时阻断并列出依赖关系。
- 新增版本围栏应用合同：文件修改必须携带 `baseVersion`，版本漂移进入 `reconcile_required`，禁止静默覆盖；浏览器不得提交任意 patch 字符串，只使用 owner 发布的 action descriptor。
- 所有批准、拒绝与应用结果产生 owner receipt；`无审批自动修改` 被拒绝。
- 不包含 breaking change；全部为新增 capability 与新增包，现有 consumer 语义不变。

## Capabilities

### New Capabilities

- `dsh-selection-agent-review`: 锚点协议、批注批、紧凑 Composer seam、截图标注、多位置审批、版本围栏、隐私 redaction、键盘可达与证据要求。

### Modified Capabilities

无。现有 conversation 渲染、file host 与 pane capability 保持原语义；新行为通过独立 capability detection 接入。

## Impact

- Host 合同：新增 `packages/host/dsh-selection-host`（`@yeisme/dsh-selection-host`），定义锚点/批注/提案/审批/应用/捕获合同、zod 校验、digest 与 node 参考实现（内存 annotation service + 版本围栏 apply loop）。
- Client：新增 `packages/client/ui-selection-annotation`（`@yeisme/dsh-client-ui-selection-annotation`）：Markdown 源码位置映射、图像归一化坐标、浮动选区工具条、Compact Composer seam 控制器、审批面板控制器、批注画布与 DSH Web client 入口。
- Bundle：新增 `packages/bundle/dsh-selection-annotation`（`@yeisme/dsh-selection-annotation`）单行 profile patch，ModuleLoader 单文件契约。
- File Host / Composer / Conversation Runtime：canonical owner 不迁入本仓；本仓只定义 typed safe contract 并消费，真实 owner seam 由 DSH core / Desktop Client 独立交付。
- 测试与证据：聚焦 Vitest（unit + jsdom integration + bundle 真实产物冒烟）、TypeScript 检查、`check:bundles` 与 `temp/integration-test-runs/<run-id>/` 脱敏证据。
- 依赖：复用 React、zod 与现有测试栈，不新增 UI/runtime 依赖。
