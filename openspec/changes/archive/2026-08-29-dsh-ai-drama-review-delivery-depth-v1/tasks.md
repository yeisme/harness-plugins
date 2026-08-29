## 1. Rich-media review timeline

- [x] 1.1 Add bounded owner-provided transcript and caption cue projections plus artifact and version fencing for review navigation.
- [x] 1.2 Implement lazy WaveSurfer Timeline and Regions enhancement when safe owner peaks are available, with native long-audio fallback and no duplicate media engine.
- [x] 1.3 Add complete load, seek, region, fallback, error, dispose, HMR, reduced-motion, keyboard, and narrow-screen lifecycle tests.

## 2. Review annotation and cross-version comparison

- [x] 2.1 Compose Review Inbox selection with the existing selection-owner annotation contract for frame, time-point, and region annotations without creating a browser annotation ledger.
- [x] 2.2 Add image, video, and audio comparison across episode and version using independent artifact and version keys and owner-provided safe metadata.
- [x] 2.3 Implement annotation draft reset, target-version fencing, batch receipts, repair handoff, reconcile behavior, and contract/component tests.

## 3. Delivery depth and final evidence

- [x] 3.1 Add delivery version-difference, rights, evidence, blocker, and owner receipt-history projections without deriving canonical delivery state in the browser.
- [x] 3.2 Implement Delivery depth UI and owner-authored prepare or submit actions, keeping Workbench as an optional advanced-analysis handoff.
- [x] 3.3 Write redacted integration evidence for timeline review, annotation batch to repair handoff, cross-episode comparison, and delivery readiness to owner receipt history.
- [x] 3.4 Update package exports and documentation, run focused and root validation gates, verify the implementation against all three changes, and record remaining external-owner or human-gate work.
  - Evidence: implementation verification, focused gates, root typecheck/test/build, bundle contracts, strict OpenSpec and redaction checks pass. 2026-08-29 closeout: `scripts/doc-sync.mjs` 重建并入库（bilingual 结构配对 5/5 绿），阻塞解除；根门禁 typecheck/build/check:bundles(24/24) 绿，`pnpm run test` 唯一失败为 dsh-language-intelligence 180ms 重启窗口用例在满载下的时序 flake（隔离复跑两遍 8/8 绿，environmental 分类）；三 change 交叉验证通过（drama client 134、host 91、creator host/client 15/21、selection 45/31）；实现已随 7b1cbd9 落库。剩余外部项不变（Workbench 高级分析 handoff 可选、owner receipt 权威在外部）。
