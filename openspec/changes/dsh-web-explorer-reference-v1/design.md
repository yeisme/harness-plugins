## Context

DSH Web 目前同时存在 `dsh.explorer`、`file.tree`、`workspace.explorer` 与 `desktop.files`。它们的数据来源、打开规则和布局行为不同：canonical provider 没有绑定真实 File Host，部分旧 adapter 会过滤隐藏条目或把文件误投影为目录，文件打开又绕过 owner 预览证明。引用侧只有临时文本或 selection 事件，没有可以随资源版本演进、随消息冻结的统一合同。

本 change 由 Harness Plugins 拥有 Web UI、本地 File Host adapter 与兼容迁移；DSH Conversation owner 后续接入结构化发送 seam；Hosted session 授权与租户隔离仍由 Harness Control Plane 拥有。TUI 只消费新增合同和 fixtures，不在本轮复制 Web 文件管理 UI。

## Goals / Non-Goals

**Goals:**

- 用一个 `dsh.explorer` 实例承载所有文件导航入口，并保留可回滚的旧 kind alias。
- 提供分页、opaque-ref、全量可见的 `FileTreeProjectionCapabilityV2`。
- 以 owner `inspect/openRendition` 的 usable `ready|partial` 结果作为打开和引用的唯一准入证据。
- 提供一个活动引用、最多八个固定引用和 revisioned dispatch 的 `ComposerReferenceCapabilityV1`。
- 覆盖 hover/focus、键盘、触控、宽窄屏和 primary/checked 分离的交互状态。
- 阻止无效 session 的 V2 请求回退本地进程目录。

**Non-Goals:**

- 不实现完整 TUI 文件管理 UI。
- 不让浏览器获得绝对路径、任意 URL、凭据或 workspace authority。
- 不以扩展名、MIME 或旧 `open` capability 单独证明资源可打开。
- 不在本 change 删除公开旧 kind，也不建立第二套 Composer。

## Decisions

### 1. Canonical Explorer 采用可绑定的数据源，而不是注册第二个树 provider

`ui-pane-workbench` 保持唯一 `dsh.explorer` provider，并增加一个可订阅的 runtime binding。Desktop Workbench 在解析当前 session owner 和 File Host 后绑定 V2 数据源、打开回调和 metadata inspect；旧入口只打开同一 kind。这样不引入 Pane Workbench 到 Desktop Workbench 的反向依赖，也不复制树状态。

替代方案是让每个 bundle 各自注册树组件；该方案会继续产生重复 selection、preview 和布局状态，因此不采用。

### 2. V2 页面携带 owner fence，节点只使用 opaque ref

每个 roots/list/search/reveal 页面均返回 `workspaceRef`、`generation`、`revision`、`nextCursor` 与 `truncated`。节点表达 hidden、ignored、sensitive、symlink/broken/out-of-scope 和 typed availability。浏览器只回传 owner 签发的 opaque ref、cursor 和预期 fence；Host 负责排序、分页、搜索和路径边界验证。

目录逐层懒加载，前端只虚拟化已加载的可见行；全仓搜索不在浏览器遍历整棵树。目录展开不受预览门限制。

### 3. 预览证明与显示资源分层

File Host 提供不泄漏路径的 inspect 结果，Desktop adapter 把成功证明转换为现有 `PreviewResourceV1`。只有 owner 返回 usable `ready|partial`，并且 rendition/access handle 成功建立，Explorer 才打开 preview 或创建引用。`partial` 引用必须包含 owner 证明过的窗口或明确 selection anchor。

敏感资源 inspect 先返回名称与 metadata；正文 reveal token 绑定 session、resource ref、version，并在 session 或 version 变化后失效。symlink 默认不跟随，只有 Host 验证目标在当前 workspace、非循环且可解析后才给出 reveal availability。

### 4. Explorer 状态区分 primary、checked 与 pinned

树 reducer 保留唯一 primary preview ref，并维护独立 checked set。目录单击展开/折叠；文件单击替换临时 preview，双击或 Enter 固定内容 Tab。Desktop 宽屏锁定 navigator 并在相邻 content group 打开；窄屏进入 content page，并提供返回 Explorer 与焦点恢复。

hover 或 keyboard focus 稳定 350ms 后才请求 metadata，不读取正文。请求期间行内和锚定卡同时显示 pending；pointer coarse 环境只通过显式 Info/More 进入。

### 5. 引用使用共享 revisioned controller，并投影到公开 dock

`ComposerReferenceCapabilityV1` 的 `snapshot/subscribe/dispatch` 管理一个活动引用和最多八个固定引用。成功文件预览替换活动引用；Pin 才进入固定集合。selection adapter 只在明确引用动作时提交已有 anchor，不改变 selection owner。

引用记录 owner/ref/version、scope、bounded quote、digest、label、freshness 和可选 preview window。已发送快照不可变；owner version 变化只把当前引用标记 stale，并提供查看当前版本动作。

引用 chips 只挂载在 `conversation.input.dock`。若 DSH Conversation 未提供结构化发送 capability，controller 返回 typed blocked，dock 只提供显式复制为 `@mention`/引用文本；不得把结构化引用静默拼进正文，也不得创建备用输入框。

### 6. 兼容迁移分两个 release

- Release 1：旧 provider 不再出现在 picker；旧 kind 由 shim 渲染 canonical Explorer 并产生弃用诊断，所有按钮和 `/explorer`、`/files` 打开 `dsh.explorer`。
- Release 2：停止创建旧 view 实例，只保留请求和持久化 alias。
- 兼容窗口结束后的下一 release：才允许通过独立 breaking change 删除 alias。

回滚开关恢复 legacy Explorer policy，并禁用结构化引用发送；已有布局、引用快照和 stale 标记保留。

## Risks / Trade-offs

- [Host 分页期间目录发生变化导致游标漂移] → 页面带 generation/revision；漂移返回 typed stale 并从最近已知父节点重载。
- [大目录使前端状态膨胀] → Host 分页、逐层加载和行虚拟化；不在浏览器全仓枚举。
- [旧 kind 持久化布局重复显示] → Release 1 shim 共用同一 runtime，隐藏 picker，并在打开后引导 canonical kind。
- [上游 Conversation 尚无结构化发送 seam] → fail-closed，保留可复制文本；不拦截或改写现有输入协议。
- [敏感内容或 symlink 泄漏] → metadata 与正文分离，reveal token 绑定 session/ref/version，所有解析留在 owner。

## Migration Plan

1. Additive 发布 V2 tree、inspect proof、reference controller 与 fixtures。
2. Desktop Workbench 绑定真实 owner，canonical Explorer 进入 opt-in canary；旧入口转 shim。
3. 浏览器和集成验收覆盖 1440/768/390、键盘、coarse pointer、session drift、symlink 与 stale。
4. 连续七天真实使用且无数据/授权事故后默认启用 Phase A。
5. Release 2 收窄旧 kind 为 request/persistence alias；后续单独审批移除。

## Open Questions

无阻塞问题。Hosted 结构化发送与授权证据属于外部 owner 的后续 capability negotiation，不影响本地 first-support。
