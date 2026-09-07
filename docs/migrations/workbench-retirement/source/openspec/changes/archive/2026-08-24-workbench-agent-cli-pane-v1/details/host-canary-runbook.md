# CLI Host canary binding runbook

> Scope: Slice C read-only integration/canary validation only. These bindings do not authorize browser process execution and do not enable production.

## Closed canary set

| Binding ref | Binary | Fixed argv contract | Canonical command |
| --- | --- | --- | --- |
| `binding:workbench_config_check:v1` | `workbench-config-check` | `--environment <integration|canary> --json` | `workbench.config.validate` |
| `binding:workbench_diagnostics_runtime_validate:v1` | `workbench-diagnostics` | `runtime validate --environment <integration|canary> --report temp/cli-host-canary/runtime-readiness.json --json` | `workbench.diagnostics.runtime.validate` |
| `binding:workbench_readiness:v1` | `workbench-readiness` | `--environment <integration|canary> --evidence-root temp/integration-test-runs --max-age 24h --json` | `workbench.readiness.report` |

The Host computes each executable SHA-256 revision from the installed regular file, includes that digest in the private binding digest, and rechecks the executable before readiness and every dispatch. The output projection digest binds the command ID, JSON protocol, and output contract version. A supplied catalog digest must exactly match the computed catalog.

All three bindings are read-only, carry no typed dynamic arguments or protected values, run with one process/concurrent run, bounded CPU/memory/time/output/events, and a loopback-only network ceiling. The workspace mount is one server-private opaque ref; no executable, argv, environment value, or path enters the public descriptor.

## Enable in a non-production canary

Install `workbench-cli-host` and the three binaries in a private executable directory. Set:

```text
WORKBENCH_CLI_HOST_CANARY_ENABLED=true
WORKBENCH_CLI_HOST_CANARY_ENVIRONMENT=integration
WORKBENCH_CLI_HOST_CANARY_BIN_DIR=<private absolute binary directory>
WORKBENCH_CLI_HOST_CANARY_WORKSPACE_DIRECTORY=<private absolute workspace root>
WORKBENCH_CLI_HOST_CANARY_WORKSPACE_MOUNT_REF=mount:workspace:canary
```

`WORKBENCH_CLI_HOST_CANARY_ENVIRONMENT` accepts only `integration` or `canary`. The binary directory defaults to the directory containing `workbench-cli-host`; the workspace directory is required. The binding catalog digest is computed automatically when its environment value is absent. If an explicit `WORKBENCH_CLI_HOST_BINDING_CATALOG_DIGEST` or command-line digest differs, startup fails closed.

## Independent capability flags

All flags are read by server processes; no Vite/browser environment value is authority.

| Capability | Server flag | Default | Effect |
| --- | --- | --- | --- |
| CLI Pane transports | `WORKBENCH_CLI_PANE_ENABLED` | `true` | Registers or removes the Workbench HTTP, gRPC, and JSON-RPC CLI projection. |
| Operation commands | `WORKBENCH_CLI_OPERATION_COMMANDS_ENABLED` | `true` | When false, the Pane may retain bounded history/result reads, but descriptors are resealed as `needs_contract` and no new intent can execute. |
| Agent delegated read | `WORKBENCH_CLI_AGENT_DELEGATED_READ_ENABLED` | `false` | Allows only canonical durable approved grants to enter atomic admission. The flag cannot issue or approve a grant. |
| Host canary | `WORKBENCH_CLI_HOST_CANARY_ENABLED` | `false` | Enables only the separate read-only Host canary process after its environment and binary pins validate. |

The four controls are intentionally not aliases. In particular, turning off the Host canary does not remove Operation-backed descriptors or the CLI Pane, and turning on Agent delegated read without a canonical approved grant still yields `delegation_required`.

Local loopback smoke for this isolation is `TestRuntimeHostCanaryOffKeepsOperationPaneAndTaskReconcile`: with `WORKBENCH_CLI_HOST_CANARY_ENABLED` unset and `VITE_WORKBENCH_CLI_HOST_CANARY_ENABLED=true`, the Operation catalog stays ready, Host commands do not become ready, and an already-submitted Task still has a live `/v1alpha1/tasks/{id}/reconcile` route. That smoke is not an internal-tenant staging observation.

## Kill switch and rollback

1. Set `WORKBENCH_CLI_HOST_CANARY_ENABLED=false` (the default) and send SIGTERM to the sidecar.
2. The sidecar stops new dispatch, drains owned runs, and persists terminal/unknown receipts before exit.
3. Restart with the existing receipt directory and pinned catalog digest. The provider remains lookup/reconcile-readable but readiness is degraded because `UnavailableRunner` owns no process capability.
4. Operation-backed CLI commands remain independent of the Host canary flag.

For a read-only rollback that preserves operator visibility, keep `WORKBENCH_CLI_PANE_ENABLED=true`, set `WORKBENCH_CLI_OPERATION_COMMANDS_ENABLED=false`, `WORKBENCH_CLI_AGENT_DELEGATED_READ_ENABLED=false`, and `WORKBENCH_CLI_HOST_CANARY_ENABLED=false`. Existing canonical Tasks and durable Host receipts remain query/reconcile truth; do not delete the Workbench database or Host receipt journal.

Do not delete receipt journals during rollback. Do not retry `unknown_accept`; reconcile by the original request/session identity.

## Real-binary verification

Build the three binaries into one temporary directory, then run:

```text
WORKBENCH_CLI_HOST_CANARY_SYSTEM_BIN_DIR=<built binary directory> \
CGO_ENABLED=0 go test ./service/internal/clihost \
  -run '^TestCanarySystemExecutesRealStructuredBinaries$' -count=1 -v
```

The test dispatches each real binary through the `ProcessRunner` and `Runtime`, then checks typed protocol frames, per-frame content digests, terminal output cursor, result ref, canonical command/status, and the durable Host receipt. A valid declared failure is acceptable for missing integration fixtures; human output or output-contract fallback is not.
