## Context

Harness Plugins 已证明 unified dual-face package 模式（`@yeisme/dsh-ordo-agent-ops`）可以同时发布 Host 逻辑、浏览器 client 与 profile patch。富媒体展示需要同样的模式：一个可安装 bundle 提供安全媒体合同、Host 解析边界与客户端渲染器，而不是把媒体逻辑塞进领域 owner 或 DSH core。

DSH Web 现有 `@deepseek-ai/dsh-client-ui-attachment` 已覆盖图片 Gallery/Lightbox。本 change 不替代该能力，而是定义更通用的 `MediaRefV1`，让图片继续走既有展示，音视频/PDF/文件卡片走同一安全合同。

### 社区调研记录

- 检索日期：2026-08-18。
- 来源：公开社区仓库与 npm 包（`dsh-vision-complete`、`dsh-plugin-aigc-canvas`、`dsh-ds-attach`、`dsh-file-upload`、`dsh-files`、`dsh-file-tree-panel`、`dsh-workbench`、`Deepseek-omnimodal`）。
- 结论：没有现成的通用富媒体展示插件；最接近的文件/文档插件可作为交互与解析参考，但不作为源码/运行时依赖。

## Goals / Non-Goals

**Goals:**

- 提供 headless、owner-neutral、可校验的 `MediaRefV1` 合同。
- 提供统一 Host/Client 插件面与可安装 bundle。
- 提供纯 React 媒体卡片作为后续聊天/ToolView/Pane 渲染器的共同起点。
- 为音视频播放器、PDF/Office 预览、媒体库/侧栏和跨 Pane handoff 保留 additive seam。

**Non-Goals:**

- 首切片不实现官方 slot 注册、不实现音视频播放器、PDF 渲染、媒体库或领域 Pane。
- 不扩展 DSH core 的 attachment 服务；通用媒体存储与读取鉴权后续由 DSH/领域 owner 决定。
- 不实现模型多模态输入、媒体生成/编辑/转码。
- 不引入 `dsh-better-sidebar`、`dsh-ds-attach` 等社区插件的源码依赖。

## Decisions

### 1. 采用 unified dual-face bundle，而不是拆成多个 package

`@yeisme/dsh-rich-media` 一个 package 同时发布 Host 与 Client face，安装命令为 `dsh plugin --profile web add @yeisme/dsh-rich-media`。与 `@yeisme/dsh-ordo-agent-ops` 一致，减少发布矩阵和 profile 安装复杂度；若后续 UI 复杂到需要独立 package，再走 additive split。

### 2. MediaRefV1 是安全投影，不是文件句柄

`MediaRefV1` 只包含 owner、kind、opaque ref、version、mediaType、有界元数据与 capabilities。浏览器不得收到 raw path、bearer URL、token、cookie、provider payload 或无界正文。Host 后续通过短时授权 URL 或 typed reader 提供媒体字节。

### 3. 客户端卡片先纯 React，后接官方 seam

首切片只交付 `RichMediaCard` 纯组件和 no-op client apply。后续按 `dsh-plugin-experience` 的规则选择最窄官方 seam：聊天消息用 `conversation.chat.node`，工具结果用 `tool.view`，持久面板用 Pane slot。在 seam 确认前不注册 UI，避免用 DOM patch 或非官方 slot 兜底。

### 4. Host 面先保持可清理 no-op

首切片不实现媒体传输，避免在合同未冻结前绑定存储或网络实现。Host apply 返回精确 disposer，为后续注册 service、listener、stream 和命令保留对称生命周期。

### 5. 社区组件只做参考，不进入依赖

文件嗅探/文档提取可参考 MarkItDown 或社区插件思路，但本 change 不依赖它们。后续 Phase 1 若引入 PDF.js 或文本提取库，必须单独评审许可、包体积和浏览器沙箱。

### 6. 与 Pane 生态对齐

后续媒体 Pane 使用 `dsh-pane-plugin-ecosystem-v1` 的 `ArtifactRefV1`/`ArtifactIntentV1` 做跨 Pane handoff。`MediaRefV1` 保持为媒体展示层合同，不替代 ArtifactRef；两者通过 owner/ref/version 互相映射。

### 7. 以 DSH-better-sidebar 为交互参考二创 Rich Media Workbench

`DSH-better-sidebar` 的“侧边工作台”交互已被社区验证为高频入口：文件、终端、Git、浏览器与第三方 Tab 可以显著提升 DSH 的可组合性。本插件不复制其源码或私有 `ctx.betterSidebar` API，而是在官方 `sidebar.footer.action` slot 上二创一个 Rich Media Workbench：

- 默认展示媒体库 Tab，消费 `MediaRefV1` 投影；
- 预留文件、终端、Git、浏览器 Tab，作为后续官方 seam 的接入位；
- 每个 Tab 使用同一工作台壳：header、tablist、keyboard 可访问切换、aria-selected/aria-label；
- 媒体卡片在宽/窄侧栏下均可用，窄栏只显示触发器，宽栏展开面板。

交互设计原则：

| 原则 | 行为 |
| --- | --- |
| 渐进披露 | 默认只显示媒体库；其余 Tab 点击后显示“预留接入位”，不伪造可用功能 |
| 可访问性 | tablist/tab/tabpanel、键盘方向键切换、焦点留在激活 Tab |
| 安全边界 | 不读取 DSH-better-sidebar DOM，不修改 grid，不注入任意 iframe |
| 生命周期 | 面板开关只影响本地 UI 状态；关闭时暂停/释放媒体资源 |
| 官方 seam | 只使用已发布的 sidebar slot；未确认的聊天/ToolView/Pane slot 不抢跑 |

## Test Specification

| 层 | 场景 | 命令 | 证据 |
| --- | --- | --- | --- |
| unit | MediaRef valid/invalid、raw path 拒绝、unknown capability 拒绝、控制字符拒绝 | `pnpm --filter @yeisme/dsh-rich-media run test` | Vitest result |
| unit | RichMediaCard 渲染 image、PDF iframe、无源降级、Open/Download | `pnpm --filter @yeisme/dsh-rich-media run test` | Vitest result |
| unit | mediaNodeDefinition match/start 将 `media/ref` 折叠为 chat node | `pnpm --filter @yeisme/dsh-rich-media run test` | Vitest result |
| typecheck | Host/Client 插件面可编译 | `pnpm --filter @yeisme/dsh-rich-media run typecheck` | exit 0 |
| build | node ESM 与 browser CJS 可构建 | `pnpm --filter @yeisme/dsh-rich-media run build` | build output |
| sidebar slot | Rich Media Workbench 通过 `sidebar.footer.action` 注册并可编译 | `pnpm --filter @yeisme/dsh-rich-media run typecheck` | exit 0 |

后续官方 slot、播放器、PDF 预览和领域集成再补充 integration/browser evidence。

## Risks / Trade-offs

- [MediaRef 过早冻结] → 标记 experimental；所有字段保持 bounded，后续 additive optional 演进。
- [社区插件可复用性被高估] → 首切片不依赖任何社区插件；只有独立评审后的解析库才进入 dependencies。
- [官方 slot 未确认] → 当前 client apply 是 no-op，不抢跑非官方 UI seam。
- [媒体存储 owner 未定] → 首切片只定义展示合同，不假设存储实现。
- [并行 dirty worktree] → 新文件限制在 `packages/bundle/dsh-rich-media/` 与 `openspec/changes/dsh-rich-media-plugin-v1/`。

## Migration Plan

1. 先发布 `@yeisme/dsh-rich-media@0.1.0-rc.1` 骨架，验证 package 构建与安装。
2. 确认官方 slot/媒体存储 seam 后，在同 change 后续任务或独立 change 中实现 Phase 1 文件/PDF/图片增强。
3. Phase 2 音视频播放器、Phase 3 领域 Pane 集成分别按 owner readiness gate 推进。
4. 失败时只移除新 bundle/feature，不涉及数据迁移。

Rollback：删除 profile 中 `dsh-rich-media` 行或移除 package。因为无持久化、无 profile patch 覆盖、无领域 mutation，回滚不需要 reverse migration。

## Open Questions

- 官方媒体附件 seam 是扩展 `ctx.attachments` 还是新增 `ctx.media`？
- 首版聊天内展示与媒体 Pane 的优先级？
- 是否支持远端媒体 URL，还是仅本地/领域托管？
- PDF/Office 预览采用 PDF.js、iframe sandbox 还是纯文本提取？
