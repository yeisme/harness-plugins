# PostgreSQL Target and Managed Migration Authority Contract

Status: development checkpoint. The local disposable contract and offline managed
authority consumer are under development; neither has formal managed-staging or
production approval. Managed external authority is intentionally absent.

## Inputs

`WORKBENCH_TEST_POSTGRES_URL` and `WORKBENCH_TEST_POSTGRES_ATTESTATION` are a
pair. Both absent permits an optional integration test to skip. Exactly one is
an error before connection. `WORKBENCH_POSTGRES_TEST_TARGET` is not accepted
as authority. The attestation is a current-UID, regular, non-symlink 0600 JSON
file bounded to 16 KiB and valid only until its UTC expiry.

The canonical v1 payload binds `contract_version`, `target_class`,
`dsn_digest`, `expires_at`, `nonce`, and `sentinel`. Unknown, duplicate, or
case-aliased keys fail closed. The DSN has one TCP host only and rejects
fragments, sockets, service/passfile/hostaddr/options, caller `search_path`,
multi-host notation and all inherited `PG*` overrides. `local_disposable` is
loopback-only. The local test authority never accepts managed targets.

Loopback disposable targets use `sslmode=disable` with
`sentinel.tls_required=false`; a contradictory TLS claim fails before a dial.
Managed/signed targets instead require `tls_required=true`, `sslmode=verify-full`,
and an absolute CA path. The offline A0 consumer exists, but managed operations
remain blocked until approved external signer/trust+revocation distribution,
credential/CA resolution, runtime integration, and live pre-connect
identity/sentinel/ACL verification have direct staging evidence.

## Pre-mutation sequence

1. Load and validate the file plus normalized DSN without dialing.
2. Open a read-only verification session.
3. Query database/OID/current user/session user, privilege, TLS/recovery and
   provisioner sentinel/effect/nonce/expiry.
4. Compare every value with the attestation.
5. Only then open the test harness or issue DDL/DML. Child processes repeat
   steps 1-4; they never receive a parent boolean.

Diagnostic children receive only a ProcessTarget-derived DSN, absolute
attestation path, exact generated schema and fixed action. They scrub inherited
`PG*`/target variables, rebuild the target, and verify the same store in a
read-only transaction before migrations, engine construction, registration,
listener startup, claiming or publishing. Actions are `schema_migration`,
`worker_readiness`, `worker_scheduler`, `worker_outbox`, and `runtime_service`;
scheduler and outbox roles cannot select another action. Untagged production
binaries deny diagnostic authority before startup.

## Offline managed authority consumer (A0, development only)

`service/internal/managedpostgresauthority/**` is an offline-only,
staging-frozen development checkpoint. It verifies exact signed trust,
revocation, target, action/cleanup approval, operation, and lookup artifacts
against a frozen root/issuer/trust anchor; binds exact host/port/DNS,
verify-full TLS, CA and sentinel/ACL/role/pool digests; separates signer roles;
and rejects canary and production. Its durable dirfd/flock ledger preserves
anti-rollback, idempotency, and unknown-operation lookup state; its artifact
loader is private-file oriented. It has no DB, network, exec, credential,
provider, or runtime integration. Development evidence
`20260903120825-a3d3f24a-6570-4a6d-be05-1a784f8715fe` records focused tests,
race, vet, and internal review only; it is not an approval receipt. Formal A0,
managed-staging, integration, and production approval are deferred to a later
explicit decision. A0 does not unlock managed operations or 4.0b.

## Managed operations

`db:migrate` managed `DRY_RUN=1` is a plan-only non-connect operation.
Managed apply, backup, restore and cleanup need future signed target, plan,
approval, and original-operation lookup/reconcile authority. Until then they
return a stable safe blocker before opening PostgreSQL or invoking PostgreSQL
tools. SQLite local commands retain their ordinary local behavior.

Managed `check` and `status` are implemented as observational operations but
also remain pre-connect blocked until an exact signed managed read target is
available. The compose-only staging bootstrap classifier is likewise not write
authority: its public CLI hard-blocks before opening PostgreSQL. Historical
restore/staging claims are therefore evidence-pending, not live acceptance.

## Managed DSN transport policy

Every managed PostgreSQL boundary accepts one TCP host only. Non-loopback
targets require `sslmode=verify-full` and an absolute `sslrootcert`. Fragment,
multi-host, socket, service, passfile, hostaddr, options, caller
`search_path`, duplicate query keys, and inherited `PG*` overrides are
rejected. This is an approved R5 compatibility tightening: historical managed
fixture DSNs without TLS fail at the database-policy boundary before later
heartbeat, role, or listener validation. Local SQLite and the separately
attested loopback test-target contract remain independent.

## Registry evidence

`temp/release/production-targets-current-v2.json` through `v7.json` are
preserved stale checkpoints and are non-authoritative. Any unversioned
`current` alias is stale too. The current immutable checkpoint is
`temp/release/production-targets-current-v8.json` (36 targets: 8 available,
5 diagnostic, 14 planned, 9 provider-blocked; `complete=false`,
`production_authorized=false`). Future source changes require a new O_EXCL
versioned artifact, which must remain `production_authorized=false`.

Managed backup/restore and staging bootstrap public writes are provider-blocked
before a runner, database dial, receipt, or mutation. Restore invariant v1
receipts are component diagnostic/integration-only and do not establish staging
or RPO/RTO acceptance.
