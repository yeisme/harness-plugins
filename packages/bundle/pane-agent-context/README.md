# @yeisme/dsh-pane-agent-context

Installable DSH Web profile bundle for Agent Context (Plan / Skills / Invocations) and a Terminal probe pane.

```bash
dsh plugin --profile web add @yeisme/dsh-pane-agent-context
# from checkout:
dsh plugin --profile web add ./packages/bundle/pane-agent-context
```

The bundle depends on `@yeisme/dsh-pane-workbench`. Subagent stays in `@yeisme/dsh-pane-subagent`. Terminal does not unpark xterm; missing `TerminalInteractiveCapabilityV1` is `contract_mismatch`.
