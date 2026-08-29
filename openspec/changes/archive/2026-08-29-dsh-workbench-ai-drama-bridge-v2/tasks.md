## 1. Contract Freeze And Compatibility Baseline

- [x] 1.1 Inventory every producer and consumer of `drama.workbench-handoff.v1` and `workbench.harness.dsh_bridge.v1alpha1`, record field/nonce/expiry/intent differences, and attach the inventory to the change evidence.
- [x] 1.2 Add the closed `dsh.workbench_ai_drama_bridge.v2` TypeScript schema and types with direction, safe refs, versions, intent enum, epoch-millisecond expiry, 32-character lowercase hexadecimal nonce, and canonical digest.
- [x] 1.3 Add stable validation and launch reason codes for malformed, expired, denied, stale, replay-conflicted, target-unavailable, legacy, and contract-mismatch outcomes.
- [x] 1.4 Preserve the existing V1 signer and validator unchanged, add an explicit legacy adapter, and document the minimum two-release compatibility window and separate removal gate.
- [x] 1.5 Add contract tests proving unknown keys, raw URLs, credentials, absolute paths, raw prompts, provider payloads, and private tool arguments are rejected or redacted.

## 2. Host Provider And Approved Launcher

- [x] 2.1 Implement V2 canonicalization, digest generation, bounded TTL, cryptographically random nonce generation, and safe projection validation in `packages/host/dsh-ai-drama-director`.
- [x] 2.2 Implement a typed `WorkbenchLaunchProvider` that resolves only the approved `workbench.agent.spatial` registry identity and never exposes target origin or authentication material to the Client.
- [x] 2.3 Implement Workbench capability probing with freshness, V2 preference, explicit legacy-only fallback, and stable disabled reasons for stale or incompatible consumers.
- [x] 2.4 Implement short-lived opaque `launchRef` issue/consume plumbing and bounded idempotency handling without creating a domain ledger or terminal-state owner.
- [x] 2.5 Emit redacted host evidence for issue, launch request, target unavailable, expiry, mismatch, replay conflict, denial, reconcile requirement, and successful consumption.
- [x] 2.6 Add host tests for all five intents, capability selection, registry rejection, expiry, nonce format, duplicate canonical requests, conflicting replay, and unknown/partial outcomes.

## 3. Client Activation And Honest Degradation

- [x] 3.1 Replace the V2 path's prompt-only completion with invocation of the host-approved launcher adapter using only the opaque `launchRef`.
- [x] 3.2 Show the selected Workbench lens, source context, contract version, expiry, and safe disabled/reconcile reason without displaying raw envelope or target URL.
- [x] 3.3 Keep the legacy V1 UI path visibly labeled `legacy_bridge`, and ensure legacy success is not reported as V2 consumption.
- [x] 3.4 Disable launch for stale capability, incompatible consumer, invalid projection, unknown result, and target unavailable; require explicit status check or newly issued handoff instead of automatic mutation retry.
- [x] 3.5 Add client tests for keyboard and command activation, five lens previews, approved-launch invocation, disabled reasons, legacy fallback, unknown result, and reduced-motion/accessibility states.

## 4. Bundle, SDK, And Conformance Fixtures

- [x] 4.1 Export the V2 schema, validator helpers, intent mapping, reason codes, and fixture version from the stable plugin SDK surface using additive names.
- [x] 4.2 Update the Director Pack bundle declaration and capability probe so installation remains honest when the launcher or Workbench V2 consumer is absent.
- [x] 4.3 Add canonical positive and negative fixtures covering intents, closed schema, refs, nonce, expiry, direction, target surface, versions, replay, permissions, capability fallback, and unavailable targets.
- [x] 4.4 Add a fixture manifest and expected-result format that Workbench can consume without depending on DSH internal implementation modules.
- [x] 4.5 Add bundle and SDK tests proving legacy and V2 exports coexist and existing consumers compile without source changes.

## 5. Workbench Consumer Handoff

- [x] 5.1 Publish a repository-local Workbench consumer handoff packet containing the V2 contract, target registry identity, intent-to-lens matrix, ingress state machine, stable reason codes, fixture version, and required server-side reauthorization behavior.
- [x] 5.2 Obtain the matching Workbench change identifier and record its owner, target package paths, dependency version, canary gate, and rollback contact in the handoff packet.
- [x] 5.3 Verify the Workbench consumer rejects raw route/URL input, refetches owner state, returns `reconcile_required` on version mismatch, and never trusts DSH-authored write permissions or terminal state.
- [x] 5.4 Record matching Workbench conformance evidence separately from DSH plugin-complete evidence; do not mark cross-repository rollout readiness until both fixture versions match.

## 6. Documentation, Migration, And Release Controls

- [x] 6.1 Update the AI Drama Director Pack design, Web Pane guidance, cookbook, bundle README, roadmap, and docs index to target Workbench `/agent` Creative Production, Review, and Evidence lenses instead of Show Control Room.
- [x] 6.2 Document the contract matrix, two-release deprecation window, capability-probe behavior, stable failure states, canary enablement, adoption metrics, and rollback to legacy/disabled modes.
- [x] 6.3 Add operator guidance for target registry configuration and diagnostics without exposing origins, credentials, nonce values, complete envelopes, or absolute paths.
- [x] 6.4 Add release checklist gates distinguishing `plugin-complete`, `consumer-conformant`, `canary-enabled`, and `cross-repository rollout-ready`.

## 7. Verification And Evidence

- [x] 7.1 Run focused host, client, SDK, bundle, fixture, typecheck, build, and bundle-contract checks and write redacted evidence under `temp/integration-test-runs/<run-id>/`.
- [x] 7.2 Run `pnpm run typecheck`, `pnpm run test`, `pnpm run build`, and `pnpm run check:bundles`, classifying any unrelated dirty-worktree failures without modifying unrelated files.
- [x] 7.3 Run `openspec validate dsh-workbench-ai-drama-bridge-v2 --strict --no-interactive` and `git diff --cached --check` before proposing archive or release.
- [x] 7.4 Exercise rollback by disabling V2 issuance, allowing existing launch refs to expire, selecting explicit legacy fallback when advertised, and confirming no owner state is rewritten or deleted.
- [x] 7.5 Review the stable contract diff for additive compatibility, document any downstream consumer action, and require a separate future change before removing either legacy contract.
