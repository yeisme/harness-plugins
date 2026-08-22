# fs-watch

Status: proposed contract. DSH `ctx.fs` watcher / file-domain session projection.

File Pane must not claim realtime updates until this series merges into
`deepseek-ai/deepseek-harness`. No client polling fallback.

## Proposed capability

`FileWatchCapabilityV1`

Host publishes:

- `capabilities` includes `FileWatchCapabilityV1`
- `watch(parentRef?: string): FileWatchHandle`
- events: `{ cursor, op: 'created'|'changed'|'deleted'|'renamed', entryRef, parentRef?, occurredAt }`
- refs are opaque; absolute paths, `file://`, tokens, and credentials are rejected

Client:

- first open: snapshot via existing `listEntries`
- afterwards: push events only
- gap / expired cursor → `reconcile_required`
- missing capability → on-demand list, freshness `unknown`/`contract_mismatch`, never `live`

## Files (proposed; apply when a DSH staging worktree exists)

```
packages/host/fs/src/watch.ts
packages/host/fs/tests/watch.spec.ts
```

See `new-files/` for the typed contract the upstream PR should implement.
`changes.patch` is empty until a staging worktree produces a real diff.

```bash
bash apply.sh /path/to/deepseek-harness
```

Verification after apply (in the DSH checkout): host fs watch unit tests plus a
redacted event fixture with no absolute path.
