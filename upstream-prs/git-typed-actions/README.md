# git-typed-actions

Status: proposed contract. Typed Git action host for stage/unstage/commit/diff/worktree.

Arbitrary `git` argv from the browser is rejected. `worktree.remove` must not
release an Ordo writer lease.

## Proposed capability

`GitTypedActionsCapabilityV1`

Closed action ids:

- `status`
- `diff`
- `stage`
- `unstage`
- `commit`
- `worktree.create`
- `worktree.remove`

`commit` / `worktree.create` / `worktree.remove` require preview digest,
expected revision, idempotency key, and receipt. Timeout is not success.

```bash
bash apply.sh /path/to/deepseek-harness
```
