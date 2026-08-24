# harness-plugins-osv-security-monitoring-v1

## Why

harness-plugins 已有 CI，依赖树是 Bun/TS lockfile。OSV 能扫 npm/pnpm 锁文件；govulncheck 不适用。

## What Changes

- 增加每周 OSV-Scanner（第一波不挡 PR）。
- 增加 `osv-scanner.toml`。
- 在 `docs/README.md` 记录；不加 govulncheck。

## Impact

根 handoff：`openspec/changes/supply-chain-security-monitoring-v1/`。不改插件协议或发布流程。
