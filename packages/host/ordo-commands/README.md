# @yeisme/dsh-host-ordo-commands

English | [中文](README.zh.md)

This Host plugin registers one read-only `/ordo` command when the existing `dsh-commands` runtime and `dsh-host-ordo-agent-ops` snapshot gateway are mounted. It reads only `ordoAgentOps.snapshot()`; it does not keep a copy of Ordo state or create an Ordo service.

The accepted syntax is `/ordo`, `/ordo help`, `/ordo status [safe-ref]`, `/ordo preview <safe-ref>`, and `/ordo capacity`. References are a narrow opaque token grammar: blank values, `undefined`, whitespace, paths, URL forms, schemes, absolute paths, control characters, and extra arguments are rejected. Every accepted result uses four lines: `Conclusion`, `Freshness / status`, `Safe refs / summary`, and `Next action`.

`status` and `capacity` expose facts only from readable `ready` or `stale` snapshots. Missing owner context, owner source, or a safe projection produces its existing fail-closed state and never emits run or capacity facts. `preview` returns `needs_contract` until an already-owned composition-preview source is mounted; this package does not create one.

## Model Experience

None, as `/ordo` bypasses the model: it registers no prompts or tools and writes no domain event, so the existing `dsh-commands` runtime records only its normal `command/run` and `command/done` lifecycle pair.

#### KV Cache effect

None; the command contributes no model input.

## Known Limitations and Deferred Work

- No composition-preview source is mounted in this package, so `/ordo preview <safe-ref>` remains `needs_contract`.
- The command does not qualify, reconcile, approve, run, cancel, redispatch, reserve capacity, parse tickets, launch a process, or call a provider.
- The snapshot gateway remains responsible for tenant/workspace authorization and for redacting the owner-authored projection.
