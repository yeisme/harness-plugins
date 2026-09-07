## Why

DSH Web 每个会话已有稳定 `SessionId`、title、cwd 和 `dsh-session:<id>` mention URI，但地址栏不反映当前会话；硬刷新、书签、终端输出、Ordo/Workbench handoff 或 IM 消息都无法「一个链接 = 一个会话」直开。Codex 已有 `continue`/`resume` 心智模型，却缺少官方 URL 直开。本切片把会话身份提升为浏览器导航一等公民，且不把凭证写进 URL。

准入结论为 `split-owner`：DSH 继续拥有会话身份、持久化、`session-query` 与 `frontend-static` 静态服务；Harness Plugins 拥有 URL 编解码、History API 同步、缺失会话空态、复制/打开入口、profile patch 与 CLI 入口。用户要求的「链接即会话」能力全部保留，不降级为可选。

## What Changes

- 固化稳定 URL 契约：主形式 `/s/<sessionId>`，兼容别名 `?s=<sessionId>`；路径不编码 workspace；打开时由会话 cwd 反查并切换 workspace。
- 新增 `@yeisme/dsh-url-session` Client + Bundle：纯函数 route codec、boot 后读 URL 选会话、侧栏切换 `pushState`、`popstate` 切会话、刷新回到同一会话。
- 会话不存在或已清理时，在会话视图内展示友好空态（返回列表），不白屏、不把 boot 协议改成部分可用。
- 侧栏会话项与会话头部增加「复制会话链接」「在新标签页打开」；URL 永不含 secret；`?prompt=` 本切片不交付且规范禁止自动发送。
- P1 硬门槛：`?s=` 在未打 SPA fallback patch 的纯上游 profile 上全部可用（含 Electron `file://`）。
- P2：以 `upstream-prs/frontend-static-history-fallback/` 为过渡，给 vendored `frontend-static` 增加 `historyFallback`，使硬刷新 `/s/<id>` 不再 404；其余 405/403/带扩展名 404 语义锁定。
- P3：`dsh web --resume <session-id>` 打开会话 URL；`--no-open` 打印完整会话 URL；会话内 `/url` 打印/复制；`--agent` 增加 additive 键 `session.url`；Ordo/Workbench 只读 handoff 允许携带该 URL。
- 全部为新增 additive 面。无 **BREAKING**。不删除、不重命名既有路由、CLI flag、`--agent` 键或 `dsh-session:` mention 协议。

## Required Capability Ledger

| 能力 | 状态 | canonical owner | 本切片 | 验收证据 |
| --- | --- | --- | --- | --- |
| `/s/<id>` 与 `?s=<id>` URL 契约 | required | Harness Plugins 契约 + DSH 静态服务 | P0 固化 / P1–P2 落地 | codec 单测 + 契约文档 |
| History API 双向同步 | required | Harness Plugins Client | P1 deliver-now | 切会话/刷新/前进后退测试 |
| `?s=` 无 fallback 兼容 | required | Harness Plugins Client | P1 硬门槛 | 纯上游 profile 夹具 |
| 缺失会话友好空态 | required | Harness Plugins Client | P1 deliver-now | 空态/返回列表测试 |
| 复制链接 / 新标签打开 | required | Harness Plugins Client | P1 deliver-now | 菜单/头部 slot 测试 |
| SPA historyFallback | required | DSH `frontend-static` 上游；patch 过渡 | P2 deliver-now | 判定矩阵 + 硬刷新 |
| `dsh web --resume` 与打印 URL | required | DSH CLI；Harness Plugins 接线 | P3 deliver-now | CLI 夹具 |
| `/url` 与 `--agent session.url` | required | Harness Plugins 命令贡献 | P3 deliver-now | 输出合同测试 |
| handoff 只读携带会话 URL | required | Harness Plugins 投影；Ordo/Workbench 消费 | P3 deliver-now | descriptor 夹具 |
| `#msg-<seq>` 锚点滚动 | optional | Harness Plugins | retain-next（P4） | 后续 change |
| `@session` mention 点击内跳 | optional | Harness Plugins | retain-next（P4） | 后续 change |
| `?prompt=` 预填草稿 | optional | Harness Plugins | retain-next（P4） | 后续 change；永不自动发送 |
| OS 注册 `dsh-session:` 协议 | rejected | 操作系统 | not-requested | 保持 prompt 内 URI |

## Capabilities

### New Capabilities

- `dsh-url-session`：会话 URL 编解码、History API 与运行时会话选择双向同步、缺失会话空态、复制/打开入口，以及 `?s=` 无 patch 兼容。
- `dsh-url-session-spa-fallback`：`frontend-static` 的 `historyFallback` 行为，使 `/s/<id>` 硬刷新落到 SPA index，且不破坏既有 405/403/带扩展名 404。
- `dsh-url-session-cli`：`dsh web --resume`、启动打印会话 URL、`/url` 命令、additive `--agent session.url`，以及只读 handoff 携带会话 URL。

### Modified Capabilities

无。既有会话持久化、`session-query`、`dsh-session:` mention、侧栏所有权、`frontend-static` 的 405/403/越界语义、`dsh web --port`/`--no-open` 保持不变。新 capability 只写 `ADDED`。

## Impact

- 新 owner packages：`packages/client/ui-url-session/`、`packages/bundle/dsh-url-session/`。
- 上游过渡：`upstream-prs/frontend-static-history-fallback/`（changes.patch、new-files、apply.sh、README）；不维护长期 DSH fork，不抢 webserver 唯一 fallback 席位。
- 新稳定契约面（evolutionary-change-policy，分类 additive）：HTTP 路径 `/s/<sessionId>`、查询别名 `s`、CLI `--resume`（web 入口）、`--agent` 键 `session.url`。
- 文档：`docs/protocols/dsh-url-session.md`（URL 契约真源）、`docs/runtime/dsh-workbench.md` 交叉引用、`docs/README.md` 入口。
- 安全：URL 不含凭证；`0.0.0.0` 部署文档明示「链接即访问权」；prefill 永不自动提交。
- Rollback：从 web profile 移除 `@yeisme/dsh-url-session`；无 codec 时地址栏恢复为不反映会话；无 `historyFallback` 时 `/s/<id>` 恢复今日 404，`?s=` 仍可由书签手工粘贴但不再自动选会话。
- 完成门遵循 `docs/plugin-host-protocol.md`：插件协议测试与 codec/判定矩阵算完成；官方合入、真实 `dsh web` Playwright 为可选 host 集成，不得阻塞 P0/P1 勾选。
