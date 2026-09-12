# @yeisme/dsh-tool-hub-host

Host sidecar for the DSH Web **Tools** conversation tab.

- Projects a bounded catalog of skills (`ctx.skills`), native tools (`ctx.tools.schemas`), and MCP servers (from registered `mcp__*` tools and optional `pluginInventory`).
- Optionally consumes `ctx.mcpServers.list()` and projects only server/status/observed-time health facts. Commands, environment, headers, credentials, and transport configuration never cross the Remote.
- Stores user enable/disable preferences in `yeisme_tool_hub_v1`. Missing storage falls back to in-memory prefs for the process lifetime.
- Enforces disabled items through `ctx.tools.guard` when that seam exists. This does **not** enable or disable Cordis Loader plugin rows.

Wire namespace: `toolHub.list` / `toolHub.setEnabled`. The v1 wire remains `specVersion: 1.0`; observability fields are optional additive data.

## 只读 Skill 说明通道

独立增量 `toolReferences.readSkill(input, signal)` 读取原 `ctx.skills.list/getDocument` 所确认的已安装文档；旧目录快照不包含正文。普通get不足以证明文件来源，缺少可选getDocument时返回reader_unavailable；owner增量见[补丁说明](../../../upstream-prs/skill-document-reader-v1/README.md)。当前仅支持 `scope: 'profile'`、默认 `filesystem` provider 和明确的文件来源，不接受路径、会话范围、runtime Skill 或任意 provider。

输入为 `itemId`（`skill:<name>`）、目录中的 `source`、`scope`，以及可选 `expectedRevision`／`cursor`。成功返回有界 Markdown 文本、opaque `resourceRef`、内容版本摘要、起始行及续行标记；超限返回 `partial` 和续读游标。每段最多256KiB／5000行，游标绑定资源与版本，每次读取重新检查原owner可见性。版本是投影正文及来源身份的摘要，不是整个安装包或原文件的校验值。

该通道不执行、启用或安装工具，不解析相对文件链接，不加载远程图片，也不读取任意磁盘路径。正文不会写入目录、日志或持久缓存。缺少owner读取能力时返回disabled，来源撤销返回denied，版本变化返回stale。客户端已在原Tools详情提供显式源码分页入口；完整引用Reader和会话范围尚未接入。

验证复用既有入口：`node packages/client/ui-mcp-inspector/scripts/run-integration-tests.mjs --host`（在仓库根运行）。
