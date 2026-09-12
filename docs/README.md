# harness-plugins 文档

本仓库是 @yeisme/dsh-* DSH 插件的实现 owner。产品、设计、实现、QA、发布文档都在本目录。

## 入口

- [Radar 市场简报与证据深看（规格阶段）](design/radar-market-experience.md)：国内外变化、阅读补看、关注、对照、回顾和当前会话证据问答；[完整设计](../openspec/changes/dsh-radar-market-intelligence-v1/design.md)、[实施 tasks](../openspec/changes/dsh-radar-market-intelligence-v1/tasks.md)。Radar 持有领域真源，本文不代表 Web 或真实数据已就绪。

- [搜索中心与分类探索 v2（实施中）](design/dsh-search-center.md)：全工作区资源的分类探索、快捷浮层、分组结果与只读预览；[完整设计与35类能力账本](../openspec/changes/dsh-search-center-v2/design.md)、[实施任务与证据](../openspec/changes/dsh-search-center-v2/tasks.md)。分类浏览已有组件实现，完整预览、运行宿主与新增来源仍待验收。

- [创作画布、工作流与五个专业 Pane（规格阶段）](design/dsh-creative-studio-program.md)：八份独立 OpenSpec/tasks 的总入口，覆盖 Eikona、Anatomia、Scaena、Auctra、Sonora；[消费接口与owner边界](interfaces/dsh-creative-studio-contracts.md)、[场景与故障矩阵](qa/dsh-creative-studio-journeys.md)。当前不代表插件功能已实现。

- [做剧可视化流水线工作台（文档与视觉参考阶段）](../openspec/changes/dsh-creative-pipeline-visual-workbench-v1/README.md)：Agent 背景上下文、无限画布、reference/execution edge、运行检查器与 Eikona 参考图；不代表真实 owner 或生产交付已就绪。

- [Workbench 退役与可复用知识](migrations/workbench-retirement/README.md)：原文快照、任务去向与 owner 边界；[DSH 项目画布与连续性 tasks](../openspec/changes/dsh-project-canvas-continuity-v1/tasks.md) 是新增实施入口，复用既有引用与成果工作区。

- [DSH URL Session 契约（规格已冻结）](protocols/dsh-url-session.md)：一个链接对应一个会话（`/s/<id>` 与 `?s=` 别名）；[OpenSpec 与任务](../openspec/changes/dsh-url-session-v1/proposal.md)。

- [提示词引用与创作工作台（实施中）](design/dsh-prompt-reference-creative-workspace.md)：可编辑提示词引用、紧凑输入框、发送预览及侧边成果创作；[OpenSpec 与任务](../openspec/changes/dsh-prompt-reference-creative-workspace-v1/proposal.md)。

- [会话工具工作区（已验证）](design/dsh-session-tools-workspace.md)：会话工具 Tab、固定旁栏、Pane 标题会话管理与目录恢复；[正式验收计划](qa/dsh-session-tools-workspace-acceptance.md)。

- [Pane 风格交互与后续支持](design/dsh-pane-interaction-completion.md)：Explorer、选区工具条、MCP 入口及侧栏/布局快捷键。

- [DSH 本地图像与制作 Pane](runtime/dsh-creator-local-cli.md)：Eikona/Scaena 独立入口、用户级 CLI 配置、验收覆盖与开放项。
- [DSH 本地工作台](runtime/dsh-workbench.md)：兼容启动器、旧版清理、Pane 会话隔离与无冗余 Target 的日常入口。

- design/dsh-unified-panel-visual-system.md：所有 React/Web 插件 UI 的设计事实源，定义 host-first token、Surface composition、容器密度、状态矩阵、插件 archetype、Workbench 联邦对齐和视觉验收门。
- design/dsh-conversation-rewrite-core-v2.md：Web 共用的 host-neutral rewrite boundary、typed mutation outcomes、partial-success recovery、V1 compatibility facade 与 fixtures。
- design/dsh-personal-coding-plugin-platform.md：个人编码基础包、显式 packs、`dsh.plugin_surface.v1`、Web 语义 fixture 和 contribution 故障隔离；当前保持 experimental。
- cookbook/adding-ordo-agent-ops-plugin.md：Ordo Agent Ops 插件的组装/安装方式。
- cookbook/adding-ordo-agent-ops-plugin.md §8：Ordo、Workbench、pack 与 Control Plane handoff 字段账本。
- design/dsh-web-ordo-team-hub-v1.md：Session Agents / Ordo Teams 统一 Hub、Task-Agent graph、Host safe projection、响应式与可访问性设计。
- design/dsh-web-command-first-interaction-v1.md：参考 Codex 交互语法的 DSH Web 命令优先混合壳；包含 Composer slash、全局 Palette、结构化命令、状态中枢、Activity、Pane handoff、线框、组件树与控制清单。实施见 ../openspec/changes/dsh-web-command-first-interaction-v1/。
- cookbook/dsh-web-ordo-team-hub.md：Team Hub V1 的英文安装、使用、降级和回滚指南；中文版本为 `cookbook/dsh-web-ordo-team-hub.zh.md`。
- ../openspec/changes/dsh-web-ordo-team-hub-v1/：DSH Web Ordo Team Hub 的 owning contract 与实施任务。
- ../packages/bundle/pane-workbench/README.md：Pane Workbench overlay 的安装、快捷操作、排障与 canary handoff。
- ../packages/bundle/anchored-standard/README.md：Anchored Standard 预设族的安装与行为。
- ../packages/bundle/dsh-devtools/README.md：DevTools 终端日志、Host/Web 性能、CPU Profile、导出与卸载说明。
- ../openspec/changes/dsh-devtools-observability-v1/：DevTools V1 合同、架构、验收和实施任务。
- ../openspec/changes/ordo-dsh-plugin-visualization-v1/：插件合同、状态机、DSH/Workbench 可视化设计。
- ../openspec/changes/dsh-browser-pane-v1/：契约优先 Browser Pane 的 owner 边界、Agent 协作浏览、实时视口附件、排他人工接管、安全投影与实现任务。
- design/dsh-web-pane-experience-completion.md：dsh web Pane 体验完成度设计（Experience Tier、做剧 × Workbench 旅程、交互缺口 owner 矩阵），实施见 ../openspec/changes/dsh-web-pane-experience-completion-v1/。
- design/dsh-workbench-ai-drama-bridge-v2.md：从 CEO、产品与架构角度定义 DSH 创作前台、Workbench 制作现场、Ordo 唯一账本的做剧闭环，以及 Bridge V2 合同、90 天路线、指标、迁移和止损条件；实施记录已归档到 ../openspec/changes/archive/2026-08-29-dsh-workbench-ai-drama-bridge-v2/。
- design/ai-drama-director-pack.md：Director 与 Show Control Room 的产品边界、命令、preset、owner 投影和 Workbench 可选 handoff。
- design/dsh-ai-drama-capability-gap-ledger.md：G14–G17 能力缺口重基线，按 deliver-now、external-owner、human-gate、superseded、closeout 分类。
- integrations/dsh-workbench-ai-drama-bridge-v2-packet.md：Workbench consumer 侧交付 packet——合同、intent→lens 矩阵、ingress 状态机、reason codes、fixtures 版本与匹配的 Workbench change 记录。
- cookbook/dsh-workbench-bridge-v2.md：做剧桥 V2 的用户视角、target registry 配置、证据诊断与回滚操作。
- cookbook/dsh-web-pane-tiers.md：面向用户的 Tier 分级说明、Tier 0 做剧 quickstart 与排障。
- cookbook/slash-commands.md：dsh web `/` 实时目录、面板热插拔贡献、自定义 host 命令注册契约与排障（双语）。
- cookbook/dsh-plugin-hot-development.md：一条命令加载全部本地 bundle、开发仓库外插件、增量 build、Cordis HMR 与 profile restart 的开发工作流。
- cookbook/dsh-plugin-grill-me.md：`dsh-plugin-grill-me` 显式质询工作流——在 OpenSpec change 与脚手架之前，沿 S0-S7 阶段 frontier 压力测试插件设计（表面、owner 边界、投影、seam、形态、视觉、生命周期、验证），产出决策摘要后按需 handoff。
- ../openspec/changes/dsh-slash-directory-hotplug-v1/：live `/` 目录、pane 热贡献、inspect 命令投影的合同与实现任务（design §D5 记录真实 runtime 集成加固）。
- design/dsh-web-pane-terminal-sidechat.md：dsh web pane 终端（官方 ctx.terminals 行式投影）与侧边对话（附着/新建/fork，主选择不变量）设计，实施见 ../openspec/changes/dsh-web-pane-terminal-sidechat-v1/。
- cookbook/dsh-web-pane-terminal-sidechat.md：面向用户的终端 console 与侧边对话安装/使用/排障（含 DSH ≥ 0.1.1-rc.2 锚点与降级原因对照）。
- design/dsh-selection-agent-review-v1.md：选区/截图批注与逐位置审批的 V1 产品与设计摘要（split-owner、能力账本、桥接事件），历史实施记录见 ../openspec/changes/archive/2026-08-28-dsh-selection-agent-review-v1/。
- design/dsh-selection-interaction-v2.md：统一 singleton 选区交互层、1+2+More 动作密度、扩展 descriptor、偏好、编辑控件防护、触控退化与 V1→V2 迁移设计；实施见 ../openspec/changes/dsh-selection-interaction-v2/。
- [选区添加到对话、引用与询问](design/dsh-selection-conversation-actions-v1.md)：目标会话、引用详情、固定／拖动、宿主视觉；插件合同已验收，真实宿主 overlay 仍未验证。交付见 [delivery/dsh-selection-conversation-actions-2026-09-05.md](delivery/dsh-selection-conversation-actions-2026-09-05.md)。
- design/dsh-semantic-file-editor.md：基于 opaque ref、Host-side LSP/AST、Monaco 与 workspace edit receipt 的语义文件 Pane 设计，实施见 ../openspec/changes/dsh-semantic-file-editor-pane-v1/。
- ../packages/bundle/dsh-semantic-file-editor/README.md：语义编辑 bundle 的安装顺序、降级、回滚与证据命令。
- ../packages/**/README.md：各包配置与运行时语义。

## 发布

    pnpm run build
    pnpm publish --filter @yeisme/dsh-ordo-agent-ops --access public

发布是 external action，需 npm 权限与远端仓库，按需执行。

## CI/CD

- [模块化、分级 CI/CD](delivery/ci-cd.md)：quick、full、integration、release 的触发场景、真实命令和权限边界。
- [DSH 全插件 UI 与本机验收（2026-09-05）](delivery/dsh-full-plugin-ui-acceptance-2026-09-05.md)：32 个 bundle、23 个注册视图、九项门禁、前后截图与未验证的外部能力。
- [DSH 完整多 Pane 工作台（2026-09-05）](delivery/dsh-unified-multi-pane-acceptance-2026-09-05.md)：宿主分屏与悬浮、会话和轨迹绑定、21 条浏览器动作链、兼容入口与回退。
- [Pane 自适应停靠体验修正（2026-09-05）](delivery/dsh-adaptive-pane-docking-2026-09-05.md)：宽吸附区、真实让位预演、窄屏自动排列与前后实测。

- [创作文件输入 Host 合同](mcp-input-intake.md)
- [3D 导演台 glTF/GLB 工作台](../openspec/changes/dsh-3d-director-gltf-workbench-v1/README.md)：Shot 锚点、无限画布与 3D 视口联动、Khronos glTF/GLB 能力矩阵与可审计生成变更集。
