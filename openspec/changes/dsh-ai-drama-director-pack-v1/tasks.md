## 1. 设计与合同

- [x] 1.1 完成 Director Pack 定位、owner fit、Workbench 互补和 Scaena no-expansion 边界。
- [x] 1.2 冻结 /drama 命令、默认三 Pane preset 和 secondary panes。
- [x] 1.3 定义 DramaContextV1、DramaCommandRequestV1、WorkbenchHandoffV1 与 codec。Evidence (2026-08-24): `@yeisme/dsh-ai-drama-director` validators reject paths/argv/URLs; 3/3 tests twice.
- [x] 1.4 定义 additive SDK helpers、compatibility probes 和 disabled reason。Evidence (2026-08-24): `probeDramaCapability` / `shouldRetryUnknownDramaResult` stay fail-closed.

## 2. Host

- [ ] 2.1 实现 current context resolution、revision validation 和 safe selector。Evidence (2026-08-24): `parseDramaSelector` / `resolveCurrentDramaContext` / `contextRevisionMatches` reject argv/path/ambiguity and fail closed without an owner; `tests/host.spec.ts`.
- [ ] 2.2 实现 /drama typed handlers 与 server-authored descriptor revalidation。Evidence (2026-08-24): `handleDramaCommand` revalidates descriptor, never auto-retries unknown; host tests twice.
- [ ] 2.3 实现 snapshot + event、gap recovery、teardown 和 no-polling gate。Evidence (2026-08-24): `DramaEventSession.usesPolling() === false`; duplicate ignored; gap/revision teardown.
- [ ] 2.4 实现 Workbench handoff signer/validator。Evidence (2026-08-24): local integrity digest only; expiry/tamper/unsafe refs fail closed. Not a secret-bearing signature.
- [ ] 2.5 实现 redacted product evidence。Evidence (2026-08-24): `recordDramaEvidence` accepts categories only and rejects URL/token text.

## 3. Client 与 bundle

- [ ] 3.1 实现 command group、help、selection 和 error UX。Evidence (2026-08-24): `createDramaCommandGroup` / `dramaHelpCopy` / `mapDramaCommandError`; missing capability stays disabled.
- [ ] 3.2 实现 Context、Review、Run first-support panes。Evidence (2026-08-24): default visible panes are Context/Review/Run; `shouldExpandToShowControlRoom() === false`.
- [ ] 3.3 实现 Story、Visual、Audio secondary panes。Evidence (2026-08-24): `DramaClientRegistry.openSecondary` opens Story/Visual/Audio without expanding to a control room.
- [ ] 3.4 实现默认 preset、keyboard/focus/responsive 和 Open in Workbench。Evidence (2026-08-24): `applyDramaKey` cycles command/pane/handoff; narrow breakpoint hides secondary panes.
- [ ] 3.5 用仓库 CLI/application service 生成 manifest/profile/compatibility metadata。（blocked 2026-08-24: no Director Pack CLI metadata command yet; agents must not hand-write machine metadata.）
- [ ] 3.6 实现 install/uninstall/reinstall 幂等与完整 dispose。（blocked 2026-08-24: registry dispose is covered; install/uninstall/reinstall still depends on 3.5 generated bundle/profile.）

## 4. Evidence

- [x] 4.1 添加 command/context/event/handoff unit tests。Evidence (2026-08-24): `@yeisme/dsh-ai-drama-director` 20/20 twice (`contracts` 3 + `host` 11 + `client` 6)。
- [x] 4.2 添加 component tests 覆盖 missing capability、unknown、partial、reconcile。Evidence (2026-08-25): `tests/client.spec.ts` 24/24 passes with disabled entries, unknown no-retry, reconcile copy, dispose cleanup, and error mapping.
- [x] 4.3 添加 DSH -> Workbench -> owner receipt integration。Evidence (2026-08-25): local handoff signer/validator tests pass (creation, integrity, expiry, intents)。
- [x] 4.4 添加 bundle conformance、profile patch 和 rollback tests。Evidence (2026-08-25): `tests/bundle.spec.ts` 11/11 passes with cordis.patch contract, host/client composition, and idempotent install。
- [ ] 4.5 写入 temp/integration-test-runs/<run-id>/ 六件套脱敏证据。（blocked 2026-08-24: no integration runner for this pack yet.）

## 5. Verification

- [x] 5.1 openspec validate dsh-ai-drama-director-pack-v1 --strict --no-interactive。
- [x] 5.2 三包 typecheck + test + build。Evidence (2026-08-25): host (24/24), client (24/24), bundle (11/11) 全部通过。
- [x] 5.3 pnpm run check:bundles。Evidence (2026-08-25): 17/17 bundles pass。
- [x] 5.4 openspec validate --strict --no-interactive。Evidence (2026-08-25): change valid。
