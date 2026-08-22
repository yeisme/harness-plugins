## 1. 合同

- [x] 1.1 冻结 `TerminalInteractiveCapabilityV1` 探测与 fail-closed freshness。验收：缺 V2 不得宣称 connected。
- [x] 1.2 明确 typed 动作：list/open/close；attach/write/resize 等待 owner duplex。验收：设计图与 spec 一致。

## 2. 探针 UI

- [x] 2.1 TerminalPane 缺 capability 时展示 `contract_mismatch` 与所缺 capability。验证：`pnpm --filter @yeisme/dsh-client-ui-desktop-workbench run test`。
- [ ] 2.2 官方 duplex seam 合入后再启用输入与 xterm。本 change 不勾。

## 3. 验证

- [ ] 3.1 `openspec validate dsh-terminal-interactive-v1 --strict --no-interactive`。
