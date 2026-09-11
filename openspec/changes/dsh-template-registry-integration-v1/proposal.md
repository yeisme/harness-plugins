## Why

模板仓库（`data/yeisme-prompt-templates` + `backend-server/template-registry`）已有 13 类约 40 个可编译 solution 与一个本地 stdio MCP 消费面，但 DSH 侧没有任何 pane 消费它——`packages/**` 对 `template-registry`/`promptrepo` 零命中。用户已明确 DSH plugin 项目将承接各种能力，并复用模板仓库作为「能力弹药库」。本 change 交付该集成的前两层：消费基座 + 两个通用 pane，让每个模板无需新增 UI 即可被发现、引导填写、编译导出。3D 模板类别 spec 已在 prompt-templates 仓立项（`official-3d-model-templates-beta-v1`），将成为本集成的首批内容之一。

## What Changes

- 新增 `dsh-template-registry` 三包插件（host + client + bundle）：host 侧经 template-registry 本地 stdio MCP 或 promptrepo 只读 catalog adapter 消费，注册 typed RPC 与 zod-schema session projection；浏览器只收 safe projection（exact ref、digest、有界摘要、rights、action）。
- 新增模板目录 pane：按类别/capability/tag 浏览与搜索，inspect contract，rights 允许的 preview 经 owner 批准的 preview DTO 返回，fail-closed。
- 新增引导编译 pane：由 contract 输入 schema 生成确认表单，关键创作选择必须显式确认，编译期 `provider_calls=0`，导出提示包交用户或下游 owner。
- 遵守 `docs/workflows/mcp-client-without-cli.md`：本机未安装 template-registry CLI 时，pane 通过 MCP `tools/list` + `inputSchema` 取得动作参数与恢复合同；CLI help/doctor 仅是已安装时的可选增强。
- 全部入口 capability probe 先行：seam 缺失或未连接时禁用 + 原因，诚实降级，不死按钮。

## Capabilities

### New Capabilities

- `dsh-template-registry-integration`：模板目录发现、contract 驱动的引导编译、提示包导出与无 CLI 恢复。

### Modified Capabilities

无。已有 pane、引用和 owner 合同保持原义。

## Impact

拟用路径：`packages/host/template-registry`、`packages/client/ui-template-registry`、`packages/bundle/dsh-template-registry`；脚手架生成前先核对 `ui-pane-domain`、`dsh-tool-hub` 与 catalog 包的可复用性。不创建独立服务、第二主壳或 Workbench 依赖；不存模板正文到浏览器侧 store；不执行 provider、不产生费用。recipe 运行器、项目画布节点衔接与垂直工作台（3D/图像/视频等）的模板驱动改造为后续 change。文档修改、构建发布与远端部署分别报告。
