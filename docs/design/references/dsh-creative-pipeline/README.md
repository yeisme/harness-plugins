# 做剧可视化流水线 UI 参考图

这些图片用于信息架构、空间关系和视觉层级探索，不是运行、provider、生产交付或功能完成证据。

| 文件 | 状态 | 用途 |
|---|---|---|
| `overview.png` | local `codex:imagegen` canary | 默认画布与上下文条 |
| `running-inspector.png` | local `codex:imagegen` canary | execution edge 与运行检查器 |
| `blocked-agent-drawer.png` | local `codex:imagegen` canary | blocked/stale 与 Agent 抽屉 |

## 评审结论（2026-09-11）

- `overview.png`：通过信息架构评审。无限画布是主视觉，节点关系、项目上下文条和右侧对象详情层级清楚；后续实现需把关系类型明确标成 reference/execution。
- `running-inspector.png`：通过运行状态探索。右侧检查器、输入版本、进度、证据和 pause/resume 控件位置可复用；底部 execution log 只作为候选方案，不冻结为第二主导航。
- `blocked-agent-drawer.png`：通过阻塞态探索。blocked edge、影响范围、needs_contract、确认边界和 Agent 建议抽屉符合合同；`Apply and continue` 必须接入显式确认和真实 owner receipt。

上述结论只冻结信息层级和空间关系；没有冻结具体文案、颜色值、业务状态或运行成功事实。

生成渠道限定为本地 `codex:imagegen` canary，成本为 0；没有调用付费 provider。每张图的 run/artifact lineage、prompt 摘要、尺寸、渠道标记和评审结果写入 `temp/integration-test-runs/creative-pipeline-eikona-20260911/manifest.json` 及对应 Eikona run 目录。原始 prompt 不写入证据，只保留 Eikona 生成的 SHA-256 摘要。参考图仍是信息架构探索，不是 UI、owner 运行或生产交付证据。

## 评审记录（revision-20260912）

`revision-20260912/` 三张图（`comfyui-overview.png`、`running-inspector.png`、`blocked-agent-drawer.png`）均来自本地 `codex:imagegen` canary（ComfyUI 后端），成本为 0，未调用付费 provider；它们是信息架构/空间关系探索材料，**不是** UI、owner 运行或生产交付证据。对应 run 目录在 `temp/integration-test-runs/creative-pipeline-eikona-20260912-comfyui/`。

- 2026-09-11 复核结论：只冻结空间关系与密度。截图中的文字、私有实现细节与 provider 行为均未进入协议。
- 协议侧证据：`packages/sdk/dsh-plugin-contracts/src/creative-pipeline.ts` 与 `packages/host/pane-protocol/src/index.ts` 的 `PipelineRunProjectionSchema` 只携带 opaque ref、有界摘要与状态枚举，fail-closed 拒绝敏感键；截图内容不构成任何协议输入。
- 已知 lineage 缺口：`temp/integration-test-runs/creative-pipeline-eikona-20260912-comfyui/` 缺 `manifest.json`（对比 20260911 目录有 manifest）。这是工具原生输出的已知缺口，本仓不改写工具原生输出、不补手写 manifest；该批次仅作探索参考，不作为完成证据引用。
