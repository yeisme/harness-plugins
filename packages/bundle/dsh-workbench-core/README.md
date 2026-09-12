# @yeisme/dsh-workbench-core

DSH Workbench Core：以 DSH-better-sidebar 工作台心智模型为基础，重新实现的
通用 Tab/Module 壳。它只提供注册、排序、布局与命令聚合，不持有领域状态。

## 安装

```bash
dsh plugin --profile web add ./packages/bundle/dsh-workbench-core
# 或发布后
dsh plugin --profile web add @yeisme/dsh-workbench-core
```

## 包边界

- `src/types.ts`：`WorkbenchModuleDefinitionV1`、`WorkbenchTabV1`、`WorkbenchCommandV1` 与校验。
- `src/registry.ts`：纯 headless module/tab registry，支持 capability gate，注册返回 disposer。
- `src/client/shell.tsx`：可访问的 React Workbench Shell（tablist + panel + status、关闭按钮、拖拽/键盘排序）。
- `src/client/command-palette.tsx`：命令面板（模块分组、最近使用、快捷键提示、键盘导航）。
- `src/context.ts`：项目级工作上下文与 Agent 角色控制器；只保存展示连续性，不持有 Ordo/领域状态。
- `src/client/agent-workbench.tsx`：项目导航 + 主工作区 + Agent 面板 + 下一步行动条的可组合壳。
- `src/client/index.ts`：浏览器入口骨架。

## Agent-first 工作台

```tsx
const controller = new WorkbenchContextController({ projectRef: 'project:demo', storage })
<AgentWorkbench
  controller={controller}
  renderWorkspace={context => renderDomainPane(context)}
  renderAgentPanel={(context, role) => renderReadOnlyAgentProjection(context, role)}
/>
```

上下文（剧作、分镜、制作、审阅、3D、资产、交付）与 Agent 角色分开切换。
工作台默认只展示建议、草案和预览；实际写入、采用、运行和发布仍由领域 owner/Ordo
合同确认。storage 只保存项目级恢复索引，不应写入正文、凭据、provider payload 或运行真相。

## 开发

```bash
pnpm install
pnpm --filter @yeisme/dsh-workbench-core run typecheck
pnpm --filter @yeisme/dsh-workbench-core run test
pnpm --filter @yeisme/dsh-workbench-core run build
```

## 模块生成器

```bash
pnpm --filter @yeisme/dsh-workbench-core generate:module my-module
pnpm --filter @yeisme/dsh-workbench-core generate:module my-module --with-panel
pnpm --filter @yeisme/dsh-workbench-core generate:module my-module --with-openapi
pnpm --filter @yeisme/dsh-workbench-core generate:module my-module --with-panel --with-openapi
```

生成器默认写入 `packages/bundle/dsh-<name>/`；可用 `--out-dir <dir>` 指定输出目录。

## 检查与回滚

```bash
dsh --profile web --dump-config
dsh plugin --profile web remove @yeisme/dsh-workbench-core
```

本包不复制 DSH-better-sidebar 源码，不读取其私有 API。
