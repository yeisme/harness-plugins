# @yeisme/dsh-pane-subagent

Installable DSH Web profile bundle for the Pane Subagent Monitor.

```bash
dsh plugin --profile web add @yeisme/dsh-pane-subagent
# from checkout:
dsh plugin --profile web add ./packages/bundle/pane-subagent
```

The bundle depends on `@yeisme/dsh-pane-workbench` and registers the `subagent.monitor` Pane view plus a session-header "Agents" entry.
