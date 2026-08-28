# dsh-structured-content-rendering-v1 设计

## Decisions

### 1. 两级阅读而不是两处完整工作台

聊天 inline 只提供快速阅读、紧凑工具和能力门控的 Pane 入口；Pane 提供完整画布或数据表。两者复用 React 内容壳，但 renderer 保留各自语义。

### 2. 内容壳是新 experimental 包

`ui-visual-kit` 保持纯 token/CSS 工具，不新增 React peer。新包导出 `StructuredContentFrame`、状态与有界 focus 类型并依赖 visual-kit。旧消费方无需迁移。

### 3. Mermaid 延续 graft，不等待上游 seam

现有 DOM observer 与源码稳定门继续负责发现 fence；成功结果挂载共享壳和画布，失败保留源码。Pane action 只有调用方提供稳定 ref/callback 时才渲染。

### 4. Markdown 复用 DSH 原语

文件预览用 `MarkdownText` 获得 GFM、KaTeX、安全链接、raw HTML 禁用和宿主 token。会话表格只装饰现有 semantic table，不 shadow assistant cell、不复制 Markdown parser。

### 5. 数据表由 owner 查询，客户端只做有界展示

`PreviewTablePageV1` additive 增加列 schema/row key；新的可选 query surface 承担 owner-side 全局排序、筛选和搜索。缺 capability 时相关控件 disabled 并显示作用范围。公式文本永不执行。

## Interaction States

| Surface | Loading | Ready | Partial/Stale | Error/Offline |
| --- | --- | --- | --- | --- |
| Mermaid | 源码继续可读 | 可缩放画布 | 主题重绘保留旧图 | 显示源码和错误 |
| Markdown table | 宿主 table 保持原样 | 增加滚动/工具 | 长表有界显示 | decorator 失败则宿主 table 不变 |
| CSV/TSV | skeleton/status | 虚拟化 rows | 保留已加载 rows 和 loaded/total | 保留已有 rows，显示 typed 状态 |

## Responsive And Accessibility

- `>=720px` 显示完整工具；`360–719px` 工具可换行，二维内容保持平移或横向滚动。
- coarse pointer 控件至少 44px；键盘可操作缩放、平移、表格滚动与复制。
- table 保留 `table/thead/tbody/th/td`；状态有文字，不只靠颜色。
- reduced motion 禁止非必要过渡；关闭 renderer 后释放 observer、root、handle 和样式引用。

## Non-Goals

- 不实现 spreadsheet 编辑、公式、透视表或客户端全量聚合。
- 不在 partial rows 上伪装全局排序/筛选。
- 不创建聊天内容 session-local 快照 owner。
- 不修改 DSH core 或现有 package/bundle 名称。
