# dsh-mermaid-render-plugin-v1 设计

## 0. 结论速览

- **挂载点（双形态）**：流式 fence = 裸 `pre > code.language-mermaid`；settled fence = `div.md-code-block` 卡片（头部 lang 标签 + 无 class 的 `pre > code`）。`findMermaidFenceCodes` 统一识别，真实 `CodeBlock` 渲染的锚点回归测试钉死。
- **机制**：作用域 MutationObserver + 稳定门（内容 STABLE_MS 不变且在文档内才嫁接）→ 在 `pre` 后插入兄弟 `<figure>`，隐藏 `pre`（可切换回看）。
- **渲染**：mermaid.js（npm 本地依赖，tsdown 打进 client.js 的懒工厂，首图才求值），`securityLevel:'strict'` + 自研 SVG 白名单净化。
- **不改**：不 shadowing 任何 slot，不复刻 AssistantMarkdown，不动宿主 DOM 管线；卸载后 DOM 完全还原。
- **Track 2**：上游 `conversation.chat.markdown-fence` seam（附录 A），合并后嫁接层换 slot 注册。

## 1. 背景与约束（探查证据）

| 事实 | 来源 |
| --- | --- |
| assistant markdown 走 `MarkdownText`（直渲 mdast，DOM 被 fixtures 钉死，渲染器封闭） | dsh-client-ui-primitives `lib/types/markdown/{render,MarkdownText}.d.ts` |
| fence → `CodeBlock`，streaming 时 fence 纯文本、高亮在 finalize swap 落地 | 同上 + `MarkdownText.d.ts` 文档注释 |
| fence 两种 DOM：流式 `pre > code.language-mermaid`；settled `div.md-code-block` 卡片 + lang 标签（code 无 class） | primitives bundle 流式路径 + 真实 CodeBlock jsdom 渲染实测 |
| 21 个 `conversation.*` slot 无 markdown/fence 钩子 | ui-conversation `contract/slots.d.ts` 全量 slot 键 |
| `conversation.chat.node` 为 keyed shadowing：占 'assistant' cell 即整体替换，且 AssistantMarkdown 不导出 | ui-slots `entriesOfSlot` 语义 + ui-conversation 导出面 |
| client 插件产物 = CJS 单文件，`window.__ModuleLoader__.load({id,factory})` 包装，`codeSplitting:false` | ui-conversation-rewrite `tsdown.config.ts` |
| 插件安装为 profile pnpm workspace 行 | `~/.dsh/profiles/web/` 布局 |

## 2. 方案取舍

| 方案 | 结论 | 理由 |
| --- | --- | --- |
| A. `conversation.chat.node` 接管 assistant cell | 否 | 必须 100% 复刻 assistant 行（Think 行/mentions/interrupted），为 <5% 的轮次引入全量回归面 |
| B. DOM 嫁接（本方案） | 是 | 零宿主改动、零非目标回归；锚点单测钉死；自愈机制覆盖 React 重挂载/回滚 |
| C. Host 侧预编译 SVG（mermaid-cli） | 否 | 引 puppeteer 级依赖；且 client 仍需注入路径 |
| D. `conversation.view` 图表侧栏 | 否 | 不解决内联诉求；作为后续补充可行 |
| E. 只等上游 seam | 否 | 阻塞在 DSH core 节奏；Track 2 并行推进 |

## 3. 机制细节

### 3.1 稳定门（streaming 一致性）
宿主自身就是"streaming fence 纯文本、settle 才高亮"。嫁接对齐该节奏：候选 `code` 元素以 `textContent` 为键起 `STABLE_MS=400ms` 定时器；文本变化即重置；超时且 `isConnected` 才渲染。流式中的 fence 每块都在变 → 永不触发；settle 后一次触发。

### 3.2 嫁接形态（增量 only）
- `figure.dsh-mermaid-figure` 插入为 `pre` 的**兄弟**（React 引用式插入容忍外来兄弟节点）。
- 隐藏 `pre`：`code` 加 `dsh-mermaid-on` class + `pre` 直设 `style.display='none'`（React 重渲染覆盖 class 时，观察器视为"未嫁接"重新走稳定门，自愈）。
- figure 内：`stage`（净化后 SVG）+ 操作条（回看源码/复制源码/新窗口打开 SVG）+ 状态位（渲染失败时显示错误并自动露出源码）。
- 源码永不销毁：`pre` 及其内容零改动（除 display），失败路径一律回退为可见代码块。

### 3.3 mermaid 交付与懒加载（构建实测）
- `mermaid` 为 npm dependency，但 tsdown 默认把 dependencies 外置——ModuleLoader 的 `require` 只提供宿主模块，外置即运行时失败。
- 解法（已实测）：client 入口同时设顶层 `noExternal: ['mermaid']` 与 `outputOptions.codeSplitting:false`，产出**单文件** `lib/client.js` ≈7MB（未压缩；`.map` 不随 `files` 发布）。
- rolldown CJS 输出把 `import('mermaid')` 编为懒模块工厂（`require_mermaid`/`init_mermaid` 包装），boot 只注册不求值，首图才执行 mermaid 初始化。
- 备选（未采用）：按 chunk 拆分多文件——违反单文件 ModuleLoader 契约；minify 可再降到 ~2MB，为保持与仓库其余 bundle 一致的可读产物暂不开启。
- `initialize({startOnLoad:false, securityLevel:'strict', theme, fontFamily:'inherit'})`。
- 缓存：`Map<sha1-ish hash, svg>` LRU 32；in-flight 去重；同源重复图（滚动虚拟化重挂载）直接命中。

### 3.4 安全
- `securityLevel:'strict'`（转义标签 HTML、禁 click 链接）。
- 自研净化：DOMParser 解析 SVG → 标签白名单（svg/g/path/rect/circle/ellipse/polygon/polyline/line/text/tspan/defs/marker/title/desc）；属性白名单（几何/呈现类 + aria-*）；丢弃 `<style>`/`<script>`/`foreignObject` 与任意 `url(...)`/事件属性。
- 根 svg 强制 `max-width:100%; height:auto`。
- 无任何网络请求；mermaid 代码本地打包，不发 CDN（对齐 rich-media 设计的安全准入）。

### 3.5 主题
`matchMedia('(prefers-color-scheme: dark)')` → `dark|default`；变化时清缓存并对已嫁接图重渲染。dsh 自身主题 seat 接入留 V2。

### 3.6 生命周期与开关
- `apply(ctx)`：kill-switch（`localStorage['dshMermaid']==='off'` → no-op）；注入样式表；起 observer；`ctx.effect` 注册拆卸。
- 拆卸 = 断 observer + 清定时器 + 移除全部 figure + 还原 class/display + 移除样式表。
- 源码尺寸上限 64KB，超出按普通代码块处理。

### 3.6b 激活语义（实机补充）
- dsh ModuleLoader 只对 `dsh.client.immediately === true` 的行开机即载，其余等激活条件。mermaid 观察器必须全局常驻，bundle manifest 已声明 `immediately: true`（实机 boot JSON 验证透传）。
- 构建产物冒烟：`scripts/smoke-bundle.mjs` 直接执行 lib/client.js（stub ModuleLoader + jsdom + CSSStyleSheet），端到端验证 banner id/apply/观察器/SVG 渲染/卡片隐藏。

### 3.7 已知边界（诚实记录）
- React 若重渲染某 settle 消息（主题/语言切换），class 可能被覆盖 → 观察器自愈重嫁接（有 ≤STABLE_MS 闪烁窗口）。
- `:has()` 不依赖（直设 style），兼容性无虞。
- 上游若改 fence DOM 结构，锚点单测（真实 CodeBlock 渲染断言）先红，再迁 seam。

## 4. 包结构

```
packages/client/ui-mermaid-render/   @yeisme/dsh-client-ui-mermaid-render
  src/index.ts            host 面 no-op
  src/client/index.ts     apply/dispose/kill-switch
  src/client/observer.ts  稳定门+嫁接+自愈
  src/client/render.ts    mermaid 懒加载+缓存+主题
  src/client/sanitize.ts  SVG 白名单净化
  src/client/locales.ts  zh/en 文案
packages/bundle/dsh-mermaid-render/  @yeisme/dsh-mermaid-render
  cordis.patch.yml       insert 行
  src/index.ts           bundle host 面 no-op
  src/client/index.ts    再导出 client 包 ./client
```

## 附录 A：Track 2 上游 seam 规格（handoff）

`dsh-client-ui-primitives`/`ui-conversation` 新增 keyed slot：

```ts
'conversation.chat.markdown-fence': {
  kind: 'keyed'; scope: 'session';
  owner: { code: string; lang: string; streaming: boolean; t: Translate };
  keyProps: { [lang: string]: {} };  // entryKey = fence lang（小写）
}
```

- render.tsx 的 fence 分支改为：有 entry 命中该 lang 且 `streaming===false` → 渲染 entry；否则走现 `CodeBlock` fallback（字节级不变）。
- fixture DOM 不变（无注册时输出逐字节同旧）。
- seam 合并后本插件删除 observer/graft 层，`MermaidRenderer` 核心移入 slot entry 组件；bundle id 不变，用户无感迁移。
