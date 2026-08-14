# dsh-ordo-command-interaction-v1

English | [中文](README.zh.md)

The DSH-side `ordo` slash-command interaction surface: read subcommands plus gated action subcommands with preview-before-mutate.

- [proposal.md](proposal.md): Why / What Changes / capability ledger / first slice / non-goals / impact.
- [design.md](design.md): single-command grammar, registration ownership, the four-part read format, the action preview→CAS→receipt state machine, and popup/panel coordination.
- [tasks.md](tasks.md): four lanes: commands-core / commands-actions / client-ux / verify.
- [specs/dsh-ordo-command-surface/spec.md](specs/dsh-ordo-command-surface/spec.md): host command contract (registration/grammar/read/action/safe text).
- [specs/dsh-ordo-command-ux/spec.md](specs/dsh-ordo-command-ux/spec.md): discovery, popup, result rendering, panel coordination, and a11y.

Data-source dependencies:

- `openspec/changes/ordo-dsh-plugin-visualization-v1/` (snapshot remote, state vocabulary, action staging)
- `openspec/changes/dsh-agent-composition-preview-v1/` (composition projection and qualification)

No new contract on the Ordo side; the qualify remote action surface is left to a later slice of `agent/ordo/openspec/changes/ordo-agent-qualification-v1/`.
