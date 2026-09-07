## ADDED Requirements

### Requirement: `/harness` 路由 MUST 以 BFF 派生的 context 驱动 connected 数据流且全程 fail-closed

The `/harness` route MUST mount the connected Harness surface without accepting tenant/workspace route parameters; scope MUST be derived by the BFF from the authenticated session. The connected data flow MUST fetch context, then the descriptor catalog, then projections, and MUST register all in-flight work with the Authority cleanup boundary. Any transport, permission, contract or availability failure MUST map to an explicit honest readiness (`permission_required`/`contract_mismatch`/`needs_contract`/`offline`/`degraded`) and MUST NOT be masked by fixtures or browser-inferred data. When the descriptor catalog is absent, stale, or fails registry validation, every surface and slot MUST render `needs_contract` placeholders instead of supplied data.

#### Scenario: Descriptor catalog missing while projections exist

- **WHEN** projections are returned but no registry-approved descriptor exactly binds a projection (installation/surface/kind/version/contractDigest)
- **THEN** the route MUST downgrade readiness to `needs_contract` with a `descriptor_missing` diagnostic
- **AND** MUST NOT render the projection or any slot content for that surface.

#### Scenario: Context fetch denied

- **WHEN** the context request fails with a permission or authentication envelope code
- **THEN** the route MUST surface `permission_required` with a redacted diagnostic
- **AND** MUST NOT retry silently or substitute a fabricated context.

### Requirement: 每个 Harness 槽位 MUST 由 registry 批准的 catalog descriptor 门禁，未批准一律不渲染

Each of the five harness-studio 3.x slots (asset library, layout canvas, sandboxed iframe host, DSH bridge handoff, action confirmation) MUST be gated on a catalog descriptor that passes the static release/origin registry and carries `readiness === "available"` for the owning slot. A slot without an approved descriptor MUST render an honest `needs_contract` placeholder and MUST NOT mount the component or render any supplied entries, nodes, links or actions. Server-authored slot supplies MUST NOT reach mounted components unless the gate passes.

#### Scenario: Asset library slot lacks an approved descriptor

- **WHEN** the descriptor catalog supplies no registry-approved `asset-library` descriptor for the `eikona.asset` surface
- **THEN** the asset library and layout canvas MUST NOT render
- **AND** two `needs_contract` placeholders MUST be shown instead of any entries or canvas nodes.

#### Scenario: Iframe descriptor is not the sandboxed-iframe kind

- **WHEN** the approved `episode-workspace` descriptor is not of kind `sandboxed-iframe`
- **THEN** the iframe host MUST stay closed with a placeholder
- **AND** no iframe element may be mounted.

### Requirement: DSH handoff 与 action 确认 MUST 通过全部绑定 gate 才可渲染，且不得伪造 dispatch 或导航

A DSH handoff action MUST render only when the deep link passes closed runtime validation, its `sourceSurfaceId` equals the descriptor surface, and its target passes the registry deep-link allowlist; activating it MUST record intent only and MUST NOT perform navigation while the navigation contract is `needs_contract`. An action confirmation entry MUST render only when the action context matches the current authoritative context, the action ref is listed in the projection `allowedActionRefs`, the installation/surface/contract-digest triple exactly binds the projection, and a registry-approved catalog descriptor backs it. Dispatch MUST go through the injected seam (the route default is the SDK fake); the UI MUST NOT fabricate a real dispatch, receipt, or navigation outcome.

#### Scenario: Handoff target is not on the allowlist

- **WHEN** a structurally valid DSH deep link targets a ref not admitted by the registry allowlist
- **THEN** the open control MUST NOT render
- **AND** a `needs_contract` placeholder MUST explain that no target will be opened.

#### Scenario: Action not listed in allowedActionRefs

- **WHEN** a server-authored action descriptor is not listed in the current projection `allowedActionRefs`, or its context/installation/surface/digest binding drifts
- **THEN** the confirmation entry MUST NOT render
- **AND** no dispatch may be produced.

### Requirement: iframe 宿主 MUST 以 per-load `HarnessBridgeSession` 校验桥消息，任何漂移 fail-closed 卸载 surface

The sandboxed iframe host MUST create a per-load channel nonce and bridge channel bound to the descriptor, context and release digest, and MUST evaluate every inbound `postMessage` through the `HarnessBridgeSession` sequence machine (handshake → ready → view.request; `diagnostic.report` legal after handshake). Messages from any window other than the hosted iframe `contentWindow` MUST fail closed. Each pending `view.request` MUST be answered exactly once via the host-to-plugin `view.response` path. Out-of-order, duplicate, schema-invalid or origin/nonce/context/release-drifting messages MUST unmount the iframe and replace the surface with a redacted blocked status; the host MUST NOT retry, downgrade, or keep the surface mounted. A descriptor that fails the static release/origin registry MUST render a `needs_contract` blocked state without mounting the iframe, which MUST pin default-deny `sandbox`/`referrerPolicy`/`csp`/`allow=""` attributes when mounted.

#### Scenario: Inbound message from a foreign window

- **WHEN** a `message` event arrives whose source is not the hosted iframe content window
- **THEN** the host MUST fail closed with `blocked_supply_chain`
- **AND** MUST NOT forward the message to the session machine or the bridge message callback.

#### Scenario: Plugin sends view.request before ready

- **WHEN** a schema-valid `view.request` arrives before handshake and ready complete
- **THEN** the session machine MUST reject it as a sequence violation
- **AND** the iframe MUST be unmounted and replaced by a redacted blocked status.

#### Scenario: Descriptor fails the static registry

- **WHEN** the iframe descriptor does not pass the static release/origin registry
- **THEN** the host MUST render a `needs_contract` blocked state with the gate code
- **AND** MUST NOT mount any iframe element.

### Requirement: context 切换 MUST 一次性清空 Harness presentation 状态

When the authoritative context key (tenant, workspace, principal, context revision) changes, the Harness presentation reducer MUST discard the selected tab, focused resource, overlay and action preview in a single transition, and the route MUST move focus to the default surface tab. Stale tenant/workspace presentation state MUST NOT survive rehydration.

#### Scenario: Workspace switches while an overlay is open

- **WHEN** the context key changes while an action-preview overlay and a non-default tab are active
- **THEN** the reducer MUST reset tab, focused resource, overlay and action preview to the initial state
- **AND** the previous context presentation MUST NOT be observable after the switch.
