## 1. Pane composition foundation

- [x] 1.1 Extend Pane protocol with full creator context fields, presentation metadata, action descriptor/request/receipt schemas, and partial/cancel-unknown states.
- [x] 1.2 Add Pane command and artifact-intent registries with deterministic priority, fail-closed receipts, and no fallback mutation retry.
- [x] 1.3 Expose production Pane Workbench plugin/view/command/intent registration and pass view metadata into local components.
- [x] 1.4 Add focused protocol, event, region, command, and intent tests.

## 2. Creator Studio Host

- [x] 2.1 Define six owner, task, resource, production, review, job, media-access, context, and transport contracts.
- [x] 2.2 Implement strict Host validation and frozen expected-context capture.
- [x] 2.3 Implement deterministic local/service owner directory without post-selection fallback.
- [x] 2.4 Implement safe snapshot composition, Scaena-owned aggregation, media resolution, descriptor CAS revalidation, and one-shot dispatch.
- [x] 2.5 Build executable Node output after TypeScript decorator lowering.
- [x] 2.6 Add directory, validation, gateway, context-drift, and uncertain-settlement tests.

## 3. Creator Studio Web experience

- [x] 3.1 Implement single-flight projection controller, generation/session reset, bounded polling, and ephemeral action inputs.
- [x] 3.2 Implement task-first home, quick create, six owner cards, Scaena stage pulse, owner workspaces, review, jobs, and media views.
- [x] 3.3 Implement server-authored action forms with field validation, risk/cost/rights/confirmation states, compact-mode restrictions, and safe receipts.
- [x] 3.4 Implement artifact open/compare/context/handoff intent integration with Rich Media preview.
- [x] 3.5 Register one Pane runtime plugin plus header/footer launchers, dependency probes, exact disposal, and no duplicate shell.
- [x] 3.6 Add controller, view, ToolView component, client registration, and responsive interaction tests.

## 4. Installable ecosystem bundle

- [x] 4.1 Add `@yeisme/dsh-creator-studio` Host/Client package, single-row Cordis patch, browser ModuleLoader build, contracts export, and owner registration helper.
- [x] 4.2 Reference-count Host Remote/directory mounts and preserve externally supplied compatible directories/services.
- [x] 4.3 Document the three local installation commands, frozen context requirement, owner adapter boundary, and unknown-settlement behavior.
- [x] 4.4 Add bundle profile, Remote mounting, reference-counting, and descriptor tests.

## 5. Validation and handoff

- [x] 5.1 Run focused Creator Studio protocol/Host/Client/bundle typecheck, test, and build gates.
- [x] 5.2 Run repository typecheck/test/build, doc sync, strict OpenSpec validation, and diff whitespace checks; classify unrelated baseline failures without modifying user-owned work.
