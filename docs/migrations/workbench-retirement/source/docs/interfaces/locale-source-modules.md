# Locale source modules

This document describes the source/build boundary for Workbench locale copy. The
authoring source is Chinese-first, deterministic, and domain-owned. Runtime
locale loading remains the existing LocaleService bundle contract; the browser
does not request locale namespaces separately.

## Ownership

`api/locale/source/manifest.json` is the ownership manifest. Its production
namespaces are:

`agent`, `app`, `board`, `common`, `connections`, `eikona`, `gateway`,
`localization`, `orbit`, `openDesign`, `overview`, `panel`, `pinax`, `shell`, `studio`,
`task`, `team`, `workflow`, and `workspace`.

`locale` and `status` remain compatibility namespaces. A fragment owner is
derived from its path, for example:

```text
api/locale/source/zh-CN/studio/activity.json -> studio
api/locale/source/en-US/workflow/run.json    -> workflow
```

Each catalog key must have exactly one owner per locale. The policy entry in
`api/locale/source/catalog-policy.json` is the contract for placeholders,
criticality, protected status, override policy, and maximum length.

`zh-CN` is required for every policy key. `en-US` is authored progressively;
missing English entries use the registered Chinese fallback and must never
render a raw message key. Owner names, IDs, paths, commands, receipts, safe
refs, server summaries, and user-authored input remain dynamic/raw values when
the UI contract requires them to remain opaque.

## Composer and generated assets

From the repository root:

```bash
bun run compose:i18n       # compose fragments and rewrite generated assets
bun scripts/compose-i18n.ts --check
bun run check:i18n
bun test scripts/compose-i18n.test.ts
```

The committed generated outputs are:

- `api/locale/catalog.json`
- `service/internal/locale/bundles/zh-CN.json`
- `service/internal/locale/bundles/en-US.json`
- `apps/web/src/i18n/messages.generated.ts`
- `apps/web/src/i18n/bootstrap.generated.ts`

Review source fragments and policy first, then inspect the generated key/value
diff and digest. Do not edit generated files directly. `--check` compares every
generated output byte-for-byte and `check:i18n` additionally checks bootstrap
size, facade wiring, protected policy, source ownership, and stable-value
formatting. A digest change is expected only when a key/value or policy change
is intentional.

## Adding a key

1. Choose the existing feature-owner namespace; create a nested fragment only
   when ownership or policy review benefits from the split.
2. Add the key to both locale fragments and add its policy entry. Keep
   placeholders identical across locales.
3. Use the composed `t(...)` contract or the feature helper's Chinese-first
   fallback. Keep technical identifiers and server-authored values outside the
   translation boundary.
4. Update the focused component test to assert the rendered accessible name or
   visible state, including the `zh-CN` fallback path when the component is
   rendered without a provider.
5. Run the composer tests, `--check`, `check:i18n`, the focused test, and the
   necessary typecheck/build gate. Record the slice, key/protected counts, and
   evidence boundary in the relevant OpenSpec `tasks.md`.

## Intentional English fallback

An English source value may be omitted when the feature is not yet fully
translated. The omission must be deliberate and remain within the composed
catalog contract: Chinese is still present, placeholders remain governed by
policy, and the runtime fallback order stays `en-US` bundle -> `zh-CN` bundle
-> bootstrap/default copy. Protected status, permission, security, error, and
destructive-operation copy must retain its policy classification; fallback is
not permission to weaken a protected overlay.

## Rollback and evidence boundary

Rollback is a reversible source/build rollback: restore the prior source
fragments, policy, generated bootstrap contract, compatibility copy, and
committed generated outputs. No database, overlay, API, or protocol migration
is required. G4 is now proven, so the old
`apps/web/src/i18n/bootstrap.ts` compatibility facade has been removed; a
rollback restores it from the prior source/build snapshot rather than
reintroducing a runtime namespace request.

Local composer, typecheck, focused tests, and clean-copy reproducibility prove
source/build integrity only. They do not prove browser/E2E, Provider/Owner,
PostgreSQL, security review, staging, canary, promotion, or production
acceptance; those evidence tiers must remain separately recorded.
