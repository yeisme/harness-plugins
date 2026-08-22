# @yeisme/dsh-client-ui-mermaid-render

DSH Web 会话内 mermaid 渲染 client 插件。已稳定的 ```mermaid``` fence 以
MutationObserver 稳定门触发，增量嫁接为净化后的内联 SVG figure；源码保留
可回看，卸载完全还原。详见仓库 `openspec/changes/dsh-mermaid-render-plugin-v1/`。
kill-switch：`localStorage.setItem('dshMermaid','off')`。
