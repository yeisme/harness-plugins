# @yeisme/dsh-creator-studio

Creator Studio 安装包组合各领域入口。Eikona 图像工作台和 Scaena 制作台使用独立 Pane、查询与恢复状态，默认支持本地 CLI 和用户级配置；其他入口继续保留。领域 owner 分工如下：

- Eikona：图像生成与视觉资产。
- Scaena：视频、分镜、短剧编排、审阅与导出。
- Sonora：语音、音乐、音效与音频资源。
- Auctra：文章、脚本、改写与文字版本对比。
- Pinax：资料、世界观、人物卡和上下文引用。
- Anatomia：内容分析、质量指标和结构诊断。

“创作”是唯一常驻入口，只打开 Creator Home。文字、视觉、音频、完整做剧、资料、跨 owner 资产、分析、生成队列和审批队列均作为独立 Pane 按需打开。资产默认当前项目，可显式切换到当前授权 tenant 的全部项目；生成与审批事实来自 Ordo 安全投影。

## 本地安装

```sh
dsh plugin --profile web add ./packages/bundle/pane-workbench
dsh plugin --profile web add ./packages/bundle/dsh-desktop-workbench
dsh plugin --profile web add ./packages/bundle/dsh-creator-studio
```

Creator Studio 只增加一条 profile 行，不会再创建一个 Pane shell、侧栏、调度器或任务账本。缺少 Pane V2、Host Remote 或 owner adapter 时，“创作”入口会安全禁用或显示离线状态。

## Host 集成

服务端必须在 bundle 构造网关之前提供完整且冻结的 `creatorStudioExpectedContext`。不能从浏览器参数、旧快照、Cookie 或访问票据反推该绑定。

```ts
import CreatorStudioPlugin, {
  CREATOR_STUDIO_EXPECTED_CONTEXT,
  registerCreatorStudioOwner,
} from '@yeisme/dsh-creator-studio'

ctx.provide(CREATOR_STUDIO_EXPECTED_CONTEXT, expectedContext)
await ctx.plugin(CreatorStudioPlugin)

const disposeEikona = registerCreatorStudioOwner(ctx, eikonaAdapter)
```

每个 adapter 只返回安全投影、短期媒体访问授权和 owner receipt；可选 `listAssets` 为全部项目资产查询提供 Host 侧有界数据。动作只按当前 server-authored descriptor 执行一次；`unknown`、`partial`、`cancel_unknown`、stale cursor 或上下文漂移都要求 owner reconcile，不会自动重试或替换 writer。

## Sonora 字幕导出 adapter

本 bundle 导出 `SonoraSubtitleExportClient` 和 `createSonoraSubtitleExportAdapter`。Host 集成提供按 Creator 完整上下文解析的已授权 Sonora 连接，以及按项目返回当前字幕轨道 ref 的选择回调；创建 adapter 后，通过既有 `registerCreatorStudioOwner` 注册并保存其 disposer。连接信息不进入浏览器，也不从 Composer 参数读取地址或凭据。

此 adapter 是已有字幕轨道的导出切片：读取 Sonora 的固定 track/review 信息，只有可读且审阅通过时发布 SRT/VTT 确认操作；完成返回 owner 资源引用。丢失回执时按原幂等键只读查询，不使用当前轨道版本代替旧输入，不重发创建。readArtifactContent可读取摘要、长度和编码验证后的正文，沿用现有256Ki字符编辑器上限，不截断较大文件。它尚未提供配音、音乐、音效、词级对齐或完整用户端下载，不应覆盖已安装的完整 Sonora service adapter。

`node scripts/run-sonora-subtitle-integration.mjs` 验证 directory/gateway/adapter 与 HTTP fixture，并保存脱敏证据；该测试不代表真实 Sonora 配置或浏览器验收。

`node scripts/run-sonora-owner-http-integration.mjs`额外启动临时Sonora进程，经实际HTTP/SQLite验证持久导出、正文和丢失回执恢复。它使用fixture身份与transcription，不读取用户配置或调用声音provider；进程结束清理临时项目，证据保存在本仓temp/integration-test-runs。

## 创作内容渲染 profile

Mermaid 图形使用现有独立渲染 bundle，通过正常 ModuleLoader 挂载；需要在同一测试／使用 profile 安装 `@yeisme/dsh-mermaid-render`（本地路径 `packages/bundle/dsh-mermaid-render`）。Creator 继续输出可编辑 Mermaid 源码，不在自身 bundle 复制 parser。未安装 renderer 时只有源码表示，不能把该 profile 记为图形预览验收通过。HTML 静态结构和图片／表格沿用 Rich Media；图片“查看图像”允许缩放平移，“框选区域”锁定坐标变换并保留归一化选区。

## Eikona 能力发现 adapter

安装包导出 `EikonaDiscoveryClient`、`createEikonaDiscoveryAdapter` 与 `EikonaDiscoveryConnection`。Host 按完整 Creator 上下文提供连接解析函数，然后使用现有 `registerCreatorStudioOwner` 注册，并在集成退出时调用返回的 disposer。它是 service adapter；不要用该只读切片替换已有完整 Eikona adapter。

```ts
import {
  EikonaDiscoveryClient,
  createEikonaDiscoveryAdapter,
  registerCreatorStudioOwner,
} from '@yeisme/dsh-creator-studio'

// ctx and resolveEikonaConnection are supplied by the authorized Host integration.
const client = new EikonaDiscoveryClient(resolveEikonaConnection)
const unregister = registerCreatorStudioOwner(ctx, createEikonaDiscoveryAdapter(client, true))
// Call unregister() when this integration is disposed.
```

解析函数接收 CreatorStudioContextV1，返回当前授权的 context、loopback baseURL、headers，以及 admission 中的 approved/schemaDigest/sdkDigest；无连接时返回 undefined。地址、凭据及摘要 pin 只来自受信任 Host 配置，不接受浏览器表单传入，也不根据首次网络响应自动批准或更新 pin。客户端还提供显式资产／媒体／审阅读取与采用提交／原键对账；只读 discovery adapter 不发布执行 descriptor。客户端不会启动 Eikona 服务，能力读取不构成执行授权。

Phase A 返回的生成、审阅和交接能力保留为配置页中的未就绪状态，不放入图片资产列表；即使 owner 报告 available，也只说明还需独立的输入、费用和授权确认。此切片没有执行 descriptor。schema digest 包含能力及 kill switch 状态，因此 owner 装配改变时需重新核对配置中的 pin；观察时间变化不要求换 pin。

验证命令：

```bash
node scripts/run-eikona-discovery-integration.mjs
node scripts/run-ui-visual-tests.mjs visual-eikona-pages.spec.ts
```

第一个命令使用实际 Go owner discovery 和 HTTP handler，经 Host client、adapter、directory、Gateway 验证；服务身份和目录为临时 fixture，未覆盖完整 serve middleware 或 live 授权。第二个命令验证合成内容下的实际浏览器页面、中英文和三种宽度。两类证据分别保存在本项目 temp/integration-test-runs；二者均不证明生产装配或真实图像生成已完成。

## Eikona 候选审阅 adapter

安装包增量导出 `createEikonaReviewAdapter` 与 `EikonaReviewSelection`。它复用 discovery adapter 的读取方法，按 Host 明确选中的 `artifactRef`/`contentDigest` 发布采用确认 descriptor，提交和对账走现有 Gateway 原请求持久化与 owner 回执机制。

```ts
import { EikonaDiscoveryClient, createEikonaReviewAdapter, registerCreatorStudioOwner } from '@yeisme/dsh-creator-studio'

// Both resolvers are supplied by the authorized Host integration.
const client = new EikonaDiscoveryClient(resolveEikonaConnection)
const unregister = registerCreatorStudioOwner(ctx,
  createEikonaReviewAdapter(client, resolveSelectedEikonaImage, true))
// Dispose when the integration unloads.
```

`resolveSelectedEikonaImage(context)` 必须返回当前完整上下文内明确选择的固定图片或 undefined，不从最近结果或列表顺序自动选图。选中变化会使旧动作失效，但不取消原执行，对账仍使用持久化原请求。

采用 transport 还要求 Host 连接 `admission.reviewAdoptionApproved === true` 及已核验的单项目 `assetScope`；默认未开启。可用 descriptor 不代替该权限，也不授权生成、写回或交付。缺连接、选中、owner 前置条件或候选事实时不发布采用动作。

目前证据覆盖本地 owner HTTP、adapter 方法和 bundle 注册；真实 profile 的选中连接、确认 UI 与 Gateway 持久恢复完整路径仍在对应 OpenSpec 中待验收。此构造示例不表示安装后已自动接好用户项目。

需要通过 Pane 显式选择时，可改用增量导出的 `createSelectableEikonaReviewAdapter(client, true)` 注册；它与原注入选择函数的 adapter 二选一。新 adapter 初始无选择，Gateway `selectEikonaCandidate({ selection: { artifactRef, contentDigest } })` 核验后才记录当前完整上下文的固定选择；传入 `selection: null` 清除。此操作不采用候选、不读取媒体正文，也不代替采用确认。

浏览器 Remote 以 `creatorStudio.selectEikonaCandidate@1` 提供严格输入/结果，controller 忽略迟到或上下文变化后的响应；成功选择后调用方需要刷新 snapshot 才能展示当前动作。缓存有界且临时保存，重启后需重新选择。当前代码已覆盖 Remote 合同与 Gateway/实际 owner 选择路径；正式 Pane 按钮接线和用户 profile 装配仍由 OpenSpec 继续推进。

资产页现已接候选选择和同上下文刷新，采用表单显示在资产列表下方；生成配置与采用确认分开。浏览器测试桥已验证本地 owner 选择及采用闭环，仍需正式 Typert/profile 装配验收，安装包不自动提供 owner 地址、凭据或采用授权。

原生浏览器 Remote 增量验收已覆盖真实 Connection/Gateway 源码、WebSocket 连接世代与 HTTP 选择/采用，并修复了 bundle 未注册 `recallOperationIdentity` 和 `listOperationRecoveries` 的遗漏。该验证仍以测试页装配源码，正式 ModuleLoader/profile 和真实生成路径未完成；采用确认前的原请求查询保留，无法查询时不会跳过核验直接提交。


## Eikona 一体化注册

安装包增量导出 `createEikonaStudioAdapter`，组合准备、批准、生成、对账、候选选择和媒体读取。Host 使用同一个经核验的项目连接注册，避免多个 Eikona adapter 覆盖彼此。

```ts
import { EikonaDiscoveryClient, createEikonaStudioAdapter, registerCreatorStudioOwner } from '@yeisme/dsh-creator-studio'

// The Host supplies a verified context-bound connection resolver.
const eikonaClient = new EikonaDiscoveryClient(resolveEikonaConnection)
const unregister = registerCreatorStudioOwner(ctx, createEikonaStudioAdapter(eikonaClient, true))
```

`true` 只标记连接已配置，不授予执行权限。`generationExecutionApproved`、`generationApprovalApproved`、`preparationApproved`、`mediaAccessApproved` 与 `reviewAdoptionApproved` 分别控制对应能力，缺省不授权。连接和凭据只保留在 Host；项目映射来自经核验的 `assetScope`，不能由浏览器或引用前缀推断。安装和恢复不自动批准或执行；运行仍需匹配 owner 批准、固定输入及用户确认。完整专业路径的就绪状态以 OpenSpec 验收为准。

## 本地 CLI 与独立 Pane

新增接线、实际 ModuleLoader 打开/拖拽/恢复验收和仍开放的业务步骤，统一见 [DSH 本地图像与制作 Pane](../../../docs/runtime/dsh-creator-local-cli.md)。早期阶段的未接通记录保留为历史；它们不替代本轮分项证据。
