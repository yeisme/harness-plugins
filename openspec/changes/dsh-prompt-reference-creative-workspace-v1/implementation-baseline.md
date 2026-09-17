# 实施基线与 owner 能力矩阵

本表是 2026-09-07 的仓库源码检查结果，不代表连接到真实领域服务后的能力快照。任务实现时需重新检查实际 descriptor；通用 dispatch 能力不证明某个领域动作已经存在。用户已经授权本 change 的代码实施，当前整体目标保持未完成。

## 主输入框与 Host

Host staging 基线为 `a66e4702047846cdaa10c66c9d3df3951f5ea70d`、版本 `0.1.2-rc.1`，叠加既有引用／Pane／运行清理补丁以及并行任务。使用当前所需 dirty 状态，按自有文件保存写入前基线，不能整体导出 staging diff。`node scripts/dsh-workbench.mjs --check` 已通过；它仅证明兼容构建检查，不证明新增 UI 或发送链路。

输入改动归 Host `ui-conversation`／`ui-reference`／`ui-chat`、插件 `ui-pane-workbench` 的 reference 模块、Selection Annotation 和 desktop bundle 引用桥接。必须保留已存在的工具会话、Pane 导航和搜索改动。新增 Host 能力通过独立 `upstream-prs/editable-prompt-references-v1` 通道交付。

## 已落地的引用接口增量（复审中）

以下记录当前代码位置和语义，不代替兼容与完整验收：

| 接口 | 当前增量 | 边界 |
|---|---|---|
| ComposerReferenceV2 | 可选 prompt 正文／原始正文／来源信息，projection 为 editable-prompt | V1 不重新定义；共享引用摘要投影移除完整 prompt 内容 |
| ComposerReferenceBridgeFeaturesV1 | 可选 editablePrompt | producer 仅在宿主明确提供能力时使用新模式 |
| ComposerReferenceOwnerRegistryV1 | 可选显式 refresh | 原 resolve 仍按版本／digest 严格校验发送；refresh 重新授权并生成新证明 |
| Session refreshReference | 客户端会话方法、Host Remote 与 SessionCommands 刷新入口 | 目标由会话 authority 决定，不用浏览器路径或最近焦点替代 |
| SessionPromptReference | 可选 editable-prompt 投影标记 | server 验证来源后只保留对应编辑文本的追溯信息，正文来自实际提交 |
| session-reference pre-step | 编辑文本不重复生成原文上下文 | 媒体、能力与旧模式继续需要对应已验证快照 |

普通 package bundle 不自动更新新增 Remote；构建顺序需包含定向 Typert 生成及 api-remotes 聚合 client 重建。上下文 package 构建使用明确的 fixedExtension:false 和 clean:false，保留正常 index.js 入口及生成的传输产物。完整可复现命令应随最终 upstream patch 交付。

## 初始成果与环境能力矩阵

| 操作 | 已有源码接口／模块 | 当前可证明的能力 | 缺失交付物及负责方 | 受影响任务 |
|---|---|---|---|---|
| owner snapshot | creator-studio `CreatorOwnerAdapterV1.snapshot`、gateway、directory | 带上下文和 freshness 的安全投影 | 实际服务可用性在运行验收阶段确认 | 4.1、6.6 |
| 通用动作 | `CreatorStudioGateway.dispatch`、`CreatorActionComposer` | descriptor／target／version／expiry 校验与 receipt | 领域 owner 必须提供具体操作 descriptor；插件不能自造成功 | 4.7–4.9 |
| 预览资源 | `resolveArtifact`、Rich Media `MediaHostV1` | 授权短期访问、现有图片／音视频／文档 renderer | 针对选定成果版本的实际资源和范围解析 | 4.2–4.6 |
| 视觉比较 | `MediaCompareView`、`MediaCompareRenderer`、artifact compare intent | 两项媒体的并排／切换／叠加投影 | 成果 owner 的可比较版本与授权内容，不以视觉比较冒充采纳 | 4.8 |
| 编辑草稿保存 | 无专门 typed lifecycle seam；现有表单 values 临时 | 不能宣称持久保存 | 成果 owner 的草稿投影、save descriptor 和 receipt；插件增量消费 | 4.7 |
| 候选版本 | 无专门 typed candidate projection | 通用 dispatch 可承载 owner 已发布动作 | 成果 owner 提供候选资源及状态投影；客户端仅展示 | 4.5–4.8 |
| 采纳 | 无专门 adoption contract | 不能宣称采纳会改变权威版本 | 成果 owner 的采纳 descriptor、版本条件与回执后投影 | 4.8 |
| 源文件写回 | file preview/edit 与 generic owner action 是分离入口 | 原文件编辑不等于成果独立写回 | 成果／文件 owner 提供目标、差异、源版本条件与写回回执 | 4.9 |
| 再次引用 | `ArtifactIntentV1`、`context.attach`／`artifact.handoff` | 已有带版本 ref 的交接机制 | 所选版本／范围到新模式 Composer 的授权展开与插入 | 4.10、3.4 |
| 开发环境发现 | browser provider 仅有 session discovery | 不等同于工作区开发服务目录 | Host／环境 owner 提供工作区、环境、身份提示和访问句柄 | 5.1 |
| 启动／对账 | Browser Host 有通用 dispatch／reconcile，无开发启动语义 | 无法据此假设能启动应用 | 环境 owner 发布显式启动 descriptor 与幂等回执 | 5.2 |
| 运行页面 | browser-host contracts、ui-browser-pane 状态／导航／viewport transport；bundle 注册组件为空 | 有 provider/session 和 viewport lease 合同，未证明完整 UI | 插件接入实际 View；Host 提供受支持 viewport／隔离运行能力 | 5.3、6.6 |

## 实施与验收边界

### 相邻领域源码补充核对

在相邻 `agent/scaena` 的 application/reviewpackage 和 transport/mcplocal 源码中可确认候选读取、版本／digest、visual acceptance，以及 `storyboard.breakdown.revise/accept/reject` 动作；其调用要求 candidate ref、expected version、expected digest 和 idempotency key。这些是 Scaena 领域接口，不是已经连接的 Creator Studio adapter。可据其明确合同开发桥接，但仍需实际 transport 与回执归一验证。

Scaena 的 review-package export 是 bundle 导出，不等于任意成果到源文件的版本条件写回。Anatomia 的诊断／部署 preview、Ordo 的软件交付 candidate 与 Agent runtime start 也不能充当本 change 的创作成果或开发应用环境 owner。Auctra、Eikona、Sonora、Pinax 在本次限定 sibling 源码范围内的 adapter 能力未核实；不把文档中的 owner 名称当成已运行服务。

插件负责添加兼容的语义投影和 action 消费，注册可用 UI、保留临时编辑并显示明确能力限制。持久草稿、候选、采纳和写回仍由领域服务承担；开发环境生命周期仍由环境 owner 承担。不能为关闭任务而添加客户端领域仓库、任意 URL bridge、虚构 adapter 或自动执行。

真实服务缺口必须在运行验收中保留为未完成依赖。协议测试可使用合成 owner，但必须标为协议测试；它不能替代完整产品所需的真实 Host 和成果／开发环境交互证据。

### 引用 Host 局部重建

`node scripts/build-editable-reference-host.mjs --plan` 只展示构建顺序；去掉 `--plan` 后重建 staging Host 的 session-controller、session-reference、remotes aggregate、ui-conversation 和 ui-reference，按需使用 `--include-chat`。该脚本要求 Host 依赖基线已经构建，使用逐包 `tsc -p`，不递归重建依赖。它复用 Host 的客户端构建 preset，保留 ModuleLoader、CSS、external 和 purity 规则，并显式关闭 workspace 扩展与输出清理。

RPC 变更需要重新生成所属包的 Typert Host／Remote 产物，再构建 remotes aggregate；仅重建 UI 或单个 Remote 不足以验证真实传输。脚本不得在源文件仍被并发修改时用作最终候选构建。当前已验证脚本语法及默认／含 chat 两种计划；实际执行和端到端结果另记于 verification.md，不以计划检查替代构建通过。


## 2026-09-08 实施增量复核

初始矩阵保留用于前后对照；下列结果覆盖其中已发生变化的条目。

| 操作 | 当前代码与证据 | 尚未证明的边界 |
|---|---|---|
| 正文读取与再次引用 | Creator Gateway 的 readArtifactContent、带 contentRevision／SHA-256 的 reference owner；真实 Host 编辑、保存、选择 candidate two 并收到 Composer 插入回执 | 测试使用合成 owner，真实领域授权／持久化仍待连接服务 |
| 候选／动作 UI | 已有 typed artifact workspace、candidate projection、save／adopt／writeback descriptor 消费及乱序回执保护 | 具体采纳／写回动作、冲突和 unknown 对账需要所属服务实现和验收 |
| Browser Pane | 正常 Client manifest、真实 React renderer、provider 与 viewport probe；无 provider 时不注册入口 | 无真实 provider／viewport，不能报告运行页面可用；开发环境目录与启动 owner 未提供 |
| 主题按钮 | 共享继承规则使用 :where，实际 Host 主按钮亮暗对比度约 18.90／18.08；视觉回归 106/106 | 最终七门以稳定候选运行结果记录，不把局部样式检查当完整产品验收 |
| Creator 媒体再次引用 | 当前 Creator reference owner 只接受 artifact/body；Host 引用 registry 已可接收 owner image bytes 并生成真实附件／裁剪 | Creator resolveArtifact 仅给短期访问地址，不是可用于发送的二进制读取证明；需所属 owner 提供带版本、摘要和类型的授权资源读取。现有 Host snapshot 无音视频附件类型，音视频发送必须单独扩展 Host／模型接收合同 |

本轮 Host 证据：`temp/integration-test-runs/creative-workspace-host-2026-09-08T02-30-55-511Z-2641224/`。视觉证据：`temp/integration-test-runs/ui-visual-2026-09-08T02-31-16-676Z-2650882/`。媒体与开发环境缺口影响 3.4、4.5–4.10、5.1–5.3、6.6；不得通过客户端任意 URL fetch、描述文字或合成成功回执绕过。

图片条目后续增量：现已新增 readArtifactImage（Host-only）及 artifact/media owner 解析，真实 Host 合成 owner 框选／原生图片发送通过，见 verification.md。原矩阵中“仅 artifact/body”描述为该次核对的历史状态。真实领域服务、音视频附件、环境目录与启动依赖仍未关闭。

## 2026-09-18 seam 清单、合同映射与 UI 合同复核（任务 1.1／1.2／1.4）

以下全部为本仓命令的本次运行结果；与 2026-09-07/09-08 历史证据分开记录，不互相冒充。

### 1.1 当前 Host、profile、输入扩展与引用类型清单

本次运行基线：

- 发布 Host：`@deepseek-ai/dsh@0.1.5-rc.2`（pin 于 `scripts/workbench-runtime.mjs`）。`node scripts/dsh-workbench.mjs --check` 本次 exit 0（"Official workbench runtime 0.1.5-rc.2 verified"）。
- 官方安装树 seam 命中（`node_modules/.pnpm/@deepseek-ai+dsh@0.1.5-rc.2_*` 全树 grep、排除 `.map`）：`editablePrompt`、`refreshReference`、`SessionPromptReference`、`ComposerReferenceV2`、`ComposerReferenceBridgeFeaturesV1`、`ComposerReferenceOwnerRegistryV1` 均为 0 命中。结论：官方发布版 0.1.5-rc.2 无 editable-prompt 引用／refresh／V2 投影 seam；新模式只能经 `upstream-prs` 补丁系列加插件侧 probe 诚实降级，与各任务 Recheck 记录一致。
- 测试 Host（staging）：重建通道 `scripts/build-editable-reference-host.mjs`（仅 `--plan` 级历史验证；脚本自身规定源文件被并发修改时不得作最终候选构建，本次并发脏树未执行重建）。Host 增量补丁系列在仓且 README/apply.sh/baseline.sha256 齐备：`upstream-prs/editable-prompt-references-v1`（host-files.txt 列 29 个文件：ui-conversation input/editor/ReferenceChip/hub/apply、api/session-controller types 与 tests、context/session-reference、apps/web e2e）、前置 `composer-multi-reference-v1`、后续 `editable-prompt-whitespace-v1` 与 `editable-prompt-ack-consumption-v1`；上游均未合入（官方树 0 命中）。
- profile：web profile；`discoverWorkspacePackages` 本次实测 91 个 workspace 包，其中 35 个声明 `dsh.bundle.patch` 并经 `dsh plugin --profile web add link:<dir>` 装载。
- 输入扩展位置：Host 侧＝上列 host-files.txt；插件侧＝`packages/client/ui-pane-workbench/src/explorer/references-v2.ts`（ComposerReferenceV2 类型族与版本化 DOM handoff/probe 事件）、`references.ts`、`packages/bundle/dsh-desktop-workbench/src/client/apply.ts`（Host 插入/移除桥）、`packages/host/dsh-selection-host`（Selection Annotation）、`packages/host/dsh-file-host`。
- 现有引用类型位置：specs＝`openspec/specs/{dsh-composer-reference,dsh-conversation-reference-drafts,creator-studio-artifact-composition,pane-artifact-handoff,dsh-reference-theme-experience,dsh-tools-discovery-draft}`；代码类型＝`references-v2.ts` 的 ComposerReferenceKindV2/IntentV2/ComposerReferenceV2/ComposerReferenceBridgeFeaturesV1；消费方＝`ui-creator-studio/src/artifact-workspace.tsx`、`dsh-desktop-workbench/src/client/apply.ts`、`dsh-file-host/src/index.ts`。
- 历史 vs 本次：2026-09-07 的 0.1.2-rc.1 staging 基线（a66e4702）与 2026-09-08 真实 Host 运行记录为历史证据；本次基线为 0.1.5-rc.2 官方 pin 校验与官方树 seam 0 命中实测。两者分开记录。

### 1.2 既有引用合同映射与兼容用例（锚点）

- 增量能力：`ComposerReferenceBridgeFeaturesV1`（references-v2.ts:84 起）＋ `COMPOSER_REFERENCE_HOST_PROBE_EVENT`；消费方仅 `=== true` 门控（references-v2.ts:99 注释）。测试：desktop-workbench apply.spec.ts probe 用例（`report(true)`／activation 门控）。
- 正文与来源分离：跨面板镜像不保留可编辑正文（reference-composer.spec.tsx "never retains editable bodies in the cross-pane draft mirror"）；Host 侧 SessionPromptReference 投影与 session-reference pre-step 在 editable-prompt-references-v1 补丁内。
- prepare/ack 映射：冻结提交并按本次快照消费（"freezes submitted references and acknowledgement removes only that prepared snapshot"）；残留消费缺陷由 editable-prompt-ack-consumption-v1 系列修复。
- 媒体映射：Host 引用 registry 接收 owner image bytes 生成真实附件/裁剪（2026-09-08 真实 Host 证据见 verification.md）；音视频附件仍缺 Host/模型合同，维持缺口记录。
- 兼容（不重定义 V1、新模式不作失败 fallback）：V1 行为由权威 Host occurrences 替换镜像并去重（"replaces mirrored rows from authoritative Host occurrences and deduplicates exact repeats"）；宿主不可用时诚实排除入草稿（"requires an available host and leaves unavailable or stale references out of drafts"），缺省 hostReason 为 "structured conversation insert capability is unavailable"，不把新模式静默降级为 V1 结构化引用；共享引用摘要投影不携带完整 prompt 正文（本文件前表）。反例（刷新 CAS、prepared 快照拒绝保原引用、重复行去重）均在 reference-composer.spec.tsx。

### 1.4 统一视觉系统核对

- design.md UI Contract 逐项覆盖 `docs/design/dsh-unified-panel-visual-system.md` §12 模板（Surface classification/kind、三级视觉优先级、复用组件、卡片存在理由、Primary scroll owner、State Matrix、Responsive、Accessibility、Visual Exceptions）及共享能力 Cross-host Semantics 段。
- 组件清单实测（本次 grep）：本 change 自有 UI 实际消费的宿主 primitives＝Button（34 个文件）、CodeBlock、MarkdownText（artifact-workspace.tsx、views.tsx、references-v2.ts、client.ts）；design 原复用行中的 Menu/Modal/Pill/DiffBlock 未被自有文件导入（primitives 包已提供，留作后续 diff/菜单面复用候选），design.md 复用行已按实测更正。当前文本 diff 视图用 `cs-diff` 样式（views.tsx:188）。
- 滚动／焦点／分栏能力来源：对话滚动归 Host；输入与成果正文单一滚动；专业视口独立滚动（styles.ts `.cs-professional-inspector`/`.cs-scaena-tree` 70vh overflow、`.cs-image-pan` 平移视口）；焦点由 Host primitive 管理并有显式归还规则（design Accessibility）；分栏按容器宽度切换（styles.ts `@container(max-width:600px)` 单栏回退），放大/展开走宿主能力不改 Pane 几何；token 全走 ui-visual-kit（`--vk-*`）。
- `node scripts/check-ui-surface-contracts.mjs` 本次 exit 1：唯一失败项为并行 lane 已删除的 `packages/client/ui-pane-workbench/src/drag-visuals.tsx` 在 checker allowlist（`scripts/check-ui-surface-contracts.mjs:62`）残留——预先存在／并发失败，与本 change 无关，不由本任务代修。
