# @yeisme/dsh-tool-hub-host

Host sidecar for the DSH Web **Tools** conversation tab.

- Projects a bounded catalog of skills (`ctx.skills`), native tools (`ctx.tools.schemas`), and MCP servers (from registered `mcp__*` tools and optional `pluginInventory`).
- Optionally consumes `ctx.mcpServers.list()` and projects only server/status/observed-time health facts. Commands, environment, headers, credentials, and transport configuration never cross the Remote.
- Stores user enable/disable preferences in `yeisme_tool_hub_v1`. Missing storage falls back to in-memory prefs for the process lifetime.
- Enforces disabled items through `ctx.tools.guard` when that seam exists. This does **not** enable or disable Cordis Loader plugin rows.

Wire namespace: `toolHub.list` / `toolHub.setEnabled`. The v1 wire remains `specVersion: 1.0`; observability fields are optional additive data.
