# Agent CLI Pane V1 — 首版依赖决策（Task 0.4）

> 决策时间：2026-08-23。结论：**CLI Pane 首版零新增 runtime dependency**——复用既有 Pane/UI/virtualization 组件与 Go stdlib。

## 1. 决策矩阵

| 候选依赖 | 决策 | 理由 |
| --- | --- | --- |
| `xterm.js` / 任何终端模拟器 | **不引入**（reject） | 首版非交互、非 PTY；结构化输出由 canonical projection 渲染（design 决策 7），不是终端外观。"终端外观"不构成"终端执行能力"（proposal Non-Goals）。 |
| node-pty / go-pty / 任何 PTY binding | **不引入**（reject） | 交互式 PTY 显式拒绝（proposal）；PTY 需要 cgo/native binding，破坏 `CGO_ENABLED=0` 发布路径。未来若需要，必须另行评估并保留非 PTY fallback（design 决策 6）。 |
| Rust / native package | **不引入**（reject） | 无 parser/codec/kernel-binding 证据证明需要（design 决策 6；go-rust-implementation-defaults skill 同口径）。 |
| 任意 shell 库（shelljs/execa 类） | **不引入**（reject） | argv 数组直接经 `exec.CommandContext`；shell 字符串执行被合同禁止。 |
| 表格/虚拟化 | **复用现有** | Pane 输出走共享四态 chrome + 既有 semantic table 模式；长输出虚拟化沿用 workbench 既有实现。`@tanstack/react-table`/`@tanstack/react-virtual`/`@dnd-kit` 是 `workbench-project-data-workspaces-v1` 0.3 为其表格/看板视图引入并审计的依赖（见其 `details/dependency-audit.md`），不归属本 change；若 CLI Pane 后续需要表格视图，直接复用同一批依赖，不再新增。 |
| Go 侧 | **stdlib only** | `service/go.mod` 零变更（git diff 干净）；sidecar/argv/timeout/process group 全部 stdlib（`os/exec`、`syscall` process group、context deadline）。 |

## 2. 供应链检查

- `apps/web/package.json` / 根 `package.json` / `service/go.mod` 均无 xterm/pty/rust/shell 关键字命中（实测 grep 零命中）。
- 本 change 不带来任何新 license/supply-chain 面；既有依赖的版本/license/React19 决策见 project-data-workspaces `details/dependency-audit.md`（MIT，peer 兼容）。

## 3. 验证

- `bun install --frozen-lockfile` PASS。
- `CGO_ENABLED=0 go test ./service/... -count=1` 全量结果见 tasks.md 0.4 evidence（发布路径无 cgo 依赖）。
