# Tasks: dsh-full-plugin-ui-acceptance

## 1. 验收运行器与证据区分

- [x] 1.1 全插件清单 runner：区分 profile boot、可见 UI 交互、不可用能力与未验证功能；缺失 owner 服务不记为功能成功。Scope: `scripts/run-full-plugin-validation.mjs`、`scripts/run-web-plugin-acceptance.mjs`。（done 2026-09-05 commit 64ea054：runner 产 `profile_boot_passed_function_not_verified` 分级与 `boot_status`/`function_status` 分离；2026-09-06 复跑 full-plugin validation PASS（含 test:dsh-dev 与 test:dsh-dev:integration，证据 `temp/integration-test-runs/full-plugins-2026-09-06T16-53-51-056Z-1913824/`）；web-plugin acceptance BOOT PASS / FUNCTIONAL COVERAGE PARTIAL（证据 `temp/integration-test-runs/web-plugins-2026-09-06T17-04-07-837Z-2319615/`，32 bundle 全 boot、五个必查入口 entry_opened）。可选能力探针 404（/api/tokenUsage/capabilities）按 `unavailable_owner_services` 单列，不入浏览器错误门——诚实降级不计为成功也不误伤 boot 门。）
- [x] 1.2 真实 Creator Studio 产物 ModuleLoader factory 回归验证。（done 2026-09-05：harness 内 dsh-dev 装载链复验 32 bundle 零装载失败；web acceptance boot 检查 'Failed to load plugins|missed the module table' 零命中。）

## 2. Creator Studio 晚到 Pane 生命周期

- [x] 2.1 监听 Pane 服务到达/变更/撤销，丢弃旧 generation 异步挂载；不可用启动器移除。Scope: `packages/client/ui-creator-studio/`。（done 2026-09-05 commit 7db396b 'fix(creator-studio): remount when Pane Workbench arrives after apply'；`client.spec.tsx` 覆盖晚到重挂载与撤销清理。2026-09-06 复验 22/22 通过。）

## 3. 共享视觉与批注覆盖

- [x] 3.1 共享字号/字体继承/输入框一致与触控间距 token 收敛。Scope: `packages/client/ui-visual-kit`、各 pane 插件。（done 2026-09-05 commit 340c784 'fix(ui): adopt visual-kit tokens across leftover pane plugins'；2026-09-06 复验 check:surfaces exit 0 + test:visual 92/92（`temp/integration-test-runs/ui-visual-2026-09-06T16-46-20-252Z-1737455/`）+ check:plugins 六检查器 0 findings（`temp/toolchain-runs/2026-09-06T164607632Z-toolchain/`）。）
- [x] 3.2 真实批注组件中英文、三宽度、焦点与关闭测试；视觉基线仅在人工确认后更新。Scope: `packages/client/ui-selection-annotation/`。（done 2026-09-05 commit 64ea054 快照刷新与批注覆盖；2026-09-06 复验 73/73 通过；本轮未更新视觉基线。）

## 4. 无 Web 基座拒绝

- [x] 4.1 自定义 profile 缺官方 Web app 时准备检查明确失败。Scope: `scripts/dsh-dev.mjs`。（done 2026-09-05 commit 1aa6201；`run-dsh-dev-integration-tests.mjs` 断言 missing-web profile prepare 以 'has no DSH Web app' 退出 1；2026-09-06 复跑 test:dsh-dev:integration PASS（见 1.1 full-plugins 证据）。）

## 5. 验证与收口

- [x] 5.1 全仓门禁：typecheck / build / check:bundles。（done 2026-09-06 复验：typecheck exit 0、build exit 0、check:bundles 27/27。）
- [x] 5.2 `openspec validate dsh-full-plugin-ui-acceptance --strict --no-interactive`。（done 2026-09-06：strict validate 绿。）
