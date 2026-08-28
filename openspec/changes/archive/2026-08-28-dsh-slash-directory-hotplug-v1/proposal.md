# dsh-slash-directory-hotplug-v1

## Why

`/session` 与 `/agent` 已可运行，但 `/mcp` `/skills` `/plugins` 只在 P0 目录占位，执行是空的。面板命令停在 pane launcher，进不了 `/`。新装一个面板必须改 command-experience 才能出现 slash，无法热插拔。

用户要求：常见 slash（`/mcp` `/skills` 等）真正可用；自定义 slash 可热插拔加入面板命令，无需改 slash 目录源码。

## What Changes

- 实时三层目录：P0 保留名 + pane 热贡献 + host `commands` 投影；冲突 fail-closed，不抛、不拆菜单。
- `/pane` 中枢：picker 可见 view 自动成为候选；`/pane explorer` 唯一前缀则 `openView`。
- launcher 命令自动投影；可选 `PaneCommandDescriptor.slash` 发布短名。
- `/mcp` `/skills` `/plugins` `/explorer` `/git` 解析到已有表面；缺插件 disabled+reason。
- `/agent` 增加 alias `agents`。
- command-experience `apply()` 绑定 live runtime，并把 inspect 命令同步到官方 `commands`。

## Boundary Decision

`split-owner`：slash 目录与热插拔属 command-experience；面板执行仍在注册该命令的 pane 插件；host 文本命令仍走官方 `commands`。不 fork DSH core，不在 client 执行 `/ordo` 业务。

## Capabilities

### New Capabilities

- `dsh-command-experience` 增量：live directory、inspect resolver、pane/host 投影。
- `pane-protocol` 增量：可选 `slash` 字段。

### Modified Capabilities

无（目标主 spec 不存在或不改已有条款；全部 ADDED）。

## Impact

- 改动：`packages/client/command-experience-core/`、`packages/host/pane-protocol/`、`packages/bundle/dsh-command-experience/`、`packages/client/ui-creator-studio/`（示例短名）、`packages/client/ui-pane-agent-context/`（skills tab metadata）、`docs/cookbook/slash-commands.md`。
- 不改官方包、不把 MCP Inspector 改写成 pane、不把数字快捷选前 N 项纳入本刀。
- 完成门：聚焦包测 + `openspec validate dsh-slash-directory-hotplug-v1 --strict --no-interactive`。不把官方 `dsh web` 当完成门。
