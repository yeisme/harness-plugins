# workbench-harness-bridge Specification

## Purpose

还清 Harness Studio 冻结合同之外的本地桥接债务：为 DSH deep-link handoff
提供 fail-closed 运行时校验、为 `harness-bridge.v1` iframe 桥补齐消息时序
与宿主应答合同、为 `diagnostic.report` 落地默认 `needs_contract` 的服务端
汇聚边界，全程不引入 action/navigation 跨桥或真实诊断存储。

## Requirements

### Requirement: DSH deep-link handoff MUST pass closed runtime validation before use

`HarnessDshDeepLink` envelopes MUST be validated by a dedicated SDK validator before any component opens or embeds a handoff target. The validator MUST reject unknown fields, sensitive field names, contract-version drift, non-opaque refs, URL-shaped targets and malformed nonces. `deep-link` mode MUST NOT carry embedded constraints; `embedded` mode MUST carry bounded positive integer dimensions and a boolean fullscreen flag. Invalid envelopes MUST fail closed and MUST NOT produce an open/open-embed action.

#### Scenario: Deep-link envelope carries an unexpected field

- **WHEN** a `HarnessDshDeepLink` candidate contains any key outside the closed contract field set
- **THEN** the validator MUST reject it and no handoff action may be offered
- **AND** it MUST NOT ignore the extra field or coerce the envelope into a valid shape.

#### Scenario: Mode and embedded constraints disagree

- **WHEN** an envelope declares `mode: "embedded"` without bounded embedded constraints, or `mode: "deep-link"` with embedded constraints present
- **THEN** the validator MUST fail closed
- **AND** the handoff MUST NOT be opened or embedded.

### Requirement: The iframe bridge MUST enforce message sequencing and correlated host responses

The `harness-bridge.v1` bridge MUST validate inbound message order per channel: `bridge.handshake` first, `bridge.ready` second, then `view.request`; `diagnostic.report` may arrive any time after handshake. Out-of-order, duplicate or unexpected messages MUST fail closed without mutating channel state. The host MUST answer a `view.request` with a `view.response` that carries the same channel binding and the pending view ref; each request MUST be answered at most once, and responses for unknown or already-answered view refs MUST be rejected. Action and navigation semantics MUST NOT cross the bridge.

#### Scenario: Plugin sends view.request before handshake

- **WHEN** an inbound `view.request` arrives on a channel that has not completed handshake and ready
- **THEN** the bridge MUST reject it as a sequence violation
- **AND** it MUST NOT queue, answer or retain any part of the message.

#### Scenario: Host answers the same view.request twice

- **WHEN** the host attempts to build a second `view.response` for an already-answered view ref
- **THEN** the bridge MUST refuse to construct the message
- **AND** the channel state MUST remain consistent for other pending requests.

### Requirement: diagnostic.report aggregation endpoint MUST default to fail-closed redacted handling

The Workbench BFF MUST expose a bounded POST endpoint for plugin `diagnostic.report` envelopes that rejects oversized bodies, unknown fields, sensitive field names, contract-version drift and malformed diagnostic codes. Until the diagnostics aggregation contract is published, the endpoint MUST respond with an explicit `needs_contract` envelope, MUST NOT persist, forward or echo submitted diagnostics, and MUST NOT change the behavior of the existing GET context/descriptor/projection endpoints.

#### Scenario: Diagnostic report contains a credential field

- **WHEN** a posted diagnostic envelope contains a field name matching token, secret, credential, authorization, cookie, password, private path or raw payload patterns
- **THEN** the endpoint MUST reject the request with a redacted error
- **AND** it MUST NOT store, log or echo the submitted body.

#### Scenario: Valid diagnostic envelope before the aggregation contract exists

- **WHEN** a schema-valid redacted diagnostic envelope is posted
- **THEN** the endpoint MUST answer with `readiness: "needs_contract"` and a redacted diagnostic
- **AND** no diagnostic data may be persisted or forwarded.
