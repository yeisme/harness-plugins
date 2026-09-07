# workbench-command-journey-discovery-v1

## Why

The root contract `cross-project-command-discovery-and-journeys-v1` froze the shared discovery schemas (`yeisme.command_catalog.v1`, `yeisme.command_suggestion.v1`, `yeisme.journey_descriptor.v1` in root `docs/contracts/discovery/`), owner-side projections (Eikona/Scaena reference wave), and the Gateway read-only aggregation tools (`gateway_capabilities_search`, `gateway_journeys_suggest`, archived 2026-09-03). Users still have no single surface to answer "which owner can do X, what does the journey look like, and what is the exact runnable command" — today that means reading per-owner human help by hand.

Workbench is the designated Wave 5 consumer. The handoff (`handoffs/adoption-and-workbench.md`) restricts the first version to a read-only discovery surface over typed projections, with honest stale/degraded/policy-hidden status.

## What Changes

- Add a read-only "capability & journey" discovery surface (search results list + journey detail read-only panel) consuming owner typed projections or Gateway discovery projections — never raw `--help` text or spawned CLI processes.
- Render journey steps with owner, prerequisite, gate, effect class, approval requirement, and availability; render copyable exact commands or owner-approved action surface links.
- Surface honest availability states: `stale`, `degraded` (namespace-scoped owner failure), `policy-hidden`, `unavailable` — never silently dropping or masking them.
- Enforce consumer boundaries: no second command registry, no prompt bodies, no business DAG copies, no owner operation state; no bypassing Gateway policy to reach hidden backends.
- Suggestions are display-only: copying a suggested command is the only "action"; the Workbench never executes suggestions or journeys itself.

## Impact

- New consumer capability spec `workbench-command-journey-discovery` (ADDED requirements).
- Touches the Workbench server-side projection client (typed fetch of owner/Gateway projections), a read-only UI surface, and conformance fixtures consumption from root `docs/contracts/discovery/`.
- No owner repo changes; no Gateway changes; no new network surface beyond existing approved consumers.
