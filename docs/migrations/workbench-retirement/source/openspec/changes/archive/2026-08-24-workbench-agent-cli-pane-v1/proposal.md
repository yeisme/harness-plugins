## Why

Workbench 已把 Terminal 列为 Agent-first 工作区的 required retain-next Pane，但当前仍只有 `needs_contract` 占位：用户与 Agent 无法在同一 session 中安全地选择、解释、执行和观察项目 CLI，也无法把命令结果继续用于后续任务。现在需要把它推进为受控的“结构化 CLI Pane”，同时守住浏览器不执行任意 shell、Agent 不继承用户权限、所有 mutation 仍进入 `TaskService` 的边界。

## What Changes

- 新增注册式 CLI Pane：从服务端 command catalog 选择命令，以 typed argument form、scope、risk、permission、cost 和 expected-version 预检替代自由输入 shell。
- 新增 `CommandDescriptorV1`、`CommandIntentV1`、`CommandSessionProjectionV1` 与事件/输出/回执合同；浏览器和 Agent 只提交 command ID、descriptor revision、typed args 与 safe refs，不提交 executable path、cwd、env 或拼接后的 argv。
- 新增 Agent 操作路径：Agent 可基于显式 Context Pack 提议命令、请求打开或聚焦 CLI Pane、解释参数和结果，并在执行后读取结构化事件；mutation、危险动作和权限提升仍必须通过 canonical proposal/gate/用户决策。
- 新增获批 Host Runtime adapter 的 split-owner 执行边界：首版使用 pure-Go、`CGO_ENABLED=0` 兼容的独立进程执行适配器，以 argv 数组调用 allowlisted CLI，不启用 shell expansion 或交互式 PTY。
- 统一 CLI 输出投影：默认 human summary、`--agent`、`--json`、`--events`、`--explain` 由同一 canonical projection 生成；Pane 不解析 human output 判定成功，stdout/stderr、TraceEvent、audit 和 artifact 分层保存。
- 细化 Pane 管理：同一 session/runtime/scope 复用一个 CLI Pane，Pane 内维护有界 run history；重复打开聚焦已有实例，长输出虚拟化并落为脱敏 artifact，tablet/mobile 退化为单 Sheet。
- 显式拒绝 `bash -c`、任意 shell 字符串、任意 cwd/env/path、浏览器直接 spawn、Agent 自动批准高风险 mutation、未审计的交互式 PTY 和自动重试 `unknown_accept`。

## Capabilities

### New Capabilities

- `workbench-agent-cli-pane`: CLI Pane 的 catalog、typed argument form、session/run history、输出视图、Agent 协作、Pane 管理、响应式和无障碍行为。
- `workbench-cli-command-runtime`: command descriptor/intent、Host Runtime adapter、TaskService 路由、状态机、事件、输出、artifact、receipt、权限、审计、取消与 reconcile 合同。

### Modified Capabilities

- `workbench-agent-pane-composition`: 将 Terminal 从无合同的 disabled catalog entry 推进为合同就绪后可注册、可复用、可恢复的 first-party CLI Pane，并保持 shared chrome、四态内容和有界布局规则。

## Impact

- Web：`apps/web` 的 Agent Pane registry/catalog/dock、Pane command palette、CLI Pane renderer、Agent presentation intent 与响应式 Sheet。
- SDK/合同：`packages/task-sdk`、Protobuf、JSON Schema、HTTP/SSE、gRPC、JSON-RPC 的 command catalog/session/run 方法与类型。
- 服务：`service/internal/core`、`registry`、application service、GORM repository、Host Runtime adapter、redaction、audit、metrics、health/diagnostics；所有 command mutation 仍由 `TaskService` 统一执行。
- CLI：现有 Workbench CLI 逐步补齐共享 projection 和 `--events`；既有仅复制 shell 字符串的 fallback 不作为 Pane 执行入口。
- 测试：descriptor/schema、permission/gate/idempotency、argv 无 shell、cancel/reconcile race、四 transport parity、输出 mode golden、Pane keyboard/a11y、Playwright 和脱敏 integration evidence。
- 不引入 cgo、Rust、Electron/Tauri、浏览器 token、owner 私有路径或第二套执行状态机。
