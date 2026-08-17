# @yeisme/dsh-pane-protocol

Experimental, headless contracts for Yeisme DSH Pane plugins. The package owns safe plugin descriptors, event envelopes, projection state types, and typed artifact handoff. It does not own layout, React views, domain state, action admission, or persistence.

The first public surface is `0.1.0-rc.1` / `v1alpha1`. Additive fields are allowed; deleting, renaming, or repurposing an exported field requires a later OpenSpec migration.

```bash
pnpm --filter @yeisme/dsh-pane-protocol run typecheck
pnpm --filter @yeisme/dsh-pane-protocol run test
pnpm --filter @yeisme/dsh-pane-protocol run build
```

Design authority: `openspec/changes/dsh-pane-plugin-platform-v1/`.
