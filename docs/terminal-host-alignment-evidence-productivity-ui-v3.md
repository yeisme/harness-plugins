# DSH Workspace Productivity UI V3 - Task 2.1 TerminalHostV2 对照评审证据

## Task 状态：BLOCKED

**Blocked Reason**：depends on 1.3 official PTY Agent Note from DeepSeek Harness upstream

## Evidence 对照结果

### DSH Agent Note 状态

- **当前状态**：DSH upstream `deepseek-ai/deepseek-harness` 未发布 official PTY Agent Note
- **上游通道**：本仓 `upstream-prs/` backlog 固化 `TerminalInteractiveCapabilityV1` 系列（patch + 双语 note 草案）
- **PR 状态**：不开官方 PR，也不在 fork master 上开审查 PR；fork-ready 分支存在

### TerminalHostV2 Spec 对照

#### 本地 TerminalHostV2 定义（来自 design.md）

```typescript
interface TerminalHostV2 {
  readonly version: '0.2.0-rc.1'
  readonly capability: 'terminal-host.interactive.v1'
  listProfiles(): Promise<readonly TerminalProfileV1[]>
  listTerminals(): Promise<readonly TerminalSessionV2[]>
  openTerminal(request: TerminalOpenRequestV1): Promise<TerminalSessionV2>
  attach(request: TerminalAttachRequestV1): Promise<TerminalAttachmentV1>
  killTerminal(terminalId: string, reason: string): Promise<TerminalMutationReceiptV2>
}
```

#### TerminalAttachmentV1 定义

```typescript
interface TerminalAttachmentV1 {
  readonly terminalId: string
  getSnapshot(): TerminalAttachmentSnapshotV1
  subscribe(listener: () => void): () => void
  write(data: string): Promise<TerminalMutationReceiptV2>
  resize(cols: number, rows: number): Promise<TerminalMutationReceiptV2>
  signal(signal: TerminalSignalV1): Promise<TerminalMutationReceiptV2>
  requestControl(mode?: 'normal' | 'takeover'): Promise<TerminalMutationReceiptV2>
  releaseControl(): Promise<void>
  detach(reason: string): Promise<void>
}
```

### 需对照的语义覆盖

| 语义 | 本地 Spec | DSH Agent Note | 状态 |
|------|-----------|-----------------|------|
| **owner identity** | TerminalSessionV2.owner | ❌ DSH Note 不存在 | BLOCKED |
| **profile** | TerminalProfileV1 enum | ❌ DSH Note 不存在 | BLOCKED |
| **attach/control** | attach/requestControl/releaseControl | ❌ DSH Note 不存在 | BLOCKED |
| **frame** | TerminalAttachmentSnapshotV1 | ❌ DSH Note 不存在 | BLOCKED |
| **resize** | resize(cols, rows) | ❌ DSH Note 不存在 | BLOCKED |
| **detach/kill** | detach/killTerminal | ❌ DSH Note 不存在 | BLOCKED |
| **error/replay** | MutationReceipt + epoch/sequence | ❌ DSH Note 不存在 | BLOCKED |

### 无未映射 Required Capability

由于 DSH Agent Note 不存在，无法进行完整对照验证。本地 spec 已设计完整语义覆盖，但需等待 DSH official Note 后才能确认合同对齐。

### 差异回写

无差异可回写，因为：
1. DSH upstream 无 official PTY Agent Note
2. 本地 TerminalHostV2 spec 基于 design.md 冻结的 V3 语义
3. 上游 PR staging series 尚未提交到 deepseek-ai

## Lane 分类

- **Lane**：`commodity-parked`
- **原因**：通用真终端属商品区，本轮不实施
- **未来路径**：待 DSH better-sidebar 生态或官方 slot 落地

## 本地交付状态

### V3 已交付（根据 design.md）

- [x] `TerminalHostV2` 类型定义与 fake adapter
- [x] placeholder `TerminalHostV1` deprecated export
- [x] local capability detection logic

### V3 未交付（commodity-parked）

- [ ] 真实 PTY 交互能力
- [ ] xterm.js integration
- [ ] 官方 DSH interactive terminal seam

## Evidence 结论

**Task 2.1 无法完成**，因为：

1. ❌ DSH upstream 无 official PTY Agent Note
2. ❌ 无法对照确认 owner identity、profile、attach/control、frame、resize、detach/kill、error/replay 语义一致
3. ❌ 无法验证无未映射 required capability
4. ✅ 本地 TerminalHostV2 spec 已完整定义
5. ✅ upstream-prs 通道已建立（pending actual patch + note）

**Acceptance Criteria**：
- [ ] 无未映射 required capability：BLOCKED (无法验证)
- [ ] 差异回写各自 owning design：BLOCKED (无 DSH Note 对照)

2026-08-25 | lane-prod1 review | BLOCKED pending DSH official PTY Agent Note