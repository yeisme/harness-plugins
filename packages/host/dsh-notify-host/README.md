# @yeisme/dsh-notify-host

Self-maintained DSH event notification host. It listens to DSH turn/approval/
subagent/workflow events through a typed seam and exposes a safe notification
list to the desktop workbench client.

## Development

```bash
pnpm --filter @yeisme/dsh-notify-host run typecheck
pnpm --filter @yeisme/dsh-notify-host run test
pnpm --filter @yeisme/dsh-notify-host run build
```
