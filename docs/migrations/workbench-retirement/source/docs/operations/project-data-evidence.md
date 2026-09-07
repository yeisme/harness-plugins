# Project data evidence entrypoints (project-data 11.6)

Every entrypoint below writes redacted six-artifact evidence under
`temp/integration-test-runs/<run-id>/` (`summary.json` with schema
`yeisme.integration_test_evidence.v1`, command, stdout, stderr, env,
redaction). Failure also writes the full set — an intentional-fail
self-test verified this (`sh -c 'exit 7'` run preserved status=failed
with redaction enabled).

## Contract / component gates

```bash
task project:replacement-migration:test            # 12.1 migration engine flow
task test:project-replacement-migration:component
task project:capabilities:test                     # 12.2 kill switches / readiness
task test:project-capabilities:component
task project:fault:test                            # 11.5 fault injection matrix
task test:project-fault:component
task project:data-ui-quality:test                  # 10.x UI quality
task test:project-data-ui:component
task test:project-data-ui:e2e                      # responsive/a11y browser evidence
```

## Integration gates (real databases)

```bash
task project:postgres:test                         # PG repository parity (needs WORKBENCH_TEST_POSTGRES_URL)
task test:project-postgres:component
task test:workflow-schema:postgres:component       # full migration ledger incl. 0037
bun run test:integration                           # SQLite four-transport conformance + runtime
```

Disposable PostgreSQL recipe (loopback only):
`initdb -U workbench -A trust`, `pg_ctl -o "-p 15432 -k <0700 dir> -c listen_addresses=127.0.0.1"`,
`WORKBENCH_TEST_POSTGRES_URL='postgres://workbench@127.0.0.1:15432/postgres?sslmode=disable'`
with `WORKBENCH_POSTGRES_TEST_TARGET=disposable`.

## Concurrency / race gates

```bash
task test:race:full                                # full suite under -race (30m per-package timeout)
task project:concurrency-scenario:test             # repeated focused scenarios (-race -count=20)
task test:project-concurrency:race
```

## Performance gates (quiet machine; PG + WORKBENCH_PROJECT_PERF_GATE=1)

```bash
task project:performance:test
task test:project-performance:evidence
```

Legs: 50k WorkItems / 64-field query capacity (no N+1, keyset deep pages,
EXPLAIN rejects Seq Scan, warm p50/p95), 200-stream watch fanout (in-memory
catalog; SQLite lock-convoy behavior is covered by the transient-window
tests instead), and the existing 10k-node canvas viewport capacity gate.

## Real Owner canary (9.7)

```bash
task test:project-automation-owner-canary:e2e      # requires EIKONA_URL/IDENTITY_URL/WORKBENCH_SOURCE_TOKEN
```

Runbook: `docs/operations/project-automation-owner-canary.md`.

## Staging soak (separate evidence tier)

```bash
task project:data:staging:compose:validate          # static topology only; no compose startup
task project:data:staging:compose:render STAGING_ENV=<untracked-nonsecret-env> # static nerdctl config only
task project:data:staging:soak:test                 # local fixed-policy and redaction checks
task test:project-data-staging-soak:component       # local evidence, not a staging soak
```

The real 24-hour staging observer, receipts, rollback action receipt contract,
and explicit no-promotion boundary are documented in
`docs/operations/project-data-staging-soak.md`. Local, fixture, compressed-TTL,
database, browser, or static compose validation does not prove actual staging
execution or production readiness.

## Known evidence discipline

- The evidence runner fails a run if tracked sources change while it
  executes — freeze the tree during full-suite gates.
- Capacity gates with wall-clock budgets are structural regression gates
  (no production SLO claim) and must run on an otherwise idle machine.
- Field-replacement migration procedure: see
  `docs/operations/project-field-replacement-migration.md`.
