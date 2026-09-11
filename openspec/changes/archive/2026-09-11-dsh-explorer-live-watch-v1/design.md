# dsh-explorer-live-watch-v1 Design

## Context

- 客户端消费面全就绪：`ExplorerWatchController`（折叠/gap-reconcile/零轮询）、`ExplorerRuntimeV2.fileWatch`、`tree-state` intents（`watch`/`reconcile_apply`/`children_ready`/`expand`/`focus`）。
- 服务端 `/yeisme-files/api`（`handleYeismeFilesApi`，webServer.register 给 raw `(req,res)`）为 POST-JSON 路由；`fs.upload.chunkV1` 已有 query 传参先例、`fs.download.consumeV1` 已有流式响应先例。
- 09-09 followups 决策「等上游 fs-watch」被本 change supersede：合同与 `upstream-prs/fs-watch/new-files/packages/fs/fs/src/watch.ts` 逐字一致（`FileWatchEventV1{cursor,sequence,op,entryRef,parentRef?,occurredAt}` / `FileWatchHandle{subscribe,snapshotCursor}`），服务器是本仓自有 owner。**用户 2026-09-11 决策。**

## Goals / Non-Goals

**Goals**：owner 侧真实 watch 端到端（server watcher → SSE → 浏览器 host → runtime 广告 → 控制器消费）；explorer 活度徽标 + 用户显式刷新；reveal-in-tree。

**Non-Goals**：不解锁 rendition/thumbnail（后续切片）；不做 per-parentRef 作用域流（v1 整 workspace，合同参数保留）；服务端不做复杂事件合并（客户端折叠已建）；不动 `dsh-file-watch-pane` spec 语义与 `FileWatchCapabilityV1` 类型。

## Decisions

### D1: chokidar@^4 而非裸 fs.watch
Linux 无 recursive `fs.watch`；chokidar 自行走目录树。`ignoreInitial: true`，`ignored` 仅 `.git`（树列表以 ignored 标志**列出** gitignored 条目，事件一致性要求照发；`.git` 内部树上不可见故不发）。另加 `awaitWriteFinish`（80ms 稳定期）削写入抖动。依赖先例：mammoth/@e965/xlsx（proposal 记录理由）。

### D2: SSE（GET）而非 long-poll 为主传输
webServer.register 给 raw res，SSE 直写 `text/event-stream`。GET 放行仅此一个方法（顶部方法门特例）；sessionId 走 query（`fs.upload.chunkV1` 先例）。`retry: 3000` + 15s 心跳注释。**兜底**：若真 boot 冒烟发现链路缓冲阻断 SSE，切换 long-poll POST `fs.watch.pollV1`（同事件 JSON、waitMs 25s）——传输封装在浏览器 host 单个函数内，切换局部化。重连语义：浏览器 host 在 EventSource `error` 时以最新 cursor 主动重开（自带重连会从旧 since 重放产生重复，不用）。

### D3: 引用计数 + 环形缓冲（512）
registry 按 workspace realpath 计数：`acquire(cwd)` 首次创建 watcher，`release` 归零 close。无订阅零开销（呼应「零轮询」精神）。每 workspace 单调 sequence、cursor=`${seq}`，环形缓冲最近 512 条供 `since` 重放；更早历史由客户端 sequence gap → 既有一次权威重读兜住。

### D4: ref 铸造确定性（OpaqueFileRefRegistry.issue）
同 process 内 watcher 与树列表共用 registry 实例：`issue(workspace, canonicalPath, isDir)` 幂等（sha256(secret+key)），新建路径即铸造——事件 ref 与后续 `fs.treeV2` 列出的 ref 天然一致（spec scenario）。ref 形如 `file-<hash>`/`dir-<hash>`，天然通过 opaque 校验；服务端出站仍跑等价 `assertWatchEvent` 防御。

### D5: reveal-in-tree 由并行 lane 交付（本 change 不做）

原计划经 reveal 总线驱动树定位；会话期间并行 search-center 波次已落地同语义链路（reveal-channel/reveal-navigation + `revealResource` 绑 `fs.revealV2`），本 change 移除该项避免双实现。原 D5 备份：~~reveal 走 owner 面包屑 + 既有 intents，反向通道用轻量 bus~~
runtime 无视图入站通道；新增 `ExplorerRevealBusV1{subscribe,request}`（纯 JS 观察者，apply.ts 持有、视图订阅）+ runtime 可选 `revealPath(ref)`（绑定 `fileHost.treeV2.reveal`，返回面包屑+目标）。视图处理：过滤态跳过；否则按面包屑顺序 `listChildren` → `children_ready`+`expand` → `focus` 目标；窄屏只 focus。全部复用既有 intents，不新增树状态字段。

### D6: 徽标 + 刷新放 explorer 头部，视图级刷新
`data-file-watch=live|ondemand`（控制器绑定成功与否）+ `data-freshness`（state.freshness）。刷新按钮调视图级 `refresh()`（重读 roots+已展开目录），不用 `controller.reconcile()`（无能力时它不清障）；重读经 `reconcile_apply` 语义保留展开/选择/焦点/滚动锚点。legacy `FilePane` 的 `probeFileWatch` 因 host 新能力自动变 live，零改动。

## Risks / Trade-offs

- **SSE 经 DSH webserver 的缓冲未知**：实现时先 curl 冒烟；不通切 D2 兜底。
- **事件风暴**（git checkout 等）：客户端折叠已建；服务端保持直发（简单优先），设计中记录。
- **大工作区 watcher 启动成本**：chokidar 首次扫描在订阅时发生一次；ignore 集缩窄范围。
- **并行 lane 共树**：触点无重叠（tree-ui.tsx 为本 lane 未提交文件）；全部 additive。

## UI Contract

（按 `docs/design/dsh-unified-panel-visual-system.md` §12）

- Surface classification: **adopted**（`dsh.explorer` 既有 navigator Surface 面上的增量控件，消费 `--vk-*` token）
- Surface kind: navigator
- First / second / third visual priority: 1) 树行（不变）；2) 头部搜索/活度行（徽标为文本 pill，不新增卡片）；3) 刷新按钮（官方 Button primitive，toolbar variant）
- Existing components reused: `Button`（@deepseek-ai/dsh-client-ui-primitives）、既有 header 布局与 `Input`；不新增图标（徽标用文本 + data 属性供测试）
- Cards that earn existence: 无新卡片
- Primary scroll owner: 树主体（不变）

### State Matrix

| Feature | Loading | Empty | Error | Success | Partial/Stale | Disabled |
|---|---|---|---|---|---|---|
| 活度徽标 | 初始化 → ondemand | N/A | 流断开 → stale（data-freshness） | live | gap 折叠期间沿用 state.freshness | 无能力 → ondemand 如实标注 |
| 刷新按钮 | 重读在途禁用 | N/A | 重读失败 → 既有 errors.search/root 面 | 触发视图级重读 | — | 无 runtime 时禁用 |
| reveal | 在途静默 | 目标不存在 → 面包屑到父级即止 | revealPath 失败 → 静默保留现状（不弹错） | 祖先展开+focus | — | 搜索态跳过 |

### Responsive

| <=420px | 421–720px | >720px |
|---|---|---|
| 徽标收为图标式短文案（「live」/「手动」），刷新按钮图标化 | 头部单行：搜索 + 徽标 + 刷新 | 同左，徽标带完整文案 |

### Accessibility

- Keyboard path: 徽标非交互（`aria-hidden` 文本+`role="status"`）；刷新按钮 Tab 可达、Enter/Space 触发，`aria-label` 明确
- Focus owner/return: 刷新后焦点回树（`focus` intent 已有行为）
- Visible labels and accessible names: `aria-label` 用 i18n 键；`data-file-watch`/`data-freshness` 供测试断言
- Reduced motion and coarse pointer: 无动画；44px 行既有行为不变

### Visual Exceptions

- 无。徽标颜色 `--vk-text-tertiary`（ondemand）/`--vk-state-success` 既有 token（live）/`--vk-state-warn`（stale），边 `--vk-border-l1`。

## Testing

- `dsh-file-host` node：watch-registry spec（临时目录真实 create/rename/delete → 事件+ref 与列表一致；.gitignored/.git 无事件；since 重放；引用计数关闭——registry 状态断言）；SSE spec（node http 挂载：cursor+事件+心跳；未知 sessionId 403；断开 release）。
- `dsh-file-host` 浏览器面：EventSource stub——订阅分发/形状校验丢弃/重连带最新 cursor/末位退订 close。
- `ui-pane-workbench`：徽标 on-demand/live 两态 + 刷新触发视图级重读（runtime.roots/listChildren spy、展开/选择保留断言）；explorer 既有回归。
- `dsh-desktop-workbench`：typecheck + bundle test（runtime 广告为条件注入，由 host capabilities 驱动）。
- 真机：`dsh:workbench --check` + SSE curl 冒烟 + 浏览器树 live/增量刷新目视验证；证据 `temp/integration-test-runs/`。

## Rollout / Rollback

- rollout：随 bundle 发布；无数据迁移。无 EventSource/webServer 环境自动回退 on-demand。
- rollback：撤 apply.ts 的 `fileWatch` 广告（一行）；服务端/浏览器实现独立保留待用（无消费者时零开销）。
