# @yeisme/dsh-host-yeisme-commands

Registers Yeisme plugin commands on the official DSH `commands` registry. Names must match `yeisme-[a-z0-9_-]+`. Duplicate names are rejected. Example command: `yeismo-notice`.

## Registration contract

The plugin exports `inject = ['commands']` — a wait-for contract, not
decoration. With an empty inject the cordis loader can start the fiber before
dsh-base provides the service, and the fail-closed skip silently drops the
registration (no menu row, no error). Never claim official command names
(`goal`, `plan`, `model`, …): the registry is first-come with hard duplicate
failures. Full cookbook: `docs/cookbook/slash-commands.md`.

## Verification

```bash
pnpm --filter @yeisme/dsh-host-yeisme-commands test
pnpm --filter @yeisme/dsh-host-yeisme-commands run test:slash-browser   # real dsh web e2e
```
