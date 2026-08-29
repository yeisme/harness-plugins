## ADDED Requirements

### Requirement: Browser Pane SHALL require a typed BrowserSession provider

The DSH Browser Pane SHALL register live browser controls only when an approved provider exposes a compatible BrowserSession capability, exact context/session/runtime binding and contract digest. Web search, `ctx.web`, a URL or an iframe SHALL NOT be treated as a live BrowserSession.

#### Scenario: Profile provides search only

- **WHEN** the active profile exposes web search links but no compatible BrowserSession provider
- **THEN** the Pane SHALL show `search_only`, `needs_contract` or `unavailable`
- **AND** it SHALL NOT expose navigation, manual takeover, download or evidence actions.

### Requirement: Browser projections SHALL exclude credentials and private content

Browser projections SHALL contain only bounded opaque refs and safe summaries. They SHALL NOT expose cookies, Authorization headers, credential values or refs, signed URLs, absolute paths, raw DOM, complete page content, raw prompts, provider payloads or private tool arguments.

#### Scenario: Provider returns a sensitive field

- **WHEN** a provider snapshot or event contains a forbidden credential, path, URL query secret or raw DOM field
- **THEN** the host adapter SHALL reject the projection as `contract_mismatch`
- **AND** the client SHALL receive no browser facts from that payload.

### Requirement: Browser actions SHALL remain owner-authorized intents

Navigation, tab management, manual takeover, download and screenshot/DOM evidence operations SHALL bind the exact context, session, page version, expected revision, idempotency key and capability digest. The Browser Pane SHALL NOT perform these effects locally or infer success before an owner receipt.

#### Scenario: Navigation outcome is unknown

- **WHEN** transport fails after dispatch and no terminal owner receipt is available
- **THEN** the action SHALL enter `unknown` or `reconcile_required`
- **AND** the Pane SHALL NOT automatically retry or mark the page navigated.

### Requirement: Browser lifecycle SHALL be generation-scoped

Subscriptions, pending actions, streams, object URLs and observers SHALL be released on context, session or runtime generation switch, HMR and dispose. A replacement generation SHALL require a fresh snapshot before mutation is enabled.

#### Scenario: Late event arrives after tenant switch

- **WHEN** an event from the previous BrowserSession arrives after the active context generation changes
- **THEN** the client SHALL discard the event
- **AND** it SHALL NOT display or act on the previous session's page, download or evidence refs.

### Requirement: Browser content SHALL be treated as untrusted evidence

Page text, DOM, OCR, downloads, QR codes and web instructions SHALL NOT expand host, Agent, filesystem, credential or network authority. Screenshot and DOM evidence SHALL remain owner-controlled resources and SHALL be loaded only through authorized bounded refs.

#### Scenario: Page instructs the Agent to run a command

- **WHEN** page content asks the Agent to ignore policy, execute a command or upload a file
- **THEN** the content SHALL remain quoted browser evidence
- **AND** no tool, credential, filesystem or network action SHALL be authorized by that content.
