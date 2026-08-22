# @yeisme/dsh-rich-media

DSH Web 富媒体展示插件的统一安装包。当前已提供安全 `MediaRefV1` 合同、Pane 内 `MediaPreviewPane`、Rich Media Card 与可安装 bundle row；媒体存储、模型多模态输入和领域媒体编辑仍归 DSH/领域 owner。

## 安装

```bash
# 本地 checkout
dsh plugin --profile web add ./packages/bundle/dsh-rich-media

# 或发布后
dsh plugin --profile web add @yeisme/dsh-rich-media
```

## 包边界

- `src/host/types.ts`：headless `MediaRefV1` 校验与类型，禁止 raw path、凭据、无界文本。
- `src/host/types.ts`：同时提供可选 `MediaHostV1` owner seam；通过 `dsh.mediaHost` context key 提供媒体列表与短时 URL 解析。
- `src/host/plugin.ts`：Host 面骨架，具体媒体存储/传输仍由领域 owner 挂载。
- `src/client/media-card.tsx`：纯 React 媒体卡片，支持 image/audio/video 的短时 URL 展示。
- `src/client/media-preview-pane.tsx`：Pane 内资源列表与当前媒体预览，支持筛选、图片/音频/视频/PDF、owner 授权的短时 URL、打开和下载。
- `src/client/workbench.tsx`：仅保留给 story/迁移测试的 legacy Rich Media Workbench，不再注册生产 sidebar action。
- `src/client/media-node.tsx`：`media/ref` 会话事件到 Chat `media-ref` 节点的折叠与渲染器。
- `src/client/index.ts`：浏览器入口，注册 conversationEvents 与 chat node renderer；生产 Pane provider 由 `dsh-desktop-workbench` 组合。

## 开发

```bash
pnpm install
pnpm --filter @yeisme/dsh-rich-media run typecheck
pnpm --filter @yeisme/dsh-rich-media run test
pnpm --filter @yeisme/dsh-rich-media run build
```

## 检查与回滚

```bash
dsh --profile web --dump-config
dsh plugin --profile web remove @yeisme/dsh-rich-media
```

骨架不写入持久化数据、不修改 DSH core、不创建浏览器 domain store。
