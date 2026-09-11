# dsh-explorer-live-watch-v1

## Why

dsh web 的目录树（`dsh.explorer`）当前是纯按需读取：外部工具（编辑器、脚本、git）改动工作区后，树不会刷新。客户端的 watch 消费面已全部就绪——`ExplorerWatchController`（事件折叠、sequence gap → 一次权威重读保用户位置，零轮询零定时器，12 项测试）与 `ExplorerRuntimeV2.fileWatch` 能力探测、`tree-state` 的 `watch`/`reconcile_apply` intents 都在——但服务端 `/yeisme-files/api` 从未提供 `fs.watch`，desktop runtime 不广告 `fileWatch`，客户端只能诚实降级为显式读取。

2026-09-09 followups 决策「等上游 fs-watch seam 合入再交真实 watch」。本 change 推翻该注记（**用户 2026-09-11 决策**）：`/yeisme-files/api` 服务器与 `FileWatchCapabilityV1` 合同均为本仓自有（合同与 `upstream-prs/fs-watch` 提案逐字一致，事件形状 `{cursor, sequence, op, entryRef, parentRef?, occurredAt}` 同构），由 owner 侧直接交付真实 watch；上游将来合入官方 ctx.fs.watch 时浏览器 source 可平移替换，客户端语义零改动。

同批交付**活度徽标 + 用户显式刷新**（explorer 头部显示 live/ondemand；`dsh-file-watch-pane` spec 明确允许 user-explicit refresh，但此前无入口）。reveal-in-tree 原列入本切片，实施时发现并行 lane（search-center 波次）已交付同语义链路，本 change 撤销该项避免双实现。

## What Changes

- 新增 `packages/host/dsh-file-host/src/watch-registry.ts`（node-only）：按 workspace realpath 引用计数的 chokidar watcher 注册表；事件映射为 `FileWatchEventV1`（opaque ref 经 `OpaqueFileRefRegistry.issue` 确定性铸造，新文件即铸造）；恒忽略 `.git`（.gitignore 命中路径与树列表一致照发事件，树以 ignored 标志列出它们）；每 workspace registry 生命周期单调 sequence（跨 watcher 重启不回退）+ 每 generation 最近 512 条环形缓冲。
- `handleYeismeFilesApi` 新增唯一 GET 方法 `fs.watch.streamV1`（SSE）：`sessionId` query fence（先例 `fs.upload.chunkV1`）；首条 `cursor` 事件 + `since` 重放 + 15s 心跳；连接关闭即 release 引用。现有方法零改动。
- `createExplorerFileHost`（浏览器）实现 `watch(parentRef?)` + `capabilities` 含 `FILE_WATCH_CAPABILITY`：懒单例 EventSource、事件形状校验、error 时以最新 cursor 主动重开、末位退订即 close。`probeFileWatch` 对该 host 变为 live。
- `dsh-desktop-workbench` apply.ts：`ExplorerRuntimeV2` 广告 `fileWatch`（host 结构兼容 `ExplorerWatchSourceV1`，`ExplorerWatchController` 立即开始消费）。
- `ui-pane-workbench`：explorer 头部活度徽标（`data-file-watch="live|ondemand"` + `data-freshness`）+「刷新」按钮（视图级重读 roots+已展开目录，走 `reconcile_apply` 语义，两种模式通用）。
- **reveal-in-tree 不在本 change 交付**：会话期间并行 lane（search-center 波次）已落地完整 reveal 链路（`reveal-channel.ts`/`reveal-navigation.ts`、`ExplorerRuntimeV2.revealResource` 绑定 `fs.revealV2`、tree-ui 消费、`revealExplorerResource` 工作台面）。本 change 不重复实现、不改动其语义；spec 相应 Requirement 已移除。

## Required Capability Ledger

| 能力 | 状态 | canonical owner | 本切片 | 验收证据 |
| --- | --- | --- | --- | --- |
| 服务端 workspace watcher | required | Harness Plugins | deliver-now | watch-registry spec（真实 fs 事件） |
| SSE 传输（cursor/重放/心跳/fence） | required | Harness Plugins | deliver-now | SSE handler spec + 真 boot 冒烟 |
| 浏览器 host `watch()` | required | Harness Plugins | deliver-now | host spec（EventSource stub） |
| runtime 广告 + 控制器消费 | required | Harness Plugins | deliver-now | apply 断言 + explorer 回归 |
| 活度徽标 + 显式刷新 | required | Harness Plugins | deliver-now | 组件测试 + check:surfaces |
| reveal-in-tree | required | Harness Plugins | delivered by parallel lane | search-center 波次已落地（reveal-channel/reveal-navigation/revealResource）；本 change 不重复 |
| 官方 ctx.fs watch seam | required | DeepSeek Harness | retain-next | 上游合入后 source 平移 |
| 缩略图/元数据列 | optional | Harness Plugins | not in slice | 需 rendition 预算设计，后续切片 |

## Capabilities

### New Capabilities

- `dsh-explorer-live-watch`: owner 侧真实文件 watch 的端到端交付（服务端 watcher、SSE 传输、浏览器 host、runtime 广告、活度表面）与 reveal-in-tree 合同。

### Modified Capabilities

无。`dsh-file-watch-pane` 既有 Requirement（live 仅在 FileWatchCapabilityV1 在场、否则按需+显式刷新、零后台轮询）不变——本 change 是其 owner 侧实现；`FileWatchCapabilityV1` 类型零改动。

## Impact

- 触点：`packages/host/dsh-file-host`（新 watch-registry.ts、node.ts SSE 路由、index.ts 浏览器 watch、package.json +chokidar@^4）、`packages/client/ui-pane-workbench`（runtime.ts、tree-ui.tsx、i18n）、`packages/bundle/dsh-desktop-workbench`（apply.ts）。
- 新依赖：`chokidar@^4`（MIT）——Linux 无 recursive `fs.watch`；mammoth/@e965/xlsx 有依赖先例。
- 兼容性：additive、experimental；无 watch 能力的环境（无 webServer/EventSource）自动回退既有 on-demand 路径。rollback = 撤销 apply.ts 的 `fileWatch` 广告一行（服务端/浏览器实现可独立保留待用）。
- 与并行 lane 无文件重叠。
