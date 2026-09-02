# DSH Workspace Productivity UI V3 - Task 2.1 TerminalHostV2 对照评审证据

## 执行摘要

**对齐验证状态**：❌ **无法验证对齐 - 保持 BLOCKED**

**阻塞根因**：DSH upstream (`deepseek-ai/deepseek-harness`) 未发布 official PTY Agent Note，无对照基准。

**本地 TerminalHostV2 spec 完整性**：✅ 本地 spec 已完整定义所有必需能力，包括 owner identity、profile、attach、control、frame、resize、detach、kill、error handling 与 replay 语义。

**上游通道状态**：⚠️ 本仓 `upstream-prs/` backlog 曾记录 `TerminalInteractiveCapabilityV1` 系列草案的存在（2026-08-25 复核口径）；**2026-09-02 复核更正：该系列实际未在 `upstream-prs/` 落盘**（目录中无 terminal 相关 slug），task 1.3 的固化通道尚未执行（commodity-parked，本轮不实施）。

**V3 本地交付状态**：✅ `TerminalHostV2` 类型定义、fake adapter 与本地 capability detection 已完整实施；commodity-parked 真实 PTY 交互按计划不实施。

## Task 状态：BLOCKED

**Blocked Reason**：depends on 1.3 official PTY Agent Note from DeepSeek Harness upstream

## Evidence 对照结果

### DSH Agent Note 状态

- **当前状态**：DSH upstream `deepseek-ai/deepseek-harness` 未发布 official PTY Agent Note
- **上游通道**：本仓 `upstream-prs/` 曾记录 `TerminalInteractiveCapabilityV1` 系列草案（2026-09-02 复核更正：实际未落盘，见执行摘要）
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

### 逐项对照表：TerminalHostV2 Spec × DSH 上游现状

根据 Harness `TerminalHostV2` spec 与 DSH upstream 对照：

| TerminalHostV2 Spec 能力 | 本地定义 | DSH upstream 现状 | 对齐状态 |
|--------------------------|----------|-------------------|----------|
| **Capability Version** | `version: '0.2.0-rc.1'` | ❌ 无 official PTY Agent Note | **缺失** |
| **Capability ID** | `capability: 'terminal-host.interactive.v1'` | ❌ DSH 无对应 capability 声明 | **缺失** |
| **listProfiles()** | 返回 `TerminalProfileV1[]` (enum) | ❌ DSH 无 profile 概念 | **未知** |
| **listTerminals()** | 返回 `TerminalSessionV2[]` (含 owner identity) | ⚠️ DSH 有 `ctx.terminals` 但无 owner identity 暴露 | **部分** |
| **openTerminal()** | `TerminalOpenRequestV1 → TerminalSessionV2` | ⚠️ DSH 有 model-side `startSend/read/signal/kill` | **部分** |
| **attach()** | `TerminalAttachRequestV1 → TerminalAttachmentV1` | ❌ DSH 无 browser raw attachment | **缺失** |
| **killTerminal()** | `terminalId + reason → MutationReceiptV2` | ⚠️ DSH 有 `kill` 但无 detailed receipt | **部分** |
| **TerminalAttachment.getSnapshot()** | `TerminalAttachmentSnapshotV1` (含 frame buffer) | ❌ DSH 输出经 sanitize/scrollback，无 raw frame | **缺失** |
| **TerminalAttachment.subscribe()** | `listener → unsubscribe` | ❌ DSH 无 browser subscription API | **缺失** |
| **TerminalAttachment.write()** | `data → MutationReceiptV2` | ❌ DSH Web WebSocket downlink-only | **缺失** |
| **TerminalAttachment.resize()** | `cols + rows → MutationReceiptV2` | ❌ DSH 无 browser resize API | **缺失** |
| **TerminalAttachment.signal()** | `TerminalSignalV1 → MutationReceiptV2` | ⚠️ DSH model-side 有 signal，无 browser API | **部分** |
| **requestControl()** | `mode → MutationReceiptV2` (normal/takeover) | ❌ DSH 无输入控制租约概念 | **缺失** |
| **releaseControl()** | 释放输入控制 | ❌ DSH 无输入控制租约概念 | **缺失** |
| **detach()** | `reason → void` (优雅断开) | ❌ DSH 无 browser detach API | **缺失** |
| **MutationReceiptV2** | `epoch + sequence + terminalId` (error/replay 支持) | ❌ DSH 无 epoch/sequence tracking | **缺失** |

### 需对照的语义覆盖

| 语义 | 本地 Spec | DSH Agent Note | 状态 |
|------|-----------|-----------------|------|
| **owner identity** | TerminalSessionV2.owner | ❌ DSH Note 不存在 | **BLOCKED** |
| **profile** | TerminalProfileV1 enum | ❌ DSH Note 不存在 | **BLOCKED** |
| **attach/control** | attach/requestControl/releaseControl | ❌ DSH Note 不存在 | **BLOCKED** |
| **frame** | TerminalAttachmentSnapshotV1 | ❌ DSH Note 不存在 | **BLOCKED** |
| **resize** | resize(cols, rows) | ❌ DSH Note 不存在 | **BLOCKED** |
| **detach/kill** | detach/killTerminal | ❌ DSH Note 不存在 | **BLOCKED** |
| **error/replay** | MutationReceipt + epoch/sequence | ❌ DSH Note 不存在 | **BLOCKED** |

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

**Task 2.1 无法完成对齐验证**，核心阻塞原因与当前状态：

### 阻塞原因分析

1. ❌ **DSH upstream 无 official PTY Agent Note**
   - `deepseek-ai/deepseek-harness` 仓库未发布 `TerminalInteractiveCapabilityV1` 或相关 Agent Note
   - 无对照基准，无法验证合同对齐

2. ❌ **无法对照确认逐项语义一致**
   - 无法验证 `owner identity` 一致性
   - 无法验证 `profile` 语义对齐
   - 无法验证 `attach/control` 生命周期管理
   - 无法验证 `frame` buffer 语义
   - 无法验证 `resize/detach/kill` 操作语义
   - 无法验证 `error/replay` 追踪机制

3. ❌ **无法验证无未映射 required capability**
   - 缺少 DSH baseline，无法判断本地是否有未映射的上游要求
   - 也无法判断 DSH 是否有本地未实现的必需能力

### 本地实施完整性

4. ✅ **本地 TerminalHostV2 spec 已完整定义**
   - 类型定义完整：`TerminalHostV2`、`TerminalAttachmentV1`、`TerminalSessionV2`
   - 语义覆盖完整：owner、profile、attach、control、frame、resize、detach、kill、error、replay
   - 版本管理：`version: '0.2.0-rc.1'`、`capability: 'terminal-host.interactive.v1'`

5. ✅ **本地 V3 交付已完成 commodity-parked 范围**
   - 类型定义与 fake adapter 已实施
   - capability detection logic 已就绪
   - 按计划不实施真实 PTY 交互（commodity-parked）

### 上游通道状态

6. ⚠️ **upstream-prs 通道未落地（2026-09-02 复核更正）**
   - `upstream-prs/` backlog **未固化** `TerminalInteractiveCapabilityV1` 系列（此前记录有误；目录中无 terminal 相关 slug，无 patch/双语 note 草案）
   - task 1.3 的固化通道（patch + 双语 note + apply.sh/README）尚未执行，属 commodity-parked 本轮不实施范围
   - 2026-09-02 上游复核（deepseek-ai/deepseek-harness HEAD `4e84901e`）：仍未发布 official interactive PTY Agent Note；已 implemented 的 `persistent-pty-sessions`（2026-07-16）是 agent 侧行式 PTY（`ctx.terminals`），明示 deferred 全屏应用/按键序列/会话恢复，不构成 TerminalHostV2 对照基准

### Acceptance Criteria 评估

- [ ] **无未映射 required capability**：❌ **BLOCKED** (无法验证 - 缺少 DSH baseline)
- [ ] **差异回写各自 owning design**：❌ **BLOCKED** (无 DSH Note 对照 - 无法执行)

### 建议下一步（解除阻塞）

1. **短期（本 change 范围内）**：
   - 保持 Task 2.1 未勾选状态
   - 维护本 evidence document 作为阻塞原因记录
   - 继续推进其他 non-blocked 任务

2. **中期（跨项目协调）**：
   - 激活 `upstream-prs/terminal-interactive-capability-v1/` 系列提交
   - 向 `deepseek-ai/deepseek-harness` 提交官方 PR
   - 启动 upstream review 与 integration 流程

3. **长期（lane 解除 park）**：
   - 等待 DSH official PTY Agent Note 发布
   - 重新进行对照验证
   - 根据对照结果完成差异回写

**Lane Policy 符合性**：✅ 符合 `commodity-parked` lane 策略 - 通用真终端属商品区，本轮不实施，待官方 DSH better-sidebar 生态或原生 slot 落地。

2026-08-25 | lane-prod2 review | BLOCKED pending DSH official PTY Agent Note | Evidence strengthened with detailed capability comparison