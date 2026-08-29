## Why

当前 `desktop.file` Pane 对 Markdown 走单独渲染，对其它文本主要使用 `pre` 或 `textarea`，无法提供统一的格式感知预览、结构导航和语言语义能力。仓库同时要求浏览器只消费 opaque ref，因此 LSP/AST 不能复用现有携带路径的 explorer transport，必须先建立 host-side 安全文件引用与归一化语言智能合同。

## What Changes

- 新增 host-side opaque file ref V2 transport；语义编辑器只在该 capability 可用时启用，旧接口保持兼容。
- 新增 `LanguageIntelligenceHostV1`，在 Host 侧组合 AST provider 与 allowlisted LSP process，并向浏览器只返回有界、UTF-16 归一化的语义投影。
- 新增格式感知文件编辑器：代码、Markdown、JSON、YAML、TOML 按类型提供源码、渲染、结构树和诊断视图；缺 LSP 时诚实降级为 AST/source。
- 新增安全 workspace text edit 预览与版本栅栏；单文件继续使用 `FileHostV1.writeText`，多文件 mutation 不由浏览器直接执行。
- Monaco 与 Worker 作为独立可降级 renderer 资产加载，不进入核心 Pane bundle，也不创建第二套 Pane state owner。

所有合同变更均为 additive；不移除、重命名或重新解释现有导出、Pane kind 或 HTTP 方法。

## Capabilities

### New Capabilities

- `dsh-file-opaque-ref-v2`: session/workspace scoped opaque file ref、版本读写与安全目标解析。
- `dsh-language-intelligence-host`: AST/LSP lifecycle、归一化语义查询、版本同步、取消与降级。
- `dsh-semantic-file-editor-pane`: `desktop.file` 内的格式感知编辑、结构导航、诊断、保存与安全 mutation 体验。

### Modified Capabilities

无。既有文件、Markdown、Pane 与 preview capability 保持兼容；新行为通过可选 capability probe 增量接入。

## Impact

- Owner：`agent/harness-plugins`。
- 主要代码：File Host、Desktop Workbench 文件 Pane，以及新的 language-intelligence host、semantic editor client/installable bundle。
- 新依赖限定在独立 package：Monaco、LSP JSON-RPC/types、Tree-sitter/格式解析器；核心 Workbench bundle 不静态引入重依赖。
- 新 HTTP/API 与 TypeScript surface 均为 pre-1.0 additive 合同；旧客户端和未安装语义 bundle 的 profile 继续使用现有 Markdown/纯文本路径。
- 回滚：移除 `@yeisme/dsh-semantic-file-editor` bundle，Desktop Workbench 自动回退 builtin renderer；无数据迁移。
