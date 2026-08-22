# @yeisme/dsh-client-ui-pane-subagent

Experimental Subagent Monitor for the Yeisme Pane Workbench. It registers a `subagent.monitor` Pane view and a session-header "Agents" entry that opens the view without replacing the main conversation.

The view consumes only DSH-owned `ctx.sessions.list` snapshots and uses `ctx.sessions.openSubagent()` only for explicit "Open in Main". It does not create a second subagent tree or scheduler.

## Controls

- Refresh: reloads the current session's direct-child catalog.
- Peek transcript: reads a bounded recent history through `subagents.history`.
- Send: queues a follow-up to a continuable child through `subagents.prompt`.
- Stop: interrupts a running continuable child through `subagents.interrupt`.

The bounded Parallel steering formatter remains available for the future main
composer integration, but the Pane does not expose a toggle until a real
submit-time composer seam is mounted. This avoids presenting a local checkbox
that cannot affect the next main-session prompt.
