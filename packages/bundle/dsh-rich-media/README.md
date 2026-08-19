# @yeisme/dsh-rich-media

DSH Web 富媒体展示插件的统一安装包。当前已提供安全 `MediaRefV1` 合同、
Rich Media Workbench 与可安装 bundle row；媒体存储、模型多模态输入和领域
媒体编辑仍归 DSH/领域 owner。

## 安装

```bash
# 本地 checkout
dsh plugin --profile web add ./packages/bundle/dsh-rich-media

# 或发布后
dsh plugin --profile web add @yeisme/dsh-rich-media
```

## 包边界

- `src/host/types.ts`：headless `MediaRefV1` 校验与类型，禁止 raw path、凭据、无界文本。
- `src/host/plugin.ts`：Host 面骨架，当前为可清理的 no-op，后续挂载媒体解析/传输。
- `src/client/media-card.tsx`：纯 React 媒体卡片，支持 image/audio/video 的短时 URL 展示。
- `src/client/workbench.tsx`：DSH-better-sidebar 风格二创的 Rich Media Workbench，已接入官方 `sidebar.footer.action`；当前提供媒体库 Tab，文件/终端/Git/浏览器为预留接入位。
- `src/client/media-node.tsx`：`media/ref` 会话事件到 Chat `media-ref` 节点的折叠与渲染器。
- `src/client/index.ts`：浏览器入口，注册 locale、sidebar footer action、conversationEvents 与 chat node renderer，effect-scoped dispose。

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
