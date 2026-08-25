## 1. MediaRef 合同

- [x] 1.1 [Owner: Harness Plugins；Scope: `packages/bundle/dsh-rich-media/src/host/types.ts`；Dependencies: none] 定义 `MediaRefV1`、`MediaKind`、`MediaCapability` 与 `validateMediaRefV1`/`isMediaRefV1`。Acceptance: 拒绝 raw path、unknown capability、控制字符与超长字段；Validation: `pnpm --filter @yeisme/dsh-rich-media run test`。
- [x] 1.2 [Owner: Harness Plugins；Scope: tests；Dependencies: 1.1] 增加合法 ref、raw path、unknown capability、控制字符与 type guard 测试。Acceptance: 全绿；Validation: `pnpm --filter @yeisme/dsh-rich-media run test`。

## 2. Package 骨架

- [x] 2.1 [Owner: Harness Plugins；Scope: `packages/bundle/dsh-rich-media/`；Dependencies: none] 初始化 `@yeisme/dsh-rich-media@0.1.0-rc.1`，配置 dsh bundle/client 元数据、exports、scripts、README 与 `cordis.patch.yml`。Acceptance: `pnpm --filter @yeisme/dsh-rich-media run build` 通过；Validation: package build。
- [x] 2.2 [Owner: Harness Plugins；Scope: `src/host/plugin.ts`；Dependencies: 2.1] 增加 Host 插件面，返回可清理 disposer；当前不注册生产传输。Acceptance: typecheck 通过；Validation: `pnpm --filter @yeisme/dsh-rich-media run typecheck`。
- [x] 2.3 [Owner: Harness Plugins；Scope: `src/client/`；Dependencies: 2.1] 增加 `RichMediaCard` 纯 React 组件与 no-op client apply。Acceptance: typecheck/build 通过；Validation: `pnpm --filter @yeisme/dsh-rich-media run typecheck && pnpm --filter @yeisme/dsh-rich-media run build`。
- [x] 2.4 [Owner: Harness Plugins；Scope: `src/client/locales.ts` 与 `src/client/workbench.tsx`；Dependencies: 2.3] 以 DSH-better-sidebar 为交互参考二创 Rich Media Workbench，接入官方 `sidebar.footer.action`。Acceptance: typecheck/build 通过，媒体库 Tab 可渲染；Validation: `pnpm --filter @yeisme/dsh-rich-media run typecheck && pnpm --filter @yeisme/dsh-rich-media run build`。
- [x] 2.5 [Owner: Harness Plugins；Scope: `src/client/index.ts`；Dependencies: 2.4] 注册 locale 与 sidebar footer action，保持 effect-scoped dispose。Acceptance: typecheck 通过；Validation: `pnpm --filter @yeisme/dsh-rich-media run typecheck`。

## 3. OpenSpec 与文档

- [x] 3.1 [Owner: Harness Plugins；Scope: `openspec/changes/dsh-rich-media-plugin-v1/`；Dependencies: 1.x, 2.x] 完成 proposal/design/tasks/spec 文档，记录社区调研、DSH-better-sidebar 二创与 split-owner 结论。Acceptance: `openspec validate dsh-rich-media-plugin-v1 --strict --no-interactive` 通过。
- [x] 3.2 [Owner: Harness Plugins；Scope: README；Dependencies: 2.x] 在 package README 中记录安装、检查、回滚、工作台与当前边界。Acceptance: README 使用真实命令。

## 4. 后续实现（retain-next）

- [x] 4.1 确认官方媒体附件 seam 是 `ctx.attachments` 扩展还是 `ctx.media` 新增；验收：有明确 owner 和 typed API。（progress 2026-08-22：选择扩展 `ctx.attachments` 为 `PreviewResourceV1`，fork PR https://github.com/yeisme/deepseek-harness/pull/7。不新增 `ctx.media`。）
- [ ] 4.2 接入聊天/ToolView/Pane 官方 slot，注册 `RichMediaCard` 与媒体节点；验收：使用最窄官方 seam，无 DOM patch。（progress 2026-08-22：PreviewResourceV1 fork PR #7 已登记；本任务仍等官方 Workbench/Pane/ToolView 宿主 slot，不在本 program 解锁范围内。（blocked 2026-08-24: official Workbench/Pane/ToolView host slot. PreviewResourceV1 fork PR is not an official DSH seam.）
- [ ] 4.3 实现文件卡片、PDF/Office/文本预览与图片增强；验收：沙箱、类型嗅探、有界文本。（blocked: PDF.js/Office 集成需要新增依赖，本 lane 不允许新增依赖）
- [x] 4.4 实现音视频播放器、waveform/字幕扩展点与媒体库；验收：懒加载、卸载释放、可访问性。Evidence (2026-08-24): shipped `RichMediaCard` + `MediaLifecycleController` + library register/dispose; `pnpm --filter @yeisme/dsh-rich-media run test` 57/57 covers waveform peaks, subtitle tracks, lazy enhancer boundary, and release. 4.2/4.3/4.5/4.6/6.1 stay blocked on official slots/deps/seams.
- [ ] 4.5 将工作台文件/终端/Git/浏览器 Tab 接入各自官方 owner seam；验收：每个 Tab 只投影 owner 状态，不复制 canonical state。（blocked: 需要各自官方 owner seam）
- [ ] 4.6 与 Eikona/Sonora/Anatomia 等领域 Pane 集成；验收：跨 Pane 只走 typed artifact intent。（blocked: 官方 ArtifactRef/领域 Pane seam 未就绪）

## 5. Phase 1 媒体预览落地（已开始）

- [x] 5.1 [Owner: Harness Plugins；Scope: `src/client/media-card.tsx`；Dependencies: 2.3] 增强 `RichMediaCard` 支持 `src` 与异步 `resolveUrl`，为 image/audio/video/PDF 渲染安全媒体元素。Acceptance: server render 可同步输出 `src` 媒体，浏览器可异步解析；Validation: `pnpm --filter @yeisme/dsh-rich-media run test`。
- [x] 5.2 [Owner: Harness Plugins；Scope: `src/client/media-card.tsx`；Dependencies: 5.1] 增加 PDF sandbox iframe、Open/Download 动作与失败/重试状态。Acceptance: 无 src 时显示元数据降级，有 src 时按 kind 渲染；Validation: `pnpm --filter @yeisme/dsh-rich-media run test`。
- [x] 5.3 [Owner: Harness Plugins；Scope: `src/client/workbench.tsx`；Dependencies: 5.1] 媒体库透传 `resolveUrl` 与本地化 labels，让工作台可显示真实媒体。Acceptance: typecheck/build 通过；Validation: `pnpm --filter @yeisme/dsh-rich-media run typecheck && pnpm --filter @yeisme/dsh-rich-media run build`。
- [x] 5.4 [Owner: Harness Plugins；Scope: tests；Dependencies: 5.2] 增加媒体卡片渲染测试（image、PDF iframe、无源降级）。Acceptance: 8 tests passed；Validation: `pnpm --filter @yeisme/dsh-rich-media run test`。
- [x] 5.5 [Owner: Harness Plugins；Scope: `src/client/media-node.tsx`；Dependencies: 5.1] 新增 `media/ref` 会话事件与 Chat 媒体节点，把 `media/ref` 折叠为 `media-ref` 聊天行。Acceptance: `mediaNodeDefinition.match` 按稳定 mediaId 命中；Validation: `pnpm --filter @yeisme/dsh-rich-media run test`。
- [x] 5.6 [Owner: Harness Plugins；Scope: `src/client/index.ts`；Dependencies: 5.5] 注册 `conversationEvents` 与 `conversation.chat.node` keyed renderer。Acceptance: typecheck/build 通过；Validation: `pnpm --filter @yeisme/dsh-rich-media run typecheck && pnpm --filter @yeisme/dsh-rich-media run build`。
- [x] 5.7 [Owner: Harness Plugins；Scope: `src/client/workbench.tsx`；Dependencies: workbench-core] 将 Rich Media Workbench 改为消费 `WorkbenchRegistry`/`WorkbenchShell`，注册 `dsh-rich-media` Workbench module。Acceptance: typecheck/build 通过；Validation: `pnpm --filter @yeisme/dsh-rich-media run typecheck && pnpm --filter @yeisme/dsh-rich-media run build`。
- [x] 5.8 [Owner: Harness Plugins；Scope: tests；Dependencies: 5.7] 增加 source-independence scan，确保不依赖参考 sidebar 项目。Acceptance: 12 tests passed；Validation: `pnpm --filter @yeisme/dsh-rich-media run test`。

## 6. 后续推进目标（retain-next）

- [ ] 6.1 [Owner: Harness Plugins；Scope: `src/host/plugin.ts`；Dependencies: 2.2] 接入真实媒体附件 seam（`ctx.attachments` 扩展或 `ctx.media` 新增）。Acceptance: Host 返回真实 MediaRef；Validation: 本地 DSH profile 验证。（blocked: 需要真实 DSH 媒体附件 host seam，本环境无法执行本地 DSH profile）
- [x] 6.2 [Owner: Harness Plugins；Scope: `src/client/media-card.tsx`；Dependencies: 5.2] 增加音视频播放器增强：waveform、字幕、倍速、画中画。Acceptance: audio/video 播放器可交互；Validation: 组件测试 + demo。
- [x] 6.3 [Owner: Harness Plugins；Scope: `src/client/media-node.tsx`；Dependencies: 5.6] 支持媒体节点更新/移除事件，而不仅是单次 start。Acceptance: `media/ref/update`、`media/ref/remove` 可折叠；Validation: media-node tests。
- [x] 6.4 [Owner: Harness Plugins；Scope: `src/client/workbench.tsx`；Dependencies: 5.7] 将 Rich Media Workbench 作为独立模块继续完善 gallery/compare/zoom。Acceptance: gallery/compare/zoom 可测；Validation: component tests。
