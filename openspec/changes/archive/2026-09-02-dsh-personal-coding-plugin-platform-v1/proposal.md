## Why

harness-plugins 已有大量 Web/TUI 命令、文件、Git、终端和开发工具插件，但当前缺少一个面向个人编码黄金路径的默认组合，也缺少可同时被 Web 与零 React TUI 消费的通用“结构化视图 + typed action”插件合同。继续让每个插件自定义 UI 或手工组合 profile，会放大故障面并造成命令、状态和审批语义漂移。

## What Changes

- 新增 `@yeisme/dsh-personal-coding-base` 安装 bundle，组合命令体验、文件/Git/终端/诊断 host 能力和内部插件 SDK；领域能力继续通过显式 packs 安装，不默认全量启用。
- 扩展内部稳定 `dsh-plugin-contracts`，新增 additive `DshPluginSurfaceContributionV1`、结构化 view projection、typed action descriptor/receipt、health 与 compatibility probe。
- 冻结宿主渲染 view kinds：`status`、`list`、`table`、`detail`、`timeline`、`diff`；插件只返回有界 safe projection，不返回 ANSI、任意终端绘制、DOM/React 组件、HTML、cookie、token 或 raw provider payload。
- typed action 必须声明 owner、effect、risk、preview policy、action ref 和 revision fence；mutation/danger 继续 preview-before-mutate，客户端不得执行 owner 返回的 shell command string。
- 新增插件故障隔离：缺 seam、版本不兼容、启动/刷新失败或 projection 无效时，只禁用对应 contribution，显示原因、fix 和 doctor receipt，基础编码包继续工作。
- 冻结 Web/TUI parity fixture：canonical command/view/action id、owner、effect、risk、schema version 和 unavailable reason 必须一致；布局、键位和具体 renderer 可以不同。
- 个人编码 catalog 继续是构建时静态清单，不新增 marketplace、远程 registry、遥测或 public semver 承诺。
- `/ordo run launch` 继续属于现有 `/ordo` command directory；本 change 只补 capability/contract parity，不复制 Ordo run 真相或 TUI preview-CAS。
- 现有 `registerCommandConsole`、bundle patch、SDK exports 与 Web 插件保持兼容；新 seam 和字段全部 additive。

## Capabilities

### New Capabilities

- `dsh-personal-coding-base-pack`: 基础编码 bundle、默认能力、显式 packs 与静态 catalog 组合。
- `dsh-structured-plugin-surface`: 宿主渲染 view、typed action、safe projection 和兼容 probe。
- `dsh-personal-coding-contract-parity`: Web/TUI 命令、状态、插件 schema 与 fixture 一致性。
- `dsh-plugin-health-degradation`: 单插件隔离、健康投影、修复动作和 doctor receipt。

### Modified Capabilities

- `dsh-plugin-contracts`: 在保留所有现有 export/probe 的前提下增加结构化插件 surface V1。
- `dsh-command-experience`: 保留 `/ordo` 目录并为 durable `run launch` capability 增加可用/不可用一致投影。

## Impact

- 主要 owner：`packages/sdk/dsh-plugin-contracts`、`packages/bundle`、`packages/catalog/dsh-plugin-catalog`、`packages/tool/dsh-plugin-toolchain`、`packages/example/dsh-plugin-example` 和 command-experience packages。
- TUI consumer：`client/dsh-tui/openspec/changes/dsh-tui-personal-coding-core-v1/`。
- Ordo owner：`agent/ordo/openspec/changes/ordo-dsh-foreground-handoff-v1/`。
- Web 首版仅增加合同、fixture、probe 和降级验证，不承诺新视觉工作台。
