# @yeisme/dsh-client-ui-desktop-workbench

Self-maintained DSH desktop workbench client. This package composes the
session sidebar and Workbench Core tab shell for the desktop workbench. The
exported `ConversationManager` is a dense owner-driven surface for organization
filters, rules, receipt-gated batch actions, administrator purge and undo.

## Development

```bash
pnpm --filter @yeisme/dsh-client-ui-desktop-workbench run typecheck
pnpm --filter @yeisme/dsh-client-ui-desktop-workbench run test
pnpm --filter @yeisme/dsh-client-ui-desktop-workbench run build
```
