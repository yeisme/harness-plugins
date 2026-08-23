# @yeisme/dsh-pane-domain

```bash
dsh plugin --profile web add @yeisme/dsh-pane-domain
dsh plugin --profile web add ./packages/bundle/pane-domain
```

Registers Eikona, Sonora, Auctra, Pinax, Anatomia, and Ordo Team panes on the existing Pane Workbench. Canonical mutation stays with each owner.

Dual face:

- `./client` — browser entry that registers the domain pane views.
- `./host` (package root) — mounts formal `domain.<owner>` owner sources for owners whose adapter injected a typed transport under `domainOwnerTransport.<owner>` (see `paneDomainOwnerTransportKey`). Owners without a transport are not faked: the client pane degrades to an honest `offline` projection. No timer polling; updates are snapshot-read plus push events only.
