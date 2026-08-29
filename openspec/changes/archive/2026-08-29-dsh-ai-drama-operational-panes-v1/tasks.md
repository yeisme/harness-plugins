## 1. Shared Creator Studio runtime

- [x] 1.1 Add the additive `CreatorStudioRuntimeV1` public contract, exports, and compatibility tests without changing the existing Creator remote.
- [x] 1.2 Provide exactly one Creator Studio runtime from the Creator Client, including snapshot subscription, explicit refresh, pagination, artifact resolve, owner action dispatch, approval decision, receipts, and exact disposal.
- [x] 1.3 Add the legacy Director fallback adapter as read-only, explicit-refresh-only behavior and prove it does not create a second poller or retry owner mutations.

## 2. Operational Director panes

- [x] 2.1 Extract side-effect-free shared projection components for resources, actions, reviews, runs, receipts, freshness, and reconcile state.
- [x] 2.2 Implement the Context, Story, Visual, and Audio panes from the shared safe projection, including artifact intents and owner-authored actions.
- [x] 2.3 Implement the Run and Review panes with progress, attention, evidence refs, previews, compare, approvals, repair actions, and owner receipts.
- [x] 2.4 Reset selection, drafts, temporary forms, and old receipts whenever context revision, runtime generation, or snapshot identity changes; disable mutation for stale, partial, gap, unknown, and offline states.

## 3. Compatibility, evidence, and closeout

- [x] 3.1 Update probes, runtime composition, package exports, dependencies, and documentation while preserving all existing Director commands, pane kinds, preset behavior, and Bridge V2.
- [x] 3.2 Add contract, state, component, responsive, keyboard, lifecycle, HMR, compatibility, and honest-degradation tests for the six operational panes.
- [x] 3.3 Run focused package typecheck, test, and build gates and write redacted integration evidence for Story to Visual or Audio to Run to Review.
- [x] 3.4 Run strict OpenSpec validation and applicable repository gates, update the roadmap and gap ledger, and record any remaining external-owner or human-gate items.
