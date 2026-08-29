## 1. Contract and ownership

- [ ] 1.1 Freeze `BrowserSessionProviderV1` capability/snapshot/event/action/reconcile/dispose contracts as additive experimental surfaces and document the external provider owner boundary.
- [ ] 1.2 Add validators and negative fixtures for credential/header/cookie/signed URL/absolute path/raw DOM/raw page/raw prompt/provider payload/private argument leakage.
- [ ] 1.3 Add a fake provider and capability probe proving `ctx.web`/search-only profiles do not register live BrowserSession controls.

## 2. Host and client implementation

- [ ] 2.1 Implement the DSH host adapter with exact context/session/generation/digest validation, redaction, typed dispatch and reconcile-only unknown handling.
- [ ] 2.2 Implement the bounded client reducer and Pane states for ready/loading/attention/approval/stale/offline/denied/mismatch/unknown/reconcile/search-only/unavailable.
- [ ] 2.3 Implement typed navigation, tab, manual takeover, download and screenshot/DOM evidence intents without local effect or automatic retry.
- [ ] 2.4 Implement lifecycle teardown for context/session/runtime switch, HMR and dispose; late events/results must not mutate the replacement generation.

## 3. Verification and closeout

- [ ] 3.1 Add contract/reducer/lifecycle/component tests and a fake-provider integration runner through DSH public plugin/client seams.
- [ ] 3.2 Add keyboard/a11y/responsive and security evidence under `temp/integration-test-runs/<run-id>/`.
- [ ] 3.3 Run focused package typecheck/test/build, `pnpm run check:bundles`, strict OpenSpec validation and `git diff --check` on a stable candidate.

## Promotion boundary

Completion of this change proves only the DSH consumer surface and fake-provider contract. A real BrowserSession provider, browser credentials, remote browser deployment, arbitrary web access, downloads and production promotion require a separately approved owner and evidence.
