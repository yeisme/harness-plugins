# @yeisme/dsh-selection-annotation

Installable DSH Web bundle for Selection & Annotation Agent Interaction V1.

```
dsh plugin --profile web add @yeisme/dsh-selection-annotation
# or from this checkout
dsh plugin --profile web add ./packages/bundle/dsh-selection-annotation
```

One profile row (`cordis.patch.yml`) grafts the selection toolbar and compact
composer overlay from `@yeisme/dsh-client-ui-selection-annotation` onto the
conversation DOM. Kill-switch:
`localStorage['dsh-selection-annotation'] = 'off'`.

Owners stay untouched: conversation runtime, model/permission state, file
writes (version-fenced through File Host) and screenshot bytes belong to their
owners; this bundle only contributes interaction surfaces and typed intents.

See `openspec/changes/dsh-selection-agent-review-v1/` for the product spec.
