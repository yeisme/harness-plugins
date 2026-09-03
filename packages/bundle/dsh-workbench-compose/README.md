# @yeisme/dsh-workbench-compose

组合 DSH Pane provider：把 File/Document 等上下文视图注册进右侧 / 底部共享工作区，并提供会话标题栏中的打开入口。

## 安装

```bash
dsh plugin --profile web add ./packages/bundle/dsh-workbench-compose
# 或发布后
dsh plugin --profile web add @yeisme/dsh-workbench-compose
```

## 包边界

- `src/composed-registry.ts`：同时注册 `dsh-rich-media`、`dsh-file-document` 与 `dsh-terminal` 模块。
- `src/client/composed-workbench.tsx`：仅供 demo / story 保留的旧组合面板，不在生产路径挂载。
- `src/client/index.ts`：保留隐藏 `file.tree` 兼容 shim；所有打开入口收口到 `dsh.explorer`。
- `src/host-projection.ts`：`WorkbenchHostProjection` 与 `createStaticHostProjection`，用于注入媒体/文件数据。
- `src/host-slot.ts`：官方宿主 slot 就绪后的注册 gate。
- canonical 文件树由 Pane Workbench 的 Explorer runtime 与 File Host V2 按需加载。

## 开发

```bash
pnpm --filter @yeisme/dsh-workbench-compose run typecheck
pnpm --filter @yeisme/dsh-workbench-compose run test
pnpm --filter @yeisme/dsh-workbench-compose run build
```

## 运行 Demo

```bash
pnpm --filter @yeisme/dsh-workbench-compose run demo
```

Demo 使用 `createStaticHostProjection` 提供示例媒体与文件条目，并通过 Vite 启动一个可交互页面。

本包不复制参考 sidebar 项目源码，不读取其私有 API。

## 按需文件树

`ComposedWorkbench` 支持传入 `fileTreeAdapter`。当用户打开面板并进入文件 Tab 时，
`useFileTree` 会调用 Host 目录投影并渲染目录树；目录展开时通过 `loadChildren` 加载子目录。
`dsh-workbench-compose` 要求 Pane Workbench V2。它保留 `file.tree` 持久化 alias，
“File Tree”入口点击后打开右侧 `dsh.explorer`。旧 DSH 或缺少 Pane
服务时会明确报兼容错误，不回退到 `sidebar.footer.action`。
