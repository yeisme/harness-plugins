## Context

本仓库已经提供 Pane Workbench、Desktop Workbench 与 Rich Media，但它们主要解决布局、通用工具视图和媒体展示，没有定义多创作 owner 的统一读模型、动作表单或跨产物交接。Creator Studio 必须运行在 DSH 已发布的 Host/Client surface 上；浏览器只能看到 safe projection，且不能成为 Eikona、Scaena、Sonora、Auctra、Pinax、Anatomia 的 canonical store。

该变更横跨 Pane 协议、Pane 客户端运行时、新 Host Remote、新 Web UI 和可安装 bundle。最高优先级约束是 tenant/workspace 隔离、owner 权威、未知 settlement 保真、无重复 shell，以及在插件能力未合入或未安装时不出现死按钮。

## Goals / Non-Goals

**Goals:**

- 在现有 Pane Workbench right/bottom region 中提供任务优先的统一创作体验。
- 让六个 owner 通过一致的 adapter contract 发布有界快照、动作描述、产物引用与 receipt。
- 支持 local/service 两种 adapter，并在单次读取或动作中确定性选择一个 transport。
- 让文字、图像、音频、视频/短剧、资料、分析、审阅和生成队列共享导航与 artifact intent。
- 对缺失能力、stale/partial/unknown、上下文漂移和动作 settlement 不确定性 fail closed。
- 形成独立、可发布、可通过 `dsh plugin --profile web add` 安装的组合 bundle。

**Non-Goals:**

- 不实现任何领域模型/provider、凭据管理、OAuth、计费、模型路由或内容存储。
- 不创建 scheduler、task ledger、writer lease、approval ledger、capacity reservation 或 terminal result。
- 不从 browser、Cookie、URL、旧快照或 AccessTicket 推导 Host expected context。
- 不创建第二侧栏、overlay、iframe bridge 或浏览器 domain store。
- 不在不确定 mutation 后自动 retry、切换 transport 或替换 writer。

## Decisions

### 1. Creator Studio 作为一个 Pane runtime plugin 注册

客户端通过 Pane Workbench 的 `registerPlugin` 原子注册 view、command 和 intent handler；旧运行时只使用逐项注册兼容路径。Creator Studio 自身不拥有布局，只请求已有 right/bottom region。

选择该方案是因为 Pane 已经拥有 focus、retention、dirty guard、dock 和恢复语义。独立 overlay 或第二 shell 会复制布局所有权并造成入口、快捷键和状态竞争。

### 2. Host 使用冻结上下文与 owner directory

`CreatorStudioGateway` 在构造时读取并严格验证完整 expected context，然后保存 detached frozen copy。`CreatorStudioOwnerDirectory` 按 owner 管理 local/service adapter；`auto` 仅在 service 显式 configured 时优先 service，否则使用 local。选定 transport 后发生异常也不 fallback。

这保持了 tenant/workspace/principal/install/plugin/policy/runtime generation 的单一绑定，并避免一次 mutation 在多个 owner transport 上重复执行。

### 3. Remote 只返回安全、有界组合投影

每个 owner snapshot 在过 Host 前验证 schema、owner、transport、context、refs、状态、数量上限和安全文本。owner 不可用时返回不带领域事实的 bounded fallback。只有 Scaena 可以发布跨 owner production、review 和 job 聚合。

媒体内容不以内联 payload 或永久 URL 进入快照；UI 用 artifact ref 请求短期 `http(s)`/`blob` 访问授权。凭据、绝对路径、raw prompt、provider payload 和 private tool arguments 均不进入投影、日志或测试证据。

### 4. 动作必须来自当前 server-authored descriptor

浏览器根据 descriptor 渲染字段、风险、成本、版权和确认状态，但请求只携带 descriptor ref、owner/action、expected target/version、完整 context、idempotency key 与临时 values。Host 在 dispatch 前再次读取 fresh/ready owner snapshot，并逐项比较 descriptor、context、target/version、字段与 expiry。

动作最多调用选定 adapter 一次。不可验证返回或 transport 异常变成 `unknown`；stale、漂移或 descriptor 变化变成 `reconcile_required`。`approval` 仍由 owner receipt 决定，Creator Studio 不自建审批账本。

### 5. Artifact intent 是跨工具组合边界

Pane runtime 按优先级和注册顺序确定性选择第一个匹配 handler。`open`/`compare` 打开共享媒体 Pane；`attach_context`/`handoff` 只在目标 owner fresh/ready 且发布匹配 descriptor 时执行。中高风险或需要确认的 handoff 先打开目标工作区，由用户查看 owner preview。

该边界让工具之间只交换版本化 artifact ref 与意图，不复制领域对象，也不让来源插件直接调用目标 provider。

### 6. 客户端状态只缓存投影，不缓存输入

Controller 使用单飞 snapshot read、snapshot ref/version 检查和 runtime/session generation reset。动作 values 留在 React 表单局部状态；提交后不进入 store、持久化或 receipt。接受/完成/partial 后可发起只读 refresh，但 unknown 不触发重试。

### 7. 安装 bundle 只拥有一条 profile 行

`@yeisme/dsh-creator-studio` 挂载共享、引用计数的 directory 与 Remote，并打包 Web client。它不隐式插入 Pane/Desktop 行，以避免用户已安装两个基础 bundle 时重复启动。能力探针失败时仅注册带原因的禁用入口。

## Risks / Trade-offs

- [Owner 尚未实现 adapter] → 六个 owner 卡片显示 offline/contract 状态，动作入口不出现；不会伪造示例生产数据。
- [轮询增加读取成本] → 使用 15 秒有界轮询、单飞读取和 session/reset 清理；后续可在不改变 projection contract 的情况下接入 event cursor。
- [共享 Rich Media client 的聚合入口较重] → Creator bundle 在浏览器构建中绑定媒体预览叶子文件，避免链接旧 workbench 导出。
- [第三方 owner 发布不安全文本或未知字段] → Host strict schema 拒绝整份 owner snapshot，并降级为 contract mismatch/offline fallback。
- [动作 settlement 超时但 owner 已执行] → 返回 unknown + reconcile reason，禁止自动 retry，并保留 idempotency/receipt refs 供 owner 对账。
- [Pane V2 seam 未安装] → 只显示禁用的“创作”入口及原因，不创建临时 overlay 或第二布局。

## Migration Plan

1. 先发布 Pane protocol/runtime 的向后兼容扩展；旧插件无需使用 command/intent/action surface。
2. 发布 Creator Studio Host 与 Client packages，并以缺少 owner adapter 的 fail-closed 状态验证。
3. 发布独立 Creator Studio bundle；现有 profile 依次安装 Pane Workbench、Desktop Workbench、Creator Studio。
4. 各领域 owner 按需注册 local/service adapter；服务 transport 只有在完成 endpoint/auth 配置后设置 `configured: true`。
5. 回滚时仅移除 `dsh-creator-studio` profile 行；Pane/Desktop 与领域 owner 状态不受影响。

## Open Questions

- 各 owner 的生产 adapter、provider 权限和计费 receipt 由对应项目在后续 owner-gated change 中定义。
- DSH upstream 若提供正式 ToolView 注册 seam，可在能力探针通过后接入当前纯 `CreatorActionToolView`，本 change 不猜测私有 API。
- 高频事件流可在 owner 发布稳定 cursor contract 后替换部分轮询，但 unknown settlement 规则保持不变。
