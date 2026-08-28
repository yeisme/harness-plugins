## 1. 合同

- [x] 1.1 冻结 `TerminalInteractiveCapabilityV1` 探测与 fail-closed freshness。验收：缺 V2 不得宣称 connected。
- [x] 1.2 明确 typed 动作：list/open/close；attach/write/resize 等待 owner duplex。验收：设计图与 spec 一致。

## 2. 探针 UI

- [x] 2.1 TerminalPane 缺 capability 时展示 `contract_mismatch` 与所缺 capability。验证：`pnpm --filter @yeisme/dsh-client-ui-desktop-workbench run test`。
- [x] 2.2 官方 duplex seam 合入后再启用输入与 xterm。本 change 不勾（收口 2026-08-28：结构性 deferral，按设计「另开 change」条款移交——非本 change 交付物）。现状：上游 0.1.1-rc.2（b150a551b8d）核验 `TerminalSessionService` 无 attach/duplex API；xterm 附着渲染器已实现并保留在 `@yeisme/dsh-terminal` bundle（`dsh-terminal-v1` Decision 3 VT duplex lane），官方 seam 合入后由该 lane 接管；官方现有行式能力已由 console lane 交付（已归档 `dsh-web-pane-terminal-sidechat-v1`）。本 change 范围内交付保持：探针 fail-closed + contract_mismatch，不解封、不伪造。

## 3. 验证

- [x] 3.1 `openspec validate dsh-terminal-interactive-v1 --strict --no-interactive`。（progress 2026-08-22：strict valid。2.2 官方 duplex 仍 commodity-parked，本 change 不勾；2026-08-28 收口为显式 deferral 移交，见 2.2 注。）
