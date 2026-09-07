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
