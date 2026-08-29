# DSH Creator Studio Client

Task-first Pane views for text, image, audio, complete current-project drama,
context, cross-owner assets, analysis, generation, approvals, and safe media preview. Browser state is limited to
ephemeral form values and validated Host projections; owner canonical state
and mutation receipts remain outside this package.

`CreatorStudioRuntimeV1` is the shared browser projection runtime consumed by
Creator Studio and Director panes. It owns one snapshot store and subscription,
supports explicit refresh, bounded asset pages, artifact resolve, owner action
dispatch, approval decisions and receipts, and disposes the subscription
exactly once. It is not a domain store and never polls automatically.

Creator Home keeps the complete current-project workflow and exposes an
additive “full show console” entry when the `drama.show-control.v1` capability
is available. Missing show-control ownership renders an honest disabled reason.
