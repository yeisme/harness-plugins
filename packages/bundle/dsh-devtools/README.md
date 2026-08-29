# @yeisme/dsh-devtools

Local-first development diagnostics for the DSH Web profile. The bundle adds safe terminal logs on stderr, Host and browser performance metrics, a bottom DevTools panel, deterministic findings, explicit local CPU profiles, and a redacted JSON export. It does not write logs to disk, upload telemetry, capture heap snapshots, or expose prompts, tool arguments/results, provider payloads, credentials, absolute paths, or complete stacks.

## Install and run

```bash
dsh plugin --profile web add @yeisme/dsh-devtools
dsh --profile web
```

From this repository checkout:

```bash
cd agent/harness-plugins
pnpm --filter @yeisme/dsh-devtools build
dsh plugin --profile web add ./packages/bundle/dsh-devtools
dsh --profile web
```

Set a temporary display level without changing profile metadata:

```bash
DSH_DEVTOOLS_LEVEL=debug dsh --profile web
NO_COLOR=1 dsh --profile web
```

Open **DevTools** from the Web session header. Pane Workbench opens it in the bottom utility region; deployments without the Pane seam use an overlay. Export and CPU Profile are explicit actions in the panel. CPU profiling is available only when the Host proves a loopback Web bind.

V1 aligns Host and browser lanes with an estimated clock offset and reports uncertainty. It does not claim exact cross-process RPC tracing.

## Uninstall

```bash
dsh plugin --profile web remove @yeisme/dsh-devtools
```
