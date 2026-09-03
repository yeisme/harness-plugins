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
- [x] 3.4 Implement locked desktop navigator, narrow content/back flow and focus restoration；Evidence: tree-state `narrow_content/narrow_return` reducer（记录来源行并恢复 focusedRef）；tree-ui `useNarrowViewport`（<560px matchMedia）+ 窄屏打开进入内容页（树 hidden）+「返回 Explorer」栏（焦点经 rAF 回树容器）；宽屏保持锁定 navigator（singleton pinned keep-alive）内容开相邻 group。Tests: explorer-v4.spec 窄屏两例（进入/返回/焦点恢复 + 宽屏无 back 流）。

## 4. Composer References

- [x] 4.1 Implement the shared reference controller with one active and at most eight pinned references
- [x] 4.2 Adapt successful file previews and explicit selection anchors into the unified envelope
- [x] 4.3 Mount chips in `conversation.input.dock` with structured-send negotiation and fail-closed copy fallback
- [x] 4.4 Implement version stale handling and frozen sent snapshots
- [x] 4.5 Add the host-backed “view current version” navigation action；Evidence: references controller `refresh` intent（active+pinned 同 id 原位替换，frozen sent 快照不动，未知 id 拒绝）+ dock stale chip「查看当前版本」（host 面缺席如实禁用）+ desktop-workbench 以 fileHost.inspect 重解析真值并打开刷新内容视图。顺带修复两真 bug：dock `useState(controller.snapshot)` 未绑定方法（首次渲染即 TypeError）、同 id 双 chip 重复 key。Tests: explorer-v4.spec refresh/dock 用例 + apply.spec。

## 5. Compatibility Migration

- [x] 5.1 Route File Tree buttons and `/explorer`/`/files` requests to `dsh.explorer`
- [x] 5.2 Add hidden Release 1 shims and deprecation diagnostics for `file.tree`, `workspace.explorer` and `desktop.files`
- [x] 5.3 Document Release 2 request/persistence aliases, rollback and later removal gate

## 6. Verification

- [x] 6.1 Add unit/component coverage for tree projection, interactions, preview gate, references and aliases
- [x] 6.2 Add real temporary-directory integration coverage with redacted evidence output
- [ ] 6.3 Verify browser flows at 1440/768/390, dark, reduced motion, fine/coarse pointer, keyboard and HMR/dispose（browser gate：真实浏览器矩阵属 canary 浏览器验证波次，plugin-host-protocol 明文不作为插件完成条件；jsdom 等价覆盖已交付——窄/宽流、coarse Info、键盘树导航、HMR/dispose 经 runtime refcount，如实未勾）
- [x] 6.4 Run focused typecheck/tests/build, bundle checks and strict OpenSpec validation
