# Workbench Agent CLI Pane v1 performance baseline

Date: 2026-08-24 UTC

This is an integration-workstation baseline, not a production SLO. Measurements used warm Go benchmark processes and deterministic synthetic safe projections; staging soak results remain required before promotion.

## Environment and budgets

- Linux amd64, AMD EPYC 7742, Go 1.26.4, Bun 1.3.14, Vitest 3.2.7.
- 1,000-descriptor seal: median below 25 ms, below 12 MiB/op, below 20,000 allocs/op.
- 1 MiB output sanitation: median below 20 ms, at least 50 MB/s, below 12 MiB/op, below 32 allocs/op.
- Host concurrency rejection: p95 below 1 ms while one run owns the only slot.
- 200 simultaneous terminal-output watchers: p95 below 100 ms, every watcher receives the same bounded typed frame.
- UI: 10,000 events mount fewer than 100 list items; accumulated history remains bounded to 100 runs and no additional cursor action appears after the terminal page.

## Results

| Scenario | Result | Budget | Outcome |
| --- | --- | --- | --- |
| Seal 1,000 descriptors | 14.79 ms median; 14.67–14.96 ms; 7.45–8.00 MiB/op; 14,045–14,048 allocs/op | 25 ms / 12 MiB / 20k allocs | pass |
| Sanitize 1 MiB output | 10.25 ms median; 9.82–10.66 ms; 98.39–106.79 MB/s; 9.47 MiB/op; 11 allocs/op | 20 ms / 50 MB/s / 12 MiB / 32 allocs | pass |
| Host full-slot backpressure, 200 requests, repeated 10x | p95 12.61–27.10 µs | 1 ms | pass |
| 200 concurrent gRPC output watchers, repeated 10x | p50 7.87–18.30 ms; p95 9.34–21.19 ms | 100 ms | pass |
| 10,000 event projection | virtualized marker present; fewer than 100 mounted list items | fewer than 100 | pass |
| 100-run accumulated history | bounded dialog remains operable; at most 101 buttons; no load-more after final page | 100-run bound | pass |

## Profile observations

Profiles were written under ignored `temp/` paths during the run. Catalog CPU and allocation cost is dominated by canonical JSON encoding, descriptor/catalog digesting, and cloning; there is no per-descriptor external I/O or repository query. Output CPU is dominated by terminal-control stripping and UTF-8/control validation; allocation space is bounded linear copying across the two redaction layers, control stripping, and live-tail projection. The 1 MiB absolute input ceiling used by the Host canary remains below the sanitizer's 10 MiB hard ceiling.

The browser scenarios use synthetic projections and jsdom for component bounds. The Playwright evidence separately covers real Chromium layout, but neither result is a claim about production network latency or tenant-scale owner performance.

## Commands

```bash
CGO_ENABLED=0 go test ./service/internal/cli/registry -run '^$' -bench '^BenchmarkCliCatalogSeal1000Descriptors$' -benchmem -count=5 -cpuprofile temp/cli-catalog.cpu.pprof -memprofile temp/cli-catalog.mem.pprof
CGO_ENABLED=0 go test ./service/internal/cli/output -run '^$' -bench '^BenchmarkCliOutputSanitize1MiB$' -benchmem -count=5 -cpuprofile temp/cli-output.cpu.pprof -memprofile temp/cli-output.mem.pprof
CGO_ENABLED=0 go test ./service/internal/clihost -run '^TestCliHostBackpressureAnd200WatchersStayBounded$' -count=10 -v
apps/web/node_modules/.bin/vitest run --root apps/web test/cli-run-history.test.tsx test/cli-run-workspace.test.tsx
go tool pprof -top -nodecount=8 temp/cli-catalog.cpu.pprof
go tool pprof -top -alloc_space -nodecount=8 temp/cli-catalog.mem.pprof
go tool pprof -top -nodecount=8 temp/cli-output.cpu.pprof
go tool pprof -top -alloc_space -nodecount=8 temp/cli-output.mem.pprof
```
