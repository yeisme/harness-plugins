## Context

`desktop.file` 当前在浏览器内直接分支 Markdown、媒体与普通文本。文本 read/write 由 `FileHostV1` 提供，但 stock explorer transport 会先把 host path 带到浏览器适配器，再映射成 `FileEntryV1.id`；这不满足本仓库 safe projection 边界，也不能作为 Language Server URI authority。

标准 LSP 提供 semantic tokens、symbols、diagnostics、navigation 与 workspace edits，但不定义通用 AST。设计因此将 LSP 语义和 host-side syntax parser 分离，再归一化成 Monaco/Pane 可消费的有界合同。Pane Workbench 继续是 tab、dirty、preview/pinned 和 view lifecycle 的唯一 owner。

## Goals / Non-Goals

**Goals:**

- 代码、Markdown 与结构化文本在现有 `desktop.file` Pane 内获得格式感知编辑、结构导航与诚实降级。
- 浏览器只持有 owner-issued opaque file ref、host-issued model URI 和有界文本/语义投影。
- 没有 Language Server 时 AST/source 仍可使用；没有新 bundle 时现有 renderer 仍可使用。
- 保存与跨文件 edit 都经过 File owner 的版本栅栏、预览和 receipt。
- Monaco、parser 和 LSP 依赖不进入核心 Pane/Workbench bundle。

**Non-Goals:**

- 不实现 DAP/debugger、terminal、extension marketplace、CRDT、远程 IDE 或浏览器自动安装 Language Server。
- 不接受任意 `workspace/executeCommand`，不在 V1 执行文件创建、删除或移动型 workspace edit。
- 不重命名 `desktop.file`，不迁移 Pane persistence，不创建第二个 document store。
- 不把官方 DSH Web 启动或上游 seam 合入作为插件完成门。

## Decisions

### 1. File opaque-ref V2 是语义能力硬前置

File Host 增加 `fs.treeV2/readV2/writeV2/binaryV2`。V2 由 session 解析 workspace，Host 维护 scoped ref registry，所有 read/write 和 language target 只接收 ref。旧方法保持不变；新语义 bundle 不探测到 `FileOpaqueRefCapabilityV1` 时 fail-closed。

备选：继续让 client 内部 Map 保存 raw path。拒绝：路径仍经过浏览器，definition/workspace edit 也无法安全解析未浏览文件。

### 2. LSP 只存在于 Host，浏览器消费 typed facade

新增 `@yeisme/dsh-language-intelligence-host`：Node 侧以固定 provider descriptor 启动 allowlisted executable，使用 `shell:false`、workspace cwd、最小环境与 JSON-RPC stdio。浏览器 facade 只暴露 probe/open/change/query/close 等 typed 方法，不透传 JSON-RPC、server URI、argv、environment 或 initialization options。

默认 provider：TypeScript、Go、Python、Rust、Shell。JSON/YAML/TOML/Markdown 保留 provider descriptor，但服务器缺席不阻塞 parser 基线。Host 不安装或下载 executable。

### 3. AST provider 独立于 LSP 并归一化

代码语言使用 `web-tree-sitter` 与按语言懒载 WASM；JSONC、YAML、TOML、Markdown 使用各自安全 parser。所有 provider 输出统一 `SyntaxTreeProjectionV1`：node kind、field、parent、UTF-16 range、error/missing 和 bounded label。Tree/response 有 node、深度、字符串与时间预算；超限返回 partial/source-only。

备选：使用 LSP DocumentSymbol 充当 AST。拒绝：符号树不覆盖完整语法、错误节点和 selection ancestor。

### 4. Monaco 是独立 renderer，不进入核心 bundle

新增 `@yeisme/dsh-client-ui-semantic-file-editor` 和可安装 `@yeisme/dsh-semantic-file-editor`。Desktop Workbench client 通过独立 UI package 注册 renderer；semantic host bundle 只提供 typed API 与同源资产。Monaco renderer/stylesheet/worker 通过同源、版本化资产 URL 在首次打开支持文件时加载。Tree-sitter 运行在 Host，不向浏览器分发 grammar。

`FileOpenPane` 保留既有 exported component，只增加可选 semantic renderer seam。重 renderer 加载、Host probe 或 Worker 失败时使用现有 Markdown/textarea/source fallback。

### 5. 文件版本和 document version 分离

File version 是 owner-issued string，用于保存冲突检测；document version 是打开 handle 内单调递增整数，用于 change、cancellation 和丢弃乱序语义结果。所有位置在 browser contract 上统一为 UTF-16；Host 负责 LSP negotiated encoding、parser byte offset 与 UTF-16 的转换。

### 6. Mutation 采用 preview/confirm/receipt

单文件保存继续调用 `FileHostV1.writeText`。format、rename、code action 返回 bounded `WorkspaceTextEditDraftV1`。新增 `FileWorkspaceEditHostV1` 校验全部 ref、base version、range 和 workspace boundary；多文件 edit 只有在用户明确确认后执行。command-only action、workspace 外 target、create/delete/rename resource operation 均拒绝。

### 7. Pane UI 是格式感知视口

- 代码：Editor、Outline、Problems、Structure；V1 使用 Monaco tokenizer，并保留 Host semantic token typed projection 作为后续 renderer contribution。
- Markdown：Rendered、Editor、Split、Structure，继续复用安全 `MarkdownText`。
- JSON/YAML/TOML：Editor、Structure，解析错误映射到 diagnostics。
- 状态栏显示 language、engine、Ln/Col、document version、dirty/read-only/conflict 和降级原因。
- Pane suspend 停止昂贵请求；close/unload 对称释放 model、handle、listener 和 worker 资源。

## Risks / Trade-offs

- [Monaco/Worker 受 ModuleLoader 和 CSP 限制] → 独立同源 ESM 资产、显式 worker factory、bundle contract test；失败回退 builtin renderer。
- [Language Server 读取范围过宽] → workspace-scoped cwd、固定 root marker、opaque ref、target 校验、禁止 client argv/URI authority。
- [LSP/AST response 乱序] → document version fence、AbortSignal、stale result drop。
- [多文件写入不能天然事务化] → 全量 preflight、临时内容 staging、回滚快照与逐文件 receipt；partial 永不显示为成功。
- [WASM/parser 体积] → Host-side 按语言懒载，核心 bundle 无 parser dependency。
- [现有脏工作树与并行 FileOpenPane 改动] → 新能力优先放独立 packages；现有文件只做 additive props/registration，不重排无关代码。

## Migration Plan

1. 新增 opaque-ref V2 和 capability probe；旧 File Host API 不变。
2. 新增 Language Host、parser provider 与 fake LSP integration fixtures。
3. 新增 semantic editor bundle，并以可选 renderer 接入 `desktop.file`。
4. 先在本地 Web profile canary；未安装 bundle 或缺 capability 时保留旧体验。
5. 回滚时移除 `@yeisme/dsh-semantic-file-editor`；无数据回填或 persistence migration。

## Open Questions

无。真实 Language Server 的安装与用户自定义 provider 配置不属于 V1；固定 allowlist + PATH probe 足以完成首个本地合同。
