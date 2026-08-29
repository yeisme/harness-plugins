# DSH slash 命令

[English](slash-commands.md) | 中文

`/` 实时目录由 `@yeisme/dsh-command-experience` 拥有。session / agent 仍是
receipt-gated 的 owner action。inspect 命令只打开已有表面。面板插件贡献
slash 名时不必改 command-experience 源码。

## 常见命令

| 命令 | 行为 | 缺目标时 |
| --- | --- | --- |
| `/session` | session 中枢：切换、重命名、归档、恢复 | 缺 `open-session` 则禁用 |
| `/agent` / `/agents` | 线程选择器 | 缺 `open-thread` 则禁用 |
| `/mcp` | 打开 Tools / MCP 检查器对话视图 | 禁用：未安装 MCP inspector |
| `/skills` | 打开 Agent Context 的 skills 页 | 禁用：未安装 Agent Context |
| `/plugins` | 列出已加载插件 id | 本地 inspect，不 RPC |
| `/pane` | 面板选择器；`/pane explorer` 打开唯一 kind | 缺 Pane Workbench 则禁用 |
| `/explorer` / `/files` | 打开 `dsh.explorer` | 视图未注册则禁用 |
| `/git` | 打开 `dsh.source-control` | 视图未注册则禁用 |

第一次 `/` 发现不发 RPC。缺 owner action 或缺表面时命令仍可见，并带禁用原因。

在 host 面上这些 inspect 命令是真正的官方命令：与官方命令一起出现在 composer
菜单里，执行会落持久的 `command/run` + `command/done` 记录。表面缺失时执行
返回同样的原因作为明确的文本结果，而不是静默失败。官方拥有的名字
（`goal`、`plan`、`model`、`compact`、`feedback`、`permission`、`export`）
永远不会被投影——它们归官方插件。

## 面板热插拔

新面板不必改 command-experience 代码。

1. 注册 picker 可见的 view，会出现在 `/pane`。
2. 命令标记 `presentation.launcher: true`，会以 `/creator-open` 出现（点号变连字符）。
3. 可选协议字段 `slash.name` 发布短名，例如 `/creator`。

卸载面板后这些行立即消失。P0 保留名（`mcp`、`skills`、`session`、`agent` 等）
不能被抢走；冲突贡献保持禁用。

```ts
commands: [{
  id: 'creator.open',
  label: '打开 Creator Studio',
  presentation: { launcher: true },
  slash: { name: 'creator', category: 'pane' },
}]
```

## 自定义 host 命令

有文本结果的命令仍注册到官方 `commands` runtime：

```ts
export const inject = ['commands']

export function apply(ctx: Context): () => void {
  return registerYeismeCommand(ctx.get('commands'), {
    name: 'yeisme-foo',
    description: 'One-line owner projection.',
    handler: () => ({ kind: 'success', text: '...' }),
  })
}
```

名字必须匹配 `yeisme-[a-z0-9_-]+`。实时目录会把这些 host 命令投影进 `/`，
不复制 handler。

三条注册规则让自定义 bundle 不破坏 boot（失败形态见下方排障）：

1. `inject = ['commands']` 是 wait-for 契约，不是装饰。
2. 永不占用官方名字；`register()` 前先 `find()` 检查。
3. 返回 `{ kind, text }` 结果；composer 执行它们不需要 RPC。

## 排障

- **命令永远不出现在 `/` 里**：插件必须声明 `inject = ['commands']`。
  空 inject 时 loader fiber 可能在 dsh-base 提供服务之前启动 apply，
  fail-closed 跳过会静默丢掉全部注册。
- **boot 报 `command "goal" is already registered`**：自定义命令不能占用官方
  runtime 拥有的名字（`goal`、`plan`、`model`、`compact`、`feedback`、
  `permission`、`export`…）。registry 先到先得且重复注册硬失败，热插拔 bundle
  必须让位。
- **一个 bundle 拖垮整棵插件树**：client bundle 若混入 `require("module")` 之类
  externals 漂移，整个 client 树加载失败（"Failed to load plugins" 横幅）。
  client 构建必须保持零 Node 内建依赖。

## 本地验证

```bash
pnpm --filter @yeisme/dsh-client-ui-command-experience-core test
pnpm --filter @yeisme/dsh-command-experience test
pnpm --filter @yeisme/dsh-pane-protocol test
openspec validate dsh-slash-directory-hotplug-v1 --strict --no-interactive
```

### 真实 runtime 验证

单测用的是同步 fake，抓不到 loader 时序。注册相关改动收口前必须 boot 真实
runtime：

```bash
pnpm --filter @yeisme/dsh-command-experience build   # profile 加载的是 lib/，不是 src/
TMP=$(mktemp -d); DSH_HOME=$TMP dsh plugin --profile web add ./packages/bundle/dsh-command-experience
DSH_HOME=$TMP dsh --profile web --port <port> --no-open
```

然后驱动真实 UI（浏览器 e2e 配方在
`packages/host/yeisme-commands/scripts/run-slash-browser-evidence.mjs`）：
打开页面、连上工作区、输入 `/` 核对菜单行。持久化证据落在 session 日志——
`command/run` 带命令名、`command/done` 带 handler 结果。运行中的 `dsh web`
服务器持着自己的导入：重建后必须重启服务器再测。
