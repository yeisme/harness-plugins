# Lenis 面板局部平滑滚动

## 决策

Workbench Web 固定使用 `lenis@1.3.25`，但只增强 `PanelFrame` 的内容滚动区，不接管 `window`、`document` 或 `body`。根页面继续保持 `body { overflow: hidden; }`，Workbench 外壳、Dockview 布局和弹层维持各自原生交互边界。

安装命令：

```bash
cd client/yeisme-workbench/apps/web
bun add lenis@1.3.25
```

官方样式在 Web 入口加载：

```ts
import "lenis/dist/lenis.css";
```

面板统一通过局部组件使用：

```tsx
<PanelSmoothScroll>{children}</PanelSmoothScroll>
```

## 架构范围

`PanelSmoothScroll` 拥有两个直接相邻的 DOM 层级：外层是原生 `overflow-auto` 滚动容器，内层是 Lenis 的 `content`。Lenis 的 `wrapper` 和 `eventsTarget` 都指向这个外层元素，因此滚轮与触摸事件不会提升到全局页面。

组件只在 `PanelFrame` 标题栏下方挂载。以下区域不在 Lenis 容器内：

- Dockview 标签、拖拽和 resize sash；
- Radix Dialog 与 cmdk 通过 portal 渲染的弹层滚动区；
- 移动端横向 `.mobile-tabs`；
- Workbench 外壳和页面根节点。

## Lenis 选项与生命周期

当前选项保持最小：

```ts
new Lenis({
  wrapper,
  content,
  eventsTarget: wrapper,
  autoRaf: true,
});
```

- 只使用 `autoRaf: true`，没有额外手写 `requestAnimationFrame` 循环。
- React effect 清理时调用 `destroy()`；StrictMode 的试挂载也会先销毁旧实例，不遗留监听器或 RAF。
- 不启用 `allowNestedScroll`。官方说明该选项需要在每次滚动事件中检查 DOM 树，可能带来性能成本。
- 如未来在某个面板内容中增加独立滚动区，应先把该区域移出 `PanelSmoothScroll`，或针对明确节点使用 Lenis 的 `prevent` 策略；不要把 `allowNestedScroll` 设为全局默认值。

## 减少动态效果

Lenis 没有专门的 reduced-motion 初始化选项。组件读取：

```text
(prefers-reduced-motion: reduce)
```

当查询结果为 `true` 时不创建 Lenis，外层 `overflow-auto` 继续提供浏览器原生滚动。系统偏好在运行期间变化时，组件会销毁或重新创建局部实例；现有 CSS media query 继续关闭动画与过渡。

## 验证

在项目内运行：

```bash
cd client/yeisme-workbench/apps/web
bunx vitest run test/smooth-scroll.test.tsx --reporter=verbose
bun run typecheck
bun run build
```

聚焦测试覆盖：

- StrictMode 下试挂载实例被销毁，实际实例在卸载时也被销毁；
- `wrapper`、`content`、`eventsTarget` 都局限于面板内容区；
- 只启用 `autoRaf`，没有启用 `allowNestedScroll`；
- reduced-motion 下不创建 Lenis，并保留原生 `overflow-auto`。

浏览器人工检查应覆盖 Dockview 拖拽/resize、命令面板滚动、移动端横向标签，以及系统“减少动态效果”开关。

## 回滚与移除

先移除依赖：

```bash
cd client/yeisme-workbench/apps/web
bun remove lenis
```

然后删除 `src/workbench/panel-smooth-scroll.tsx` 和对应聚焦测试，把 `PanelFrame` 内容恢复为原生 `overflow-auto` 容器，并从 `src/main.tsx` 删除 `lenis/dist/lenis.css` 导入。最后重新运行上面的 typecheck 与 build 命令。
