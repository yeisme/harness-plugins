# dsh-agent-composition-preview-v1

English | [中文](README.zh.md)

DSH-side implementation spec: Agent composition fact projection and the read-only Agent Preview (root handoff: `openspec/changes/agent-composition-preview-v1/`).

- [proposal.md](proposal.md): Why / What Changes / DSH owner slice / capability ledger / first slice / non-goals / impact.
- [design.md](design.md): `AgentCompositionPreview` service, digest rules, three-layer health, CLI, picker panel, lineage, and the failure registry.
- [tasks.md](tasks.md): four lanes: projection-core / cli-surface / client-ui / verify.
- [specs/dsh-composition-projection/spec.md](specs/dsh-composition-projection/spec.md): projection service, envelope, smoke, and lineage contracts.
- [specs/dsh-agent-preview-experience/spec.md](specs/dsh-agent-preview-experience/spec.md): picker Preview, maturity slots, and the ToolView contract.

Consumer: `agent/ordo/openspec/changes/ordo-agent-qualification-v1/`.
