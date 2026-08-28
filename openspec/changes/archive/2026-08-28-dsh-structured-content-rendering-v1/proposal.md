# dsh-structured-content-rendering-v1

## Why

DSH Web 的 Mermaid 已能安全出图，但当前仍是固定缩放的圆角卡片；窄侧栏中图会缩到不可读，错误状态还可能被隐藏。会话 Markdown 已由 DSH `MarkdownText` 支持 GFM 表格，文件预览却继续使用自写字符串 parser，导致表格能力和安全策略分裂。Resource Preview 已有 table page 合同，但尚无正式 CSV/TSV renderer。

准入结论为 `fit + split-owner`：Harness Plugins 拥有共享内容壳、Mermaid/表格展示和交互；DSH/domain owner 继续拥有消息、文件、数据、稳定 ref、授权和全局查询。

## What Changes

- 新增 `@yeisme/dsh-client-ui-structured-content` experimental React 内容壳，统一 inline/pane 层级、工具区、状态区、焦点状态与 visual-kit 样式。
- Mermaid 保留 observer、strict、安全净化、缓存、旧导出与 bundle，新增可访问缩放/平移、源码切换和诚实错误回源。
- 文件 Markdown 预览改用 DSH `MarkdownText`；旧 `renderMarkdown()` 继续导出作为兼容 shim。
- 会话/文件 Markdown 表格使用语义 table、滚动容器与紧凑阅读工具；不重新解释任意 HTML。
- CSV/TSV 使用 owner schema/page 与 TanStack Table/Virtual；partial 数据没有 owner query capability 时禁用伪全局排序/筛选。
- 聊天 Pane 跳转仅在存在稳定 owner ref 时出现，不建立浏览器内容快照桥。

## Compatibility

全部 surface 为 additive：新增 package、可选 props、可选 table schema/query；不删除或重命名 `hydrateMermaidFences()`、`GraftOptions`、`PreviewTablePageV1`、`readTablePage()`、现有 bundle 或 kill-switch。回滚为移除新包依赖并恢复旧 renderer，不涉及数据迁移。
