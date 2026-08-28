## Context

DSH 的 Cordis logger 已提供 structured `Message` 与 exporter 注册面，但默认 Web profile 主要只打印启动 URL。DSH session events 已包含 turn、assistant chunk、tool call/result、retry 与 terminal result，Node 运行时提供 `perf_hooks`/`inspector`，浏览器提供 Performance API；这些公开面足以完成插件先行的本地 DevTools，而不需要复制 session state 或等待 DSH core 新 trace bus。

本仓库已有 host/client/bundle 三包模式、Typert Remote、自挂载 strict codec、Pane Workbench/overlay 降级和 package-local Vitest/Playwright 证据模式。当前工作树包含大量并行修改，本 change 只新增 DevTools 专属路径，并对共享 manifest/lockfile 做最小增量。

## Goals / Non-Goals

**Goals:**

- 安装一个公开 bundle 后，让普通 `dsh --profile web` 在 stderr 输出安全、可扫描的开发日志与性能摘要，保持 stdout 原合同。
- 用有界内存记录统一 Host 日志、session/tool span、Node samples 和 deterministic findings。
- 在 Web 中合并 Host snapshot 与浏览器本地性能记录，提供 bottom DevTools panel 和 overlay fallback。
- 提供版本化 snapshot Remote、浏览器诊断导出，以及受 Host 本地授权约束的短时 CPU profile。
- 默认低开销、无磁盘持久化、无网络遥测、无新运行时依赖。

**Non-Goals:**

- 不输出 raw prompt、system prompt、tool arguments/results、provider payload、凭据、Authorization、绝对路径或完整 stack。
- 不提供 heap snapshot、raw log/unsafe mode、自动磁盘日志、OTel 上传或远程 collector。
- 不实现 DSH core 级精确 RPC span/correlation；V1 明确报告 `exactRpcCorrelation=false`。
- 不新增 scheduler、session ledger、浏览器 domain store 或独立 dashboard shell。

## Decisions

### 1. 三包交付，wire 由 Host/Client 镜像

新增 `@yeisme/dsh-devtools-host`、`@yeisme/dsh-client-ui-devtools` 和统一 `@yeisme/dsh-devtools` bundle。Host 拥有采集与 Remote，Client 拥有浏览器采集与 UI，bundle 只插入一个 profile row。V1 不增加 SDK 包；Host 与 Client 像 token usage/tool hub 一样保持 strict wire mirror，合同测试防漂移。

### 2. 一个 monotonic record stream，多种有界记录

Host 维护 process-scoped `bootId`、monotonic `seq` 和四个有界 ring：safe logs 2000、spans 1000、samples 600、findings 200。`DevtoolsRecordV1` 是 `log | span | sample | finding | lifecycle` 判别联合；记录只含 epoch time、duration、stable code、safe name、opaque ref 与白名单数值。

`snapshot({ afterSeq, limit })` 默认 limit 200、最大 500；返回 `nextSeq`、`truncated`、summary 与 capabilities。客户端按 cursor 拉增量，buffer rollover 时收到 `truncated=true` 并从最早可用记录继续，不把缺口伪装成完整 trace。

### 3. Terminal 是同一安全投影的 human renderer

DevTools exporter 不直接格式化 Cordis 任意 args。它只保留 logger source/severity、稳定 fingerprint、可验证为静态安全的短摘要和可选 error code；动态 string/object 参数均折叠为 redacted markers。session/tool/performance 日志由插件从白名单事件生成，因此能显示有用字段而不读取私有 payload。

所有 DevTools diagnostics 写 stderr。启动、周期 summary、slow/error finding 与 shutdown summary 使用英文单行文本；stdout 不增加 banner、JSON 或日志。`DSH_DEVTOOLS_LEVEL=error|warn|info|debug` 只控制显示/保留等级，任何等级都使用同一 redaction；`NO_COLOR` 关闭 ANSI。

### 4. Session/tool spans 只从稳定事件派生

Host 订阅可用的 `session/created`、`session/event`、`session/disposed` 与 `agent/error`。turn 从 `turn/start` 到 `turn/end`；TTFT 从 turn/request 起点到第一个 assistant chunk；tool span 用 opaque call id 配对 `tool/call`/`tool/result`；retry/error 生成 lifecycle/finding。缺失配对的 span 在 session dispose/shutdown 时以 `partial` 结束，不猜测成功。

### 5. Node 原生采样与确定性 finding

采样器每秒记录 `process.cpuUsage()` delta、`process.memoryUsage()`、`performance.eventLoopUtilization()` delta 和 `monitorEventLoopDelay()` p95。每 10 秒输出一次变化摘要；slow/error finding 即时输出。

默认规则：tool 5s、TTFT 3s、API 500ms、event-loop p95 100ms、browser long task 50ms、5 分钟 RSS 增长 128 MiB。Finding 使用稳定 code 与 evidence seq，不使用模型生成分析。

### 6. CPU Profile 是 bounded local-only Remote action

`devtools.captureCpuProfile@1` 使用 `node:inspector`，默认 10 秒，允许 1–30 秒，同时最多一个 capture。Host 必须从可用 Web runtime/authority face 证明当前 surface 为 loopback/local；无法证明时 capability=false 并返回 `not_local` 或 `capability_unavailable`。

RPC 断开、timeout 或 plugin dispose 都必须在 `finally` 中停止 Profiler。返回前移除绝对 script URL：workspace 内路径转相对路径，外部路径转 `<external>`。不提供 heap snapshot。

### 7. Browser collector 全局轻量运行，UI 打开时才拉 Host

Client plugin 激活后使用 feature-probed `PerformanceObserver` 采集 navigation/paint、LCP candidate、layout shift、long task 与同源 `/api` resource timing；URL 只保留 pathname，删除 origin/query/hash。浏览器 ring 只驻留当前页面内存。

DevTools panel 挂载时调用 Host snapshot，通过请求开始/结束时间与 `serverTime` 估算 offset 和 `clockUncertaintyMs`。Host 与 Browser lane 可近似对齐，但 UI 明示 exact correlation unavailable。PerformanceObserver 不支持某 entry type 时只关闭对应 capability。

### 8. Diagnostics pattern，bottom pane 主面、overlay 降级

Client 注册 `workspace.devtools` singleton utility view，`preferredRegion: bottom`，采用 diagnostics/timeline pattern：Overview、Timeline、Logs、Performance 四个 tabs；header 提供 CPU Capture 与 Export。复用现有 visual tokens、native buttons/tabs、CSS/SVG，无图表或动画依赖。

Pane Workbench 可用时从 session header action 打开 bottom view；Pane 缺失时同一 panel 进入 `shell.overlay`。Host Remote 缺失时入口可见但 disabled，并提供 readable reason。所有交互支持键盘、ARIA、focus return 和 reduced motion。

### 9. Export 由浏览器应用生成

Export action 将最近 Host snapshot、浏览器 records、clock estimate、capabilities、summary 与 redaction report 组装成单一 `dsh.devtools.export` JSON v1 Blob 下载。应用服务生成结构化文件；不写 Host 文件、不返回绝对路径。导出前再次运行深度 forbidden-key/string sentinel scan，发现违规则拒绝下载并显示安全错误。

### 10. Integration evidence 复用现有 runner

新增 `pnpm run test:integration`，由 Node 脚本包装既有 Vitest/component/browser fixture，始终生成 `temp/integration-test-runs/<run-id>/` 最小文件集并保留原 exit code。证据 writer 与产品 export 使用同一 redaction primitives；测试证据不提交 Git。

## Risks / Trade-offs

- [Cordis logger message 可能含任意用户内容] → 默认不保存任意动态 args，只保留 source/severity/fingerprint 与静态安全摘要；产品有用日志由白名单事件派生。
- [1 秒 snapshot polling 自身制造 API timing] → Host 只在 panel mounted 时拉取，Browser collector 排除 devtools 自身 endpoint。
- [不同机器/浏览器时钟不一致] → 保存 offset 与 uncertainty，禁止声称精确 distributed trace。
- [CPU profile 增加运行开销] → local-only、显式动作、1–30 秒、单实例、dispose cleanup。
- [浏览器 Performance API 差异] → capability probe + partial UI，不 polyfill、不伪造 0。
- [工作树共享文件冲突] → 新 package 路径优先；`package.json`、`pnpm-lock.yaml` 与 docs index 只做局部增量，不格式化或重写无关内容。

## Migration Plan

1. 创建并 strict validate owner OpenSpec，冻结 pre-1.0 additive Remote/export shape。
2. 先实现 Host pure collectors、redaction、Remote 与 focused tests，再实现 Client collector/UI/export。
3. 增加统一 bundle、integration evidence runner、用户 README 与 package manifests。
4. 运行 focused package tests、component/integration evidence、bundle checks、workspace final gates。
5. 发布 `0.1.0-rc.1` 后，新增 optional fields 走 minor；删除/重命名/收窄走新的 OpenSpec major lifecycle。

Rollback：运行 `dsh plugin --profile web remove @yeisme/dsh-devtools` 或回退三个新包/共享 manifest 增量。无持久状态、迁移或外部资源需要清理。

## Open Questions

无。精确 RPC trace seam 作为独立后续，不阻塞 V1。
