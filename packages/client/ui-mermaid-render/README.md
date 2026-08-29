# @yeisme/dsh-client-ui-mermaid-render

DSH Web 会话内 mermaid 渲染 client 插件。已稳定的 ```mermaid``` fence 以
MutationObserver 稳定门触发，增量嫁接为净化后的内联 SVG figure；源码保留
可回看，卸载完全还原。`hydrateMermaidFences(root)` 可对任意已 settle 的根
做一次扫描（文件 Markdown 预览复用 DSH `MarkdownText`/`CodeBlock` 锚点）。
详见仓库 `openspec/changes/dsh-web-render-preview-v1/`。
kill-switch：`localStorage.setItem('dsh-mermaid','off')`。

当前 client face 同时启动可逆的 semantic Markdown table enhancer：宽表保持
原生 table 语义、横向滚动、sticky header、窄屏首列和 TSV copy。Mermaid
kill-switch 只关闭 Mermaid，不关闭表格增强。共享 chrome 由
`@yeisme/dsh-client-ui-structured-content` 提供。
