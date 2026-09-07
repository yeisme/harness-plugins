## ADDED Requirements

### Requirement: Harness Studio MUST bind every view to an authoritative tenant and workspace context

Harness Studio MUST obtain tenant, Harness workspace, principal scope and context revision from the authenticated Workbench BFF/typed facade. Browser route parameters, host names, plugin metadata and opaque resource IDs MUST NOT establish authorization. The shell MUST expose the active tenant and workspace through visible or discoverable accessible context.

#### Scenario: User opens a workspace deep link
- **WHEN** the deep link supplies a tenant or workspace reference
- **THEN** the BFF MUST revalidate membership, installation and workspace grant before returning a Studio context
- **AND** Studio MUST show an existence-hiding safe denial or selection flow instead of guessing another tenant resource.

### Requirement: Context switches MUST reset scoped presentation state before new data is shown

When tenant, workspace, principal scope or context revision changes, Studio MUST abort prior scoped queries, close old event subscriptions, invalidate scoped query caches, clear selection, draft, bulk selection, inspector target, overlay and action preview state, then load the new context. Query and event identities MUST include tenant, workspace, installation/resource ref, contract digest and projection version.

#### Scenario: User switches tenants while an approval dialog is open
- **WHEN** the user confirms a new tenant/workspace context
- **THEN** Studio MUST dismiss the old dialog without dispatching its action and tear down its old workspace stream
- **AND** it MUST NOT render old assets, approvals, plugin configuration or resource IDs during the new context load.

### Requirement: DSH Web bridge and Workbench Studio MUST remain complementary clients

DSH Web compact bridge MUST provide a Harness-native conversational/plugin entry, safe context/status and approved deep link or embedded handoff. Workbench MUST provide the full multi-tenant Studio including plugin operations, Asset Library, layout and Episode Workspace. They MUST consume the same typed contracts but MUST NOT share private React state, browser token, domain state machine or hidden owner endpoint.

#### Scenario: DSH user continues an episode task in Studio
- **WHEN** the compact bridge opens a Studio continuation for an approved surface
- **THEN** the destination MUST revalidate context, installation, resource scope and action permission from server state
- **AND** the bridge MUST NOT transmit a browser credential, raw owner payload or an assumed authorization result.

### Requirement: Studio MUST provide responsive and accessible operational fallbacks

Desktop Studio MAY use multi-pane layouts. Tablet layouts MUST use priority content with accessible drawers or sheets instead of free docking, and mobile MUST retain context, observation, one-item approval, receipt and reconcile paths while rendering complex/high-risk authoring actions read-only or as an authorized continuation. All core controls MUST have keyboard access, visible focus, accessible names/status, focus return, non-color status text and reduced-motion behavior.

#### Scenario: Keyboard user resolves a reconcile-required operation on tablet
- **WHEN** the user opens the receipt in a tablet sheet using keyboard navigation
- **THEN** status, risk, owner, safe reconcile action and result MUST be announced and operable without pointer input
- **AND** closing the sheet MUST return focus to its invoking control.
