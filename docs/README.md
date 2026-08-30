# harness-plugins 文档

本仓库是 @yeisme/dsh-* DSH 插件的实现 owner。产品、设计、实现、QA、发布文档都在本目录。

## 入口

- cookbook/adding-ordo-agent-ops-plugin.md：Ordo Agent Ops 插件的组装/安装方式。
- cookbook/adding-ordo-agent-ops-plugin.md §8：Ordo、Workbench、pack 与 Control Plane handoff 字段账本。
- design/dsh-web-ordo-team-hub-v1.md：Session Agents / Ordo Teams 统一 Hub、Task-Agent graph、Host safe projection、响应式与可访问性设计。
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
- ../openspec/changes/dsh-slash-directory-hotplug-v1/：live `/` 目录、pane 热贡献、inspect 命令投影的合同与实现任务（design §D5 记录真实 runtime 集成加固）。
- design/dsh-web-pane-terminal-sidechat.md：dsh web pane 终端（官方 ctx.terminals 行式投影）与侧边对话（附着/新建/fork，主选择不变量）设计，实施见 ../openspec/changes/dsh-web-pane-terminal-sidechat-v1/。
- cookbook/dsh-web-pane-terminal-sidechat.md：面向用户的终端 console 与侧边对话安装/使用/排障（含 DSH ≥ 0.1.1-rc.2 锚点与降级原因对照）。
- design/dsh-selection-agent-review-v1.md：选区/截图批注与逐位置审批的产品与设计摘要（split-owner、能力账本、桥接事件），实施见 ../openspec/changes/dsh-selection-agent-review-v1/。
- design/dsh-semantic-file-editor.md：基于 opaque ref、Host-side LSP/AST、Monaco 与 workspace edit receipt 的语义文件 Pane 设计，实施见 ../openspec/changes/dsh-semantic-file-editor-pane-v1/。
- ../packages/bundle/dsh-semantic-file-editor/README.md：语义编辑 bundle 的安装顺序、降级、回滚与证据命令。
- ../packages/bundle/dsh-selection-annotation/README.md：选区批注 bundle 的安装、kill-switch 与宿主桥接契约。
- ../packages/**/README.md：各包配置与运行时语义。

## 发布

    pnpm run build
    pnpm publish --filter @yeisme/dsh-ordo-agent-ops --access public

发布是 external action，需 npm 权限与远端仓库，按需执行。
