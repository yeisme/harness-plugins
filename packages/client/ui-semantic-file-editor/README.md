# @yeisme/dsh-client-ui-semantic-file-editor

面向现有 `desktop.file` Pane 的格式感知编辑器。它不创建第二个 Pane/document store：Pane Workbench 继续拥有 tab、preview/pinned 与 lifecycle，File owner 继续拥有读写、版本和 workspace mutation。

## 界面

- 编辑：同源懒加载 Monaco；加载或 CSP 失败时保留 textarea。
- 预览：Markdown 复用 DSH `MarkdownText`，结构化文本使用安全 source projection。
- 分栏：编辑与渲染并排。
- 结构：AST Outline、Problems、engine/language、Ln/Col、document version。
- mutation：普通保存走 `FileHostV1.writeText`；format、rename、quick fix 先显示 bounded diff，再明确确认并读取 receipt。

浏览器请求只发送 `sessionId`、opaque `ref`、document handle、版本与 typed query；不发送 cwd、path 或 file URI。

## 验证

    pnpm --filter @yeisme/dsh-client-ui-semantic-file-editor run typecheck
    pnpm --filter @yeisme/dsh-client-ui-semantic-file-editor run test
    pnpm --filter @yeisme/dsh-client-ui-semantic-file-editor run build
