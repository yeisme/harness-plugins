## 0. Lane 分类（2026-08-20 差异化重切）
> 依据 root 差异化策略：通用工作台能力（chrome/文件 renderer/终端/Git/浏览器）不再自研重建，由 better-sidebar 生态或未来官方 slot 承接；差异区（富媒体/session/cookie）主攻。详见 design.md「Lane 重切」。
- `commodity-parked`：1.3（PTY Agent Note）、2.1（TerminalHostV2 对齐）——通用真终端属商品区，本轮不实施。
- `differentiation`：1.4/2.4（Resource Preview 合同，收敛到 media/data 路径与安全边界）、2.3（社区依赖策略，收敛到媒体 renderer 依赖 WaveSurfer/hls.js/PDF.js）、3.2/3.3（验证与文档同步，仅覆盖保留 lane 的范围）。

## 1. 跨项目设计与路由

- [x] 1.1 [Owner: Harness Plugins] 将 Pane Chrome、文件/文档与真实终端能力分类为 `split-owner`，冻结 DSH 上游与 Harness Plugins 的 canonical 边界。Acceptance: `proposal.md` 和 `design.md` 包含能力台账、所有权图与 non-goals。
- [x] 1.2 [Owner: Harness Plugins] 创建 Harness Plugins 实施 handoff `openspec/changes/dsh-pane-workspace-experience-v3/`。Acceptance: proposal/design/tasks 与 Pane Chrome、Resource Preview、File/Document、Media、Terminal capability specs 路径明确。
- [ ] 1.3 [Owner: DeepSeek Harness] 冻结 interactive PTY capability、input lease、raw VT、resize、duplex WebSocket、auth、replay 与旧 API 兼容。通道（2026-08-20 起 dsh fork 退役）：在本仓 `upstream-prs/` backlog 固化 `TerminalInteractiveCapabilityV1` 系列（patch + 双语 note 草案），以 PR 形式提交 deepseek-ai 上游；合入前插件侧 capability probe + 诚实降级。Acceptance: upstream-prs 系列 README/apply.sh 齐备且 pr-rebase apply-check 绿；note 草案过 format/translation pairing gates。 **[lane: commodity-parked]**
- [ ] 1.4 [Owner: DeepSeek Harness / Domain owners] 创建 Resource Preview proposed Agent Note/owner contracts，冻结 safe resource ref、MIME sniff、rendition、range/text/table window、version subscription、access handle、Abort/release与旧attachment/fs兼容。通道同 1.3：`upstream-prs/` backlog 的 `PreviewResourceV1` 系列 + 上游 PR；合入前插件不猜测内容。Acceptance: 浏览器不接收绝对路径、provider URL/token或无界正文；系列可干净 apply。 **[lane: differentiation]**

## 2. 合同对齐与设计评审

- [ ] 2.1 [Owner: Harness Plugins] 对照 DSH Agent Note 与 Harness `TerminalHostV2` spec，确认 owner identity、profile、attach/control、frame、resize、detach/kill、error/replay 语义逐项一致。Acceptance: 无未映射 required capability；差异回写各自 owning design。 **[lane: commodity-parked]**
- [x] 2.2 [Owner: Harness Plugins] 完成 UI 设计评审，覆盖层级、Pane 管理、图标、文件/数据/媒体生命周期、renderer states、终端状态、响应式与无障碍。Acceptance: `design.md` 包含格式矩阵、状态矩阵、用户旅程和七轮检查结果。
- [ ] 2.3 [Owner: Harness Plugins] 确认社区依赖、许可与版本策略：xterm.js addons、Codicons、DSH node-pty pin、Monaco、PDF.js、WaveSurfer、hls.js、TanStack。Acceptance: 重依赖lazy load、子项目lockfile/THIRD_PARTY_NOTICES与spec一致，不引入第二PTY或远端component runtime。 **[lane: differentiation]**
- [ ] 2.4 [Owner: Harness Plugins] 对照 DSH/领域 Resource Preview seam 与 Harness `PreviewResourceV1`/host/registry specs，确认 owner/ref/version、MIME、rendition、range/window、stale、release与error逐项一致。Acceptance: FileEntryV1/MediaRefV1 adapter无破坏性迁移，缺失能力有诚实fallback。 **[lane: differentiation]**

## 3. 子项目 Handoff 与验证

- [x] 3.1 [Owner: Harness Plugins] 运行本 change 与实施 handoff 的 OpenSpec strict validation。Validation: `openspec validate dsh-workspace-productivity-ui-v3 --strict --no-interactive`；`openspec validate dsh-pane-workspace-experience-v3 --strict --no-interactive`。
- [ ] 3.2 [Owner: Harness Plugins] 在两个子项目实施完成后审阅 redacted evidence summary，确认 Right/Bottom、sidebar invariant、file/document/data/media lifecycle、Markdown/JSON/CSV/PDF/image/audio/video/HLS/binary fallback、partial/stale、real PTY/TUI、control conflict、detach/reconnect 与 390px Sheet 全部有证据路径。 **[lane: differentiation]**
- [ ] 3.3 [Owner: Harness Plugins] 同步跨项目文档引用并确认 V1/V2 历史未被改写。Acceptance: 新文档只通过 V3 supersede/link 说明演进，旧 change 内容保持原样。 **[lane: differentiation]**
