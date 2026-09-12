# DSH 插件新 Tab 开发指南

> 状态：参考实现提炼；Web Tab 插件开发的仓内真源。
> 提炼自两个已验证的参考实现：`packages/bundle/dsh-pentest/`（vendored 上游自包含
> bundle，按会话渗透视图 tab + 图可视化）与 `packages/bundle/dsh-token-usage/`
> （仓内三包组合，process 级 token ledger 面板）。文中 API 均摘自两仓实际代码。
> 适用范围：`agent/harness-plugins`。视觉合同真源是
> [dsh-unified-panel-visual-system.md](./design/dsh-unified-panel-visual-system.md)。
> 实施前的设计压力测试见 [cookbook/dsh-plugin-grill-me.md](./cookbook/dsh-plugin-grill-me.md)（显式质询入口 `dsh-plugin-grill-me`）。

## 1. 先选对 seam：tab、pane 还是 overlay

| 用户可见形态 | seam | 参考实现 | 适合 |
|---|---|---|---|
| 会话内常驻视图 tab（对话区旁的「渗透」页签） | `slots.register({name: "conversation.view", ...})` | dsh-pentest | 与单个会话强绑定、按会话出现/消失的领域视图 |
| Workspace 右侧/浮动窗格（可拖拽、keep-alive） | `paneWorkbench.registerView({descriptor, component})` | dsh-token-usage | 跨会话的 process/project 级面板（账本、雷达、终端） |
| 会话头部动作 + 弹层兜底 | `slots.inject('conversation.session.header.actions')` + `slots.inject('shell.overlay')` | dsh-token-usage | pane 不可用时的人可见降级，永不静默消失 |

决策规则：领域数据**按会话作用域**（换会话就该换视图）→ `conversation.view` tab；
数据**超越单会话**（process/project 作用域）→ pane；只是某动作的入口 → header action +
overlay 兜底。两者都做时（token-usage），pane 为主、overlay 为诚实降级。

## 2. 包结构两种形态

### 形态 A：自包含 bundle（单包，dsh-pentest / anchored-standard 形态）

```
packages/bundle/<name>/
├── package.json          # dsh.bundle.patch + dsh.client.inject + exports 子路径
├── cordis.patch.yml      # 补丁层：insert 行 + id 覆盖行
├── lib/                  # 预构建产物（bundle 即交付面，见 §9 门禁）
│   ├── index.js          # host 入口（空 apply 也可——服务由子路径行提供）
│   ├── <feature>.js      # host 半：工具/协议/投影/存储
│   └── <feature>.client.js  # client 半：ModuleLoader 单文件（带 banner）
└── preset/<preset-id>/   # 预设（preset.yml + agent.cordis.yml）
```

`package.json` 关键字段（dsh-pentest 实例）：

```jsonc
{
  "exports": {
    ".": "./lib/index.js",              // host 行（patch insert 的 name）
    "./pentest": "./lib/pentest.js",    // host 能力子路径
    "./storage-sqlite": "./lib/storage-sqlite.js",
    "./preset-root": "./lib/preset-root.js",
    "./ui-pentest": "./lib/ui-pentest.js",   // web 行 host 半（空 apply）
    "./client": "./lib/ui-pentest.client.js" // web 行浏览器半
  },
  "dsh": {
    "client": {   // 浏览器半要内联的宿主运行时依赖
      "inject": ["@deepseek-ai/dsh-client-runtime", "@deepseek-ai/dsh-client-locale",
                 "@deepseek-ai/dsh-client-ui-conversation"],
      "platform": "web"
    },
    "bundle": { "patch": "./cordis.patch.yml" }
  }
}
```

### 形态 B：三包组合（仓内自研标准形态，token-usage 形态）

`packages/host/<feature>-host`（Node 面）+ `packages/client/ui-<feature>`（浏览器面，
tsx/React）+ `packages/bundle/<feature>`（薄组合层：bundle 的 `.` 导出转发 host，
`./client` 转发 client；tsdown 内联 workspace 包，产物必须自包含——
`check:bundles` 红灯任何残留 `@yeisme/*` require 或相对 chunk require）。

选型：UI 用 React 且要过仓内视觉门 → 形态 B；轻量/上游原样/纯数据预设 → 形态 A。

## 3. cordis.patch.yml：本仓收敛语法

本仓声明检查（`check:plugins` → declaration-lint）只接受 `- insert:` 下的
`- id:` / `name:` 行；解析不了的非注释行 fail-loud。两个合法形态：

```yaml
# 仓内自研 bundle：行名必须是本包导出面（name 本身或 ./子路径导出）
- insert:
    - id: dsh-token-usage
      name: '@yeisme/dsh-token-usage'
```

```yaml
# vendored 上游 bundle：允许完整 cordis 语法（无 name 的 id 覆盖行、多个顶层条目）。
# 目录必须带 YEISME-VENDORED.md，declaration-lint 对其 record-only（不解析不红灯）。
- insert:
    - id: ui-pentest
      name: '@howmp/dsh-pentest/ui-pentest'
    - id: storage-sqlite
      name: '@howmp/dsh-pentest/storage-sqlite'
      config:
        path: !!js dshHomePath('storages', 'pentest-sessions.db')

- id: storage-domain          # id 覆盖行：改宿主既有行配置（storage 域路由）
  config:
    backend: json
    routes:
      pentest: sqlite

- insert:
    - id: pentest-preset-root
      name: '@howmp/dsh-pentest/preset-root'
```

注意三点（都来自 dsh-pentest 的真实注释）：
- **web 行的 host 半是空 apply**——它只承载 client face 注册；把宿主插件再插一遍会让
  作用域工具目录重复注册，触发 client 命令失效循环。
- `!!js` 表达式在组合期求值（`dshHomePath` 可用），用于落 `$DSH_HOME` 相对路径。
- **宿主行归属预设而非全局 patch**：领域宿主插件只应出现在该领域的 agent preset 的
  `agent.cordis.yml` 里，否则所有会话都背着这套工具目录。

## 4. Host 面：四个注册点（dsh-pentest 实例 API）

```ts
// 1) 模型工具（8 个 pentest_* 工具同型）
ctx.tools.register(defineTool({ name: 'pentest_submit', description: '…', … }))

// 2) 系统提示词段（协议注入；order 决定段落位置）
ctx.inject(['systemPrompt'], (scope) => {
  scope.systemPrompt.section({ name: 'pentest:protocol', order: 50, text: () => PROTOCOL })
})

// 3) 会话投影单元（浏览器读取的会话级派生态；zod schema 声明形状）
ctx.inject(['sessionProjections'], (pCtx) => {
  pCtx.sessionProjections.register({
    key: 'pentest',
    schema: pentestProjectionSchema,
    stateSchema: pentestProjectionStateSchema,
    stateVersion: 3,
    …
  })
})

// 4) 存储域（领域表 + 懒打开 + 显式 dispose）
const domainPromise = ctx.storageDomain.open(pentestDomainSpec) // 领域 'pentest' v2 六表
ctx.effect(() => async () => { await store.dispose() }, 'pentest.domainClose')
```

设计约束：
- 工具返回**确定性 id**（`<kind>-<n>`，按会话计数），模型跨调用引用、会话投影从日志
  纯重放同一张图——投影是工具日志的折叠，不是第二份状态。
- **子 agent 直写**模式：指挥官只收摘要；子 agent 用专用提交工具（`pentest_submit`）
  直写父 intent，避免上下文爆炸。预设里用 `toolFilter.deny` 把读写工具对子 agent 收敛
  （只留 submit），对主 agent 暴露全目录。
- 存储只进 `$DSH_HOME/storages/*.db`（经 patch 路由），记录按单会话作用域；
  sqlite 后端要求 Node >= 22.5（`node:sqlite`）。

## 5. Client 面：按会话 tab（conversation.view）

dsh-pentest 浏览器半（`lib/ui-pentest.client.js`）的完整形态：

```ts
export const inject = ['slots', 'locale', 'sessions'] as const

export function apply(ctx: Context): () => void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-pentest: dictionaries')
  const t = ctx.locale.bind(NS)

  // 按会话挂载：当前会话（或列表祖先链）带目标 agentPreset 才注册 tab，
  // 一旦不满足立即 dispose —— 永远不给非领域会话留死 tab。
  ctx.effect(() => {
    let sessionId: string | undefined
    let sessionPentest = false
    let disposeEntry: (() => void) | undefined
    const sync = () => {
      const snapshot = sessions.list.getSnapshot()
      const current = snapshot.current
      const pentest = current === undefined ? undefined : isPentestSession(snapshot, current)
      if (current === sessionId && pentest === sessionPentest) return
      disposeEntry?.()
      disposeEntry = undefined
      sessionId = current
      sessionPentest = pentest === true
      if (current === undefined || pentest !== true) return
      disposeEntry = ctx.slots.register({
        name: 'conversation.view',
        id: 'pentest',
        order: 20,
        locale: NS,
        label: () => t('view.pentest'),
      }, PentestView)
    }
    sync()
    const off = sessions.list.subscribe(sync)
    return () => { off(); disposeEntry?.() }
  })
}
```

要点：
- 会话判定走 `sessions.list` 快照 + `parentId` 祖先链 + `seen` 环防护（子会话继承父
  preset）。
- `slots.register(name, component)` 返回 disposer——**注册/卸载必须对称**，且随会话
  切换重算；tab 的出现与消失都是状态，不是常驻。
- 文案必须 zh/en 双字典（`locale.register(NS, {zh, en})`），label 走 translator。

## 6. Client 面：workspace pane + 诚实降级（token-usage 形态）

```ts
export const inject = ['slots', 'locale'] as const

export function apply(ctx: Context): () => void {
  const disposers: Array<() => void> = []

  // 1) 能力探针先行：Remote 缺失 → 入口可见但 disabled，带可读原因
  void resolveTokenUsageRemote(ctx).then(async remote => {
    if (disposed || remote === undefined) return
    const probe = await probeInsightsCapabilities(remote, t('empty.usage'))
    probeStore.attach(probe)   // disabledReason() 由此而来
  })

  // 2) pane 注册（keep-alive 单例窗格）
  const pane = optionalLookup(ctx, 'paneWorkbench') as PaneWorkbenchFace | undefined
  if (pane !== undefined) {
    const d = pane.registerView({
      descriptor: {
        kind: 'workspace.token-usage',       // 领域唯一 kind
        label: 'Tokens',
        componentKey: 'token-usage-panel',
        role: 'navigator',
        preferredRegion: 'right',
        retention: 'keep-alive',
        singleton: true,
      },
      component: (props?) => createElement(TokenUsagePaneView, { … }),
    })
    disposers.push(d)
  }

  // 3) 会话头动作入口 + shell.overlay 兜底（pane 面缺席时仍可打开）
  disposers.push(ctx.slots.inject('conversation.session.header.actions', () =>
    ctx.slots.register({ /* …openTokens 注入… */ })))
  disposers.push(ctx.slots.inject('shell.overlay', () =>
    ctx.slots.register({ name: 'shell.overlay', /* headless: true, closeLabel */ })))

  return () => { for (const d of disposers) d() }
}
```

要点：
- **能力探针在查询之前**；缺失能力 = 入口可见但禁用 + `disabledReason()`，不是隐藏也
  不是裸报错。这是仓红线「probe 未合入不渲染入口（禁用+原因）」的 client 落法。
- `descriptor.kind` 全仓唯一；`retention: 'keep-alive'` + `singleton: true` 用于账本类
  面板（切走再回来状态不丢、不重复挂）。
- apply 返回顶层 disposer，所有子注册（pane、slot、locale、订阅）都汇入其中——HMR、
  profile 切换、插件禁用全部对称 teardown。

## 7. 可视化流程（探索图形态，dsh-pentest 实例）

领域数据是「目标→意图→事实/资产/漏洞」的有向图，浏览器侧渲染管线：

1. **数据面**：会话投影单元把已日志化的 `pentest_*` 调用折叠为
   `{ goal, nodes, assets, edges, counts }`——客户端不重放工具日志，只读投影。
2. **窗口视图**：节点/资产/边各保留最新 200 个，超出逐出最旧并同步清理悬挂边；
   UI 计数如实标注「窗口视图」，完整数据以 `pentest_state` / `pentest_report`（读存储
   层）为准——**UI 允许有界，但必须诚实声明边界**。
3. **图渲染**：`@xyflow/react`（内联进 client bundle），静态分层布局（可平移缩放，
   节点不可拖拽——先做确定性布局，交互拖拽是后续增强而非首跑门槛）。
4. **边语义**：边带关系胶囊（spawns/yields/derived_from/proves/parent），关系类型是
   领域 schema 的一部分，不是 UI 字符串。
5. **多子 tab**：一个领域 tab 内再分链路/漏洞/资产/报告子页，共用一份投影快照。
6. **报告导出**：Markdown 渲染 + 复制 + 保存；报告由 host 端 `*_report` 工具从存储层
   生成，浏览器只渲染——生成逻辑不下沉浏览器。

视觉合同：仓内自研面（形态 B）必须消费 `@yeisme/dsh-client-ui-surface` /
`ui-visual-kit` token 并过 `check:surfaces` + `test:visual`；vendored 上游面（形态 A）
登记为视觉豁免（见 §9），但交互质量标准不变（焦点返回、双语、禁用原因）。

## 8. 预设与协议注入（领域模式插件专用）

领域 tab 通常配一个专属 agent preset（dsh-pentest 的 `preset/pentest/`）：

- `preset.yml`：`name`/`description`（中文，面向模式选择器）。
- `agent.cordis.yml`：复制官方 `standard` 预设，追加：persona（指挥官角色 + `{{model}}`
  /`{{cwd}}` 插值）、领域宿主行（`@howmp/dsh-pentest/pentest`）、子 agent 行
  （`toolFilter.deny` 收敛 + 执行者 persona：禁止建 goal/报告、强制真实父 intentId、
  只在授权范围内执行）。
- 预设目录用 **preset-root 插件只读注册**（不复制进 `$DSH_HOME/.agent-presets`，兼容
  rc.6 的 bundled preset root 语义），这样升级 bundle 即升级预设，用户无感。
- 协议正文走 `systemPrompt.section`（order 50），persona 只写角色；「提案→决策→执行」
  流程规则集中在协议段，用户只需发目标 + 目的 + 授权说明。
- `pentest_add_goal` 的 `authorization` 参数落审计事实（写入状态与最终报告）。它只是
  留痕不是门禁——真正的执行约束来自部署沙箱与审批。

## 9. 仓内门禁与完成定义

```bash
pnpm install
pnpm run typecheck            # pnpm -r build + typecheck
pnpm run test                 # 全仓 vitest（含 vendored 包上游测试）
pnpm run build
pnpm run check:bundles        # 27/27：lib/client.js 自包含 + ModuleLoader banner id == 包名
pnpm run check:plugins        # declaration-lint / safe-projection / dispose-hmr / visual-token / …
pnpm run check:surfaces       # React 面视觉合同（形态 B 必须；vendored 不发现即不适用）
```

- 完成门是**本仓协议对接**，不依赖官方 DSH seam、不把官方 web boot 当验收（AGENTS.md
  红线）；`dsh plugin add` + boot 冒烟是可选 host 集成证据，写入
  `temp/integration-test-runs/<run-id>/`（脱敏）。
- `check:bundles` 跳过无 `scripts.build` 的包（预设/数据/vendored 形态 A）；
  declaration-lint 对带 `YEISME-VENDORED.md` 的目录 record-only。
- 形态 A 上游 vendored 的入库规则：排除 `.git`/lockfile/上游逐包构建产物/过程稿，
  `lib/` 预构建产物**必须入库**（`.gitignore` 加目录级否定规则），pin commit + 许可 +
  升级流程写进 `YEISME-VENDORED.md`；升级 = fresh clone 逐字节 diff + 人工复核 + 门禁
  重跑。

## 10. 安装与冒烟（用户 profile）

```bash
dsh plugin --profile web add ./packages/bundle/<name>
dsh --profile web --dump-config | grep <feature>   # 组合结果：insert 行 + id 覆盖生效
timeout 40 dsh --profile web --port 0              # boot 冒烟：URL 打印、shutdown errors=0
```

组合正确的标志：`# == <bundle>, patched by …` / insert 行三件套（web 行、存储行、
preset-root 行）全部出现在 dump 里，且 storage-domain 覆盖路由挂在 `dsh-base` 的
patch 注记下。
