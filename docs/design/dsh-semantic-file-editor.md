# DSH 语义文件 Pane

## 结果

`desktop.file` 从“Markdown 特判 + 普通文本 textarea”升级为格式感知视口，同时保留现有 fallback。能力链如下：

    session workspace
      -> FileOpaqueRefCapabilityV1
      -> LanguageIntelligenceHostV1 (LSP + AST)
      -> bounded semantic API
      -> Monaco / Rendered / Split / Structure
      -> FileHost write 或 workspace edit preview/apply/receipt

Browser contract 只包含 opaque ref、Host model URI、bounded source/diagnostic/symbol/token/tree/edit。Host 内部路径和 LSP URI 不进入 Client state、fixture、日志或 evidence。

## 格式矩阵

| 格式 | 编辑 | 渲染 | 结构 | 可选 Language Server |
| --- | --- | --- | --- | --- |
| TS/JS/Go/Python/Rust/Shell | Monaco/textarea | source | Tree-sitter | 是 |
| Markdown/MDX | Monaco/textarea | MarkdownText | mdast | Marksman |
| JSON/JSONC | Monaco/textarea | formatted source | jsonc-parser | JSON LS |
| YAML | Monaco/textarea | source | YAML parser | YAML LS |
| TOML | Monaco/textarea | source | bounded structure | Taplo |

## Ownership

- `dsh-file-host`：opaque ref、读写版本、多文件 preflight/apply/rollback receipt。
- `dsh-language-intelligence-host`：LSP process、AST/parser、document version、target mapping。
- `ui-semantic-file-editor`：视图与显式确认，不持久化 canonical state。
- `dsh-semantic-file-editor`：Host API 与 Monaco same-origin assets。
- `dsh-desktop-workbench`：现有 `desktop.file` 注册、Pane lifecycle 和 fallback。

## 验收命令

    pnpm --filter @yeisme/dsh-file-host run test
    pnpm --filter @yeisme/dsh-language-intelligence-host run test
    pnpm --filter @yeisme/dsh-client-ui-semantic-file-editor run test
    pnpm --filter @yeisme/dsh-semantic-file-editor run test:integration
    openspec validate dsh-semantic-file-editor-pane-v1 --strict --no-interactive
