# @yeisme/dsh-client-ui-pane-domain

Serial Pane adapters for Eikona, Sonora, Auctra, Pinax, Anatomia, and Ordo Team. Canonical state stays with each owner. The client folds `PaneEventEnvelopeV1` only. Mutations pause on `reconcile_required`, `offline`, and `contract_mismatch`. Ordo launch, cancel, redispatch, and lease.release stay `not_available` even if a snapshot lists them. The Ordo Team view consumes the existing `ordoAgentOps` Host snapshot; it does not create a second scheduler.
