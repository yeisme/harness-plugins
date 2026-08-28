## 1. Shared content shell

- [x] 1.1 新增 `@yeisme/dsh-client-ui-structured-content`，交付 inline/pane、状态、工具、可选 Pane action、focus 类型和 scoped 样式。Validation: package test/typecheck/build。

## 2. Mermaid

- [x] 2.1 保留 observer/render/sanitize 合同，接入共享 React 壳与可访问画布。Validation: mermaid unit/integration tests。
- [x] 2.2 覆盖缩放、平移、重置、源码、复制、错误回源、dispose 与 capability-gated Pane action。Validation: component/graft tests。

## 3. Markdown tables

- [x] 3.1 FileOpenPane 使用 DSH `MarkdownText`；保留旧 `renderMarkdown()` 导出。Validation: file-open-pane/file-markdown tests。
- [x] 3.2 装饰已 settle semantic table，提供有界滚动、sticky header、窄屏首列与 TSV copy；卸载完整还原。Validation: structured table tests。

## 4. CSV/TSV renderer

- [x] 4.1 Additive 扩展 table schema/query 合同并保留旧 page API。Validation: preview contract tests。
- [x] 4.2 实现 owner-paged virtual table，覆盖 partial/stale、列工具、复制和禁用伪全局操作。Validation: renderer component tests。

## 5. Verification

- [x] 5.1 focused test/typecheck/build 全绿。
- [x] 5.2 `openspec validate dsh-structured-content-rendering-v1 --strict --no-interactive` 与 scoped `git diff --check` 全绿。
