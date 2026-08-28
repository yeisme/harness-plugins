## 1. Mermaid hydrate

- [x] 1.1 [Owner: Harness Plugins；Scope: `packages/client/ui-mermaid-render/src/client/observer.ts`] 导出 `hydrateMermaidFences(root, options)` 与 `stableMs=0` 一次扫描；`MermaidGraftController` 继续服务会话观察器。Acceptance: 任意根节点可嫁接；Validation: mermaid-render unit tests。
- [x] 1.2 [Owner: Harness Plugins；Scope: README + locales] 文档与代码 kill-switch 对齐为 `localStorage['dsh-mermaid']==='off'`。Acceptance: README 不再写 `dshMermaid`。
- [x] 1.3 [Owner: Harness Plugins；Scope: observer styles] figure 样式改 visual-kit token fallback。Acceptance: 无第二套手写灰边色板。

## 2. 文件 Markdown mermaid

- [x] 2.1 [Owner: Harness Plugins；Scope: `packages/client/ui-desktop-workbench/src/client/file-markdown.ts`] mermaid fence 输出 `pre > code.language-mermaid`，其它语言仍转义无 class。Acceptance: `file-markdown.spec.ts`。
- [x] 2.2 [Owner: Harness Plugins；Scope: `file-open-pane.tsx`] Markdown 预览输出 `language-mermaid` 锚点；会话 mermaid 观察器覆盖 overlay，不把 mermaid 运行时打进 desktop-workbench。Acceptance: FileOpenPane 测试覆盖 mermaid fence class。

## 3. 侧栏媒体 overlay

- [x] 3.1 [Owner: Harness Plugins；Scope: `packages/bundle/dsh-desktop-workbench/src/client/apply.ts`] 始终注册 `desktop.media`；无 host 渲染空态；`sidebar.footer.action`「媒体」order 42。Acceptance: apply.spec 无 host 也含 `desktop.media`。
- [x] 3.2 [Owner: Harness Plugins；Scope: apply.ts Explorer 分流] image/audio/video/pdf 打开 `desktop.media`，文本/Markdown 仍 `desktop.file`。Acceptance: apply.spec。
- [x] 3.3 [Owner: Harness Plugins；Scope: FileOpenPane] 授权 URL 下 native audio/video 与 sandbox PDF iframe；无 URL 诚实不支持。Acceptance: file-open-pane.spec。

## 4. 聊天卡片打开窗格

- [x] 4.1 [Owner: Harness Plugins；Scope: `packages/bundle/dsh-rich-media`] `RichMediaCard` 可选 `onOpenInPane`；缺 pane 不渲染该动作。Acceptance: media-card tests。

## 5. 验证

- [x] 5.1 运行 mermaid-render、rich-media、desktop-workbench client/bundle 的 focused test/typecheck。
- [x] 5.2 `openspec validate dsh-web-render-preview-v1 --strict --no-interactive`。
