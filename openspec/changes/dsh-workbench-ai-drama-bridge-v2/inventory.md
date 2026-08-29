# Legacy bridge contract inventory (task 1.1)

Producers and consumers of the two pre-V2 contracts, with the field / nonce /
expiry / intent / target differences that make them non-interoperable. All
paths verified 2026-08-29.

## `drama.workbench-handoff.v1` (DSH side)

| Role | Location | Notes |
| --- | --- | --- |
| Signer/validator (producer) | `packages/host/dsh-ai-drama-director/src/handoff.ts` | FNV-1a digest over `\|`-joined fields; free-form safe-ref nonce; unbounded `expiresAt` ms |
| Contract types | `packages/host/dsh-ai-drama-director/src/contracts.ts` | closed key set: schema, contextRef, artifactRef?, receiptRef?, targetSurface, presentationIntent, expiresAt, nonce |
| Consumer gate | `packages/client/ui-ai-drama-director/src/client/handoff-gate.ts` | allowlist + session nonce dedup; routes intent to in-repo panes, never to Workbench |
| Client invocation | `packages/client/ui-ai-drama-director/src/client/index.ts` (`drama.handoff`) | prompt-only completion: "Handoff issued; open Workbench to continue." |
| Tests | `packages/host/dsh-ai-drama-director/tests/{contracts,host,client}.spec.ts`, `packages/client/ui-ai-drama-director/tests/handoff-gate.spec.ts` | |

Fields: `contextRef` (no workspace/project/show split), `targetSurface` free
string (callers pass `"workbench"`), intent enum shared with V2, `expiresAt`
unbounded epoch-ms, `nonce` any safe ref (e.g. `nonce-1`), digest = 32-bit
FNV-1a base-36 (integrity only).

## `workbench.harness.dsh_bridge.v1alpha1` (Workbench side)

| Role | Location | Notes |
| --- | --- | --- |
| Types + closed key set | `client/yeisme-workbench/packages/task-sdk/src/harness/types.ts` (`contractVersion: "workbench.harness.dsh_bridge.v1alpha1"`), `validate.ts` (`dshDeepLinkKeys`) | targetRef, sourceSurfaceId, resourceRef, resourceVersion?, mode, embedded, handoffNonce? |
| TS validation | `client/yeisme-workbench/packages/task-sdk/src/harness/validate.ts` | `handoffNoncePattern = /^[a-f0-9]{32}$/` |
| Go ingress validation | `client/yeisme-workbench/service/internal/showcontrol/handoff.go` | **different nonce pattern** `^[A-Za-z0-9][A-Za-z0-9._~-]{7,127}$` |
| Web ingress | `client/yeisme-workbench/apps/web/src/workbench/agent/spatial/spatial-ingress.ts` | |
| Owner specs | `client/yeisme-workbench/openspec/specs/workbench-dsh-plugin-lane/spec.md`, `workbench-ai-drama-show-navigation/spec.md` | |

## Concrete incompatibilities V2 resolves

1. **Identity**: different `contractVersion` strings; neither side validates
   the other's envelope.
2. **Nonce**: DSH V1 accepts any safe ref; Workbench TS demands 32 lowercase
   hex; Workbench Go accepts 8–127 mixed-case ref chars — three disjoint
   formats. V2 freezes `^[0-9a-f]{32}$` everywhere.
3. **Expiry**: V1 unbounded epoch-ms, no TTL bounds; alpha has no expiry at
   all. V2 freezes bounded epoch-ms TTL (30s–15min).
4. **Refs**: V1 has one `contextRef`; alpha splits `targetRef`/`resourceRef`
   without workspace/project/show anchoring. V2 carries the full safe ref
   tuple plus `resourceVersion` + `contextRevision`.
5. **Direction/target**: V1 `targetSurface` free string (no direction); alpha
   `mode`/`embedded` conflate presentation with transport. V2 fixes
   `direction: dsh_to_workbench` and `targetSurfaceId: workbench.agent.spatial`
   with a closed intent→lens enum.
6. **Digest**: V1 FNV-1a 32-bit is collision-prone; alpha has none. V2 uses
   canonical schema-ordered SHA-256.
7. **Activation**: V1 path ends in a prompt; alpha deep link is composed by
   the caller. V2 activation goes through a host-approved opaque `launchRef`.

## Retired target

`shouldExpandToShowControlRoom()` (host panes.ts) already pins `false`; V2
docs target the `/agent` Spatial Creative Production / Review / Evidence
lenses only.
