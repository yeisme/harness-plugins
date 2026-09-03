## 1. Public Contracts

- [x] 1.1 Add additive `FileTreeProjectionCapabilityV2`, page/node/availability and strict inspect proof types without changing V1 exports
- [x] 1.2 Add revisioned `ComposerReferenceCapabilityV1` state, dispatch, stale and redirect contracts
- [x] 1.3 Add contract fixtures for hidden/ignored/sensitive/symlink/partial/stale and legacy alias cases

## 2. File Host Projection

- [x] 2.1 Implement Node owner roots/listChildren/search/reveal pagination with opaque refs and all-entry enumeration
- [x] 2.2 Implement metadata inspect, sensitive reveal fence and safe symlink target validation
- [x] 2.3 Add versioned browser API methods and reject unresolved V2 sessions without `process.cwd()` fallback

## 3. Canonical Explorer UI

- [x] 3.1 Bind `dsh.explorer` to the current File Host runtime and remove the empty provider path
- [x] 3.2 Implement lazy loading, virtualization, primary/checked separation and file click/double-click/Enter behavior
- [x] 3.3 Implement strict preview admission, metadata hover/focus delay, touch Info/More and row/card async states
- [ ] 3.4 Implement locked desktop navigator, narrow content/back flow and focus restoration

## 4. Composer References

- [x] 4.1 Implement the shared reference controller with one active and at most eight pinned references
- [x] 4.2 Adapt successful file previews and explicit selection anchors into the unified envelope
- [x] 4.3 Mount chips in `conversation.input.dock` with structured-send negotiation and fail-closed copy fallback
- [x] 4.4 Implement version stale handling and frozen sent snapshots
- [ ] 4.5 Add the host-backed “view current version” navigation action

## 5. Compatibility Migration

- [x] 5.1 Route File Tree buttons and `/explorer`/`/files` requests to `dsh.explorer`
- [x] 5.2 Add hidden Release 1 shims and deprecation diagnostics for `file.tree`, `workspace.explorer` and `desktop.files`
- [x] 5.3 Document Release 2 request/persistence aliases, rollback and later removal gate

## 6. Verification

- [x] 6.1 Add unit/component coverage for tree projection, interactions, preview gate, references and aliases
- [x] 6.2 Add real temporary-directory integration coverage with redacted evidence output
- [ ] 6.3 Verify browser flows at 1440/768/390, dark, reduced motion, fine/coarse pointer, keyboard and HMR/dispose
- [x] 6.4 Run focused typecheck/tests/build, bundle checks and strict OpenSpec validation
