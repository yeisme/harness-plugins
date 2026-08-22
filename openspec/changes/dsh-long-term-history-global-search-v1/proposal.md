## Why

DSH 已经具备 append-only 会话日志、可选 SQLite 持久化、SQLite FTS 查询与 Web 侧栏内容搜索，但这些能力目前没有形成一个可发现、默认可长期保留、可搜索标题与标签、可跳转到命中位置、并由 Web 与 TUI 共用的产品合同。用户需要像 Codex 桌面端一样从统一入口找回过去对话，也需要像 Claude/Claude Code 一样搜索并恢复历史会话；如果继续让各客户端各自拼接列表、索引和快捷键，会产生重复状态、搜索范围不一致与无法迁移的前端私有实现。

## What Changes

- 把 DSH 会话日志明确为长期历史的 canonical state：默认不自动删除，归档只改变可见性，不删除日志；搜索索引保持为可重建的派生数据。
- 新增可搜索的会话标签合同，保留现有 `session/title`，并让标题、用户标签、工作区元信息与安全的会话正文进入统一搜索文档模型。
- 在现有 `ctx.sessionQuery`、`SessionPersistence` 和 Apiproxy 之上新增全局历史查询合同，支持全部工作区、归档状态、命中类型、时间范围、游标、片段与事件深链。
- 保留现有 `session.search` 及 Web 侧栏快速过滤；新增 `history.*` 合同作为分页、标签、归档、深链与诊断的扩展面，避免断代替换。
- 为 Web 设计全局搜索/恢复插件：侧栏搜索继续服务当前导航，命令面板与全局搜索对话框负责跨工作区和归档会话检索。
- 为 TUI 设计 renderer-neutral 历史搜索插件：通过公共 command、overlay、route、keymap 与 effect 注册消费同一 Host 合同，不读取数据库、不复制 Session 状态。
- 新增真实 CLI 入口 `dsh history search|show|tag|archive|unarchive|reindex|doctor`，并为人类摘要、`--agent`、`--json` 与长操作 `--events` 定义同源投影。
- 设计无破坏迁移：现有 JSONL/SQLite 会话日志均可继续作为 canonical provider；首次搜索增量构建持久派生索引，回滚只关闭新入口并删除/重建索引，原始会话日志保持不变。
- 不在 V1 引入跨设备云同步、向量/语义检索、自动摘要记忆、模型自动读取所有历史、自动清理或远程多租户搜索。

## Capabilities

### New Capabilities

- `dsh-durable-history-library`: 定义长期保留、归档非删除、历史完整性、索引可重建、导出与回滚边界。
- `dsh-session-labels`: 定义用户标签的数据模型、规范化、并发写入、搜索投影与客户端行为。
- `dsh-global-history-search`: 定义跨会话/工作区搜索范围、字段、排序、分页、深链、CJK/代码标识符检索、授权与诊断。
- `dsh-history-client-plugins`: 定义 Web 命令面板/全局对话框与 TUI 插件的共享体验、键位、状态机和故障降级。

### Modified Capabilities

无。现有 specs 中没有 DSH 历史库或全局搜索能力；根仓 `dsh-pane-plugin-ecosystem-v1` 只作为插件生命周期与 typed intent 的设计依赖，不在本 change 中修改其 Requirement。

## Impact

- canonical owner：DSH 上游（deepseek-ai/deepseek-harness；monorepo 自 2026-08-20 起不再维护 `client/deepseek-harness` fork，seam 经本仓 `upstream-prs/` 通道）的 Session、Persistence、Session Query、Apiproxy、Client Runtime、Web UI 与 TUI runtime/app 相关 packages。
- 设计/治理 owner：本 change `openspec/changes/dsh-long-term-history-global-search-v1/`。
- DSH 上游不建 OpenSpec；具体代码 handoff 经本仓 `upstream-prs/long-term-history-global-search/` PR staging（fork 退役后的固定通道）进入上游 `.agents/notes/proposed/architecture/2026-08-17-long-term-history-global-search.md` 与 `.agents/notes/proposed/feature/2026-08-17-history-search-client-plugins.md`，实现完成后转入对应 `implemented/` Agent Notes。
- 现有稳定面：`session.search` RPC、`SessionPersistence`、`ctx.sessionQuery`、`session/title`、Workspace archive set、Web sidebar search、TUI plugin registry。
- 新增稳定面：`history.*` RPC/CLI、标签事件/服务、查询结果与 cursor、search document provider registry、Web/TUI command ids、派生索引 schema/config。
- 兼容分类：V1 全部采用 additive/expand 方式；不删除或重命名现有命令、RPC、事件、配置键和持久化格式。
