# Project field replacement migration runbook (12.1)

This runbook operates the schema field replacement data migration:
`expand → shadow write → compare → cutover read → enable mutation`.
The migration engine lives in `service/internal/projects/service/schema_migration.go`
(backfill/compare/enable), `service/internal/projects/domain/replacement_convert.go`
(closed kind-pair conversion matrix) and `service/internal/workitems/service/schema_validation.go`
(comparing-phase shadow writes). Progress persists in `project_replacement_plans`
(migration `0037_project_schema_replacement`); values stay in the canonical typed EAV store.

## Invariants

- The source field kind never changes in place. The replacement field is added at
  plan creation (expand) and the source field is archived only at enable.
- A full compare (`ComparedRecords == TotalRecords`) with zero mismatches and zero
  needs-manual records is the only gate that allows `EnableReplacementMutation`
  to advance the active schema. Partial or unclean compares never move it.
- needs-manual records (values that cannot be converted deterministically, e.g.
  non-numeric text → number) block enable until an operator fixes the source
  values. The engine never guesses or drops values.
- Pause (`comparing → paused`) stops accepting batches and keeps progress.
  Resume (`paused → comparing`) continues from the last batch cursor. A restart
  re-reads the persisted plan and continues the same deterministic scan.
- Starting a new pass (empty cursor) resets progress counters because the data
  set may have changed since the previous pass.

## Procedure

1. **Plan (expand)**: `PlanFieldReplacement` creates the plan, appends the
   replacement field to the active schema (revision +1) and marks dependent
   views stale. The source field stays untouched.
2. **Advance to comparing**, then run `BackfillReplacementBatch` batches
   (bounded, default 50 records). Each batch converts source values through the
   closed matrix, writes them to the replacement field in the same WorkItem
   CAS transaction, re-reads the stored truth and compares. Version conflicts
   skip that record (it is retried by the next pass); they never block the batch.
   While a plan is in `comparing`, every WorkItem write to the source field
   mirrors the converted value to the replacement field in the same transaction
   (shadow write).
3. **Full coverage**: when the report shows `FullCoverage` and zero
   mismatch/needs-manual, advance `comparing → ready`.
4. **Enable mutation**: `EnableReplacementMutation` archives the source field,
   advances the schema revision, marks views stale and records the plan as
   `cutover` with `ActiveSchemaMoved: true`. This is the only path that moves
   schema authority. The 4.2-era `CutoverFieldReplacement` entry point stays
   fail-closed and never moves the active schema.

## Rollback

- Before enable: pause the plan (`comparing → paused`). Shadow writes stop; the
  replacement field and its already-written values stay readable. Nothing is
  deleted.
- After enable: set `WORKBENCH_PROJECT_CUSTOM_FIELDS_ENABLED=false` (12.2 kill
  switch). Custom-field mutations become read-only across the surface while all
  data — including the migrated replacement values — stays readable. The kill
  switch never deletes values and never touches the global `/readyz`.

## Evidence entrypoints

```bash
task project:replacement-migration:test     # component: flow + shadow write + gates
task test:project-replacement-migration:component
task test:workflow-schema:postgres:component  # migration ledger incl. 0037 on disposable PG
```
