# @yeisme/dsh-language-intelligence-host

DSH 文件 Pane 的 Host-side Language Intelligence 合同。它把 Language Server 与语法解析器统一成有界、可版本栅栏的投影；浏览器不会收到文件系统路径、LSP URI、server argv、环境变量或原始 JSON-RPC payload。

## 能力

- 固定 allowlist 的 stdio Language Server：TypeScript、Go、Python、Rust、Shell、JSON、YAML、TOML、Markdown。
- Tree-sitter：TypeScript/TSX、JavaScript/JSX、Go、Python、Rust、Shell。
- 独立 parser：JSONC、YAML、Markdown；TOML 与未知文本使用 bounded structure fallback。
- `probe/open/change/query/didSave/close` typed facade。
- document version 与 file version 分离；position 统一为 UTF-16。
- definition/reference/workspace edit 目标必须重新映射成 File owner 的 opaque ref。

Language Server 不存在、启动失败或崩溃时，现有文档继续使用 AST/source；后续打开会重新探测 provider。Host 不下载或自动安装任何 executable。

## 验证

    pnpm --filter @yeisme/dsh-language-intelligence-host run typecheck
    pnpm --filter @yeisme/dsh-language-intelligence-host run test
    pnpm --filter @yeisme/dsh-language-intelligence-host run build

## 第三方依赖

运行时使用 Monaco/LSP 生态的 MIT 许可组件 `vscode-jsonrpc`、`vscode-languageserver-protocol`、`web-tree-sitter`、`@vscode/tree-sitter-wasm`、`jsonc-parser`、`mdast-util-from-markdown`，以及 ISC 许可的 `yaml`。发布前以锁文件和包内 license 为准执行依赖审计。
