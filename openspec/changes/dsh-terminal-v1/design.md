## Context

Workbench Core 已支持模块注册；Terminal 作为第三个模块验证可扩展性。当前只提供安全占位，真实 PTY 流待 DSH terminal seam。

## Goals / Non-Goals

**Goals:**

- 提供 `terminalModule` Workbench 模块。
- 提供 `TerminalPanel` 占位。
- 可注册进 Workbench Core。

**Non-Goals:**

- 不实现 PTY、xterm、终端状态。
- 不拥有终端 canonical state。

## Decisions

### 1. 模块描述符独立

`terminalModule` 是纯 headless 描述符，可被组合包直接注册。

### 2. 面板只做占位

`TerminalPanel` 不创建终端、不发起连接。

## Test Specification

| 层 | 场景 | 命令 | 证据 |
| --- | --- | --- | --- |
| unit | terminalModule 注册进 Workbench Core | `pnpm --filter @yeisme/dsh-terminal run test` | Vitest result |
| build | typecheck/build | `pnpm --filter @yeisme/dsh-terminal run typecheck && pnpm --filter @yeisme/dsh-terminal run build` | exit 0 |

## Risks / Trade-offs

- [占位可能被误当可用] → README 与 UI 文案明确为 placeholder。

## Migration Plan

1. 发布 `@yeisme/dsh-terminal@0.1.0-rc.1`。
2. DSH terminal seam 就绪后接入真实 PTY 投影。
