# DSH 插件 Grill Me 使用指南

> 状态：工作流指南；面向在 `agent/harness-plugins` 开发 DSH 插件的会话与用户。
> 对应 Skill：`dsh-plugin-grill-me`（与 `grill-me` 协议成对激活）。本仓不持有 Skill 源码，真源在根仓 `.skills/yeisme/project-development/dsh-plugin-grill-me/`。

## 什么时候用

用户**明确**说"质询我 / 挑战这个设计 / 压力测试这个方案 / 逐问过一遍"等表达，且主题是 DSH 插件开发时：

- 新插件想法：还没确定做 tab、pane 还是 overlay。
- 既有 change 复核：`openspec/changes/<change-id>/proposal.md` 或 `design.md` 冻结前的压力测试。
- 一次 seam 决策：走已发布 surface、`upstream-prs/` 通道，还是插件侧 probe。
- 一次重构或验收前的设计复核。

普通 PRD、设计或实现请求**不会**隐式启动访谈；这是显式入口，和 `grill-me` 一致。

## 它怎么运行

1. **先查事实再提问**。会话内联读取本仓 `AGENTS.md` 边界、`docs/plugin-tab-development.md`、`docs/plugin-host-protocol.md`、`docs/design/dsh-unified-panel-visual-system.md`、相关 `openspec/changes/` 与 `packages/` 现状——仓库可查的事实不问用户。
2. **按深度分层**：单一窄问题 `quick`；既有 surface 新能力 `standard`；新 surface/archetype、新增存储域、upstream seam、合同或 schema 变更默认 `deep`。
3. **沿阶段 frontier 逐轮访谈**（S0→S7，上游阶段未定不预问下游）：

| 阶段 | 定什么 | 关键判断 |
|---|---|---|
| S0 场景与表面 | 做给谁、解决什么 | 数据作用域决定 tab / pane / overlay / preset |
| S1 owner 与边界 | 真相归谁 | Ordo/DSH core/本仓；绝不造第二账本 |
| S2 数据与投影 | 过界字段面 | safe projection、纯 fold、存储域、有界窗口诚实标注 |
| S3 seam 与宿主 | 依赖哪个宿主面 | 已发布 surface vs `upstream-prs/`；probe + `disabledReason()` |
| S4 形态与组合 | shape A/B | cordis 语法、preset-root、vendoring 规则 |
| S5 界面契约 | 视觉（仅 shape B） | ui-surface/ui-visual-kit、双语、UI Contract |
| S6 生命周期与降级 | 拆装对称 | disposer、HMR、会话切换、死 tab 防护 |
| S7 交付与验证 | 怎么算完成 | OpenSpec 必要性、门禁清单、完成=仓内协议对接 |

4. **每题带可反驳的推荐答案**，用户按编号回答整轮；答案触碰禁止项（core fork、第二 scheduler、raw prompt 过界、官方合入当验收）时立即指出并给合规替代。
5. **"不知道"转有界 proof**：视觉手感、交互密度、上游运行时行为这类需要真机证据的问题，先用 [dsh-plugin-hot-development.md](dsh-plugin-hot-development.md) 做可丢弃 prototype，拿证据回来继续。

## 它产出什么

frontier 收敛后在对话里给出决策摘要：结论、关键选择（surface/owner 边界/数据/seam/形态/视觉/生命周期/验证门）、非目标、风险、验证缺口、建议下一步。

确认摘要后按需 handoff（每项需单独授权）：起草 OpenSpec change → 进入 `dsh-tab-plugin-development` 实施 → 或先做 prototype。访谈本身不写文件、不改代码、不建 change。

## 排障

- 会话里没有这两个 Skill：在根仓运行 `scripts/skills.sh sync-target agent/harness-plugins` 重新生成 runtime 副本；不要直接编辑 `.claude/skills/` 或 `.agents/skills/`。
- 被问到了仓库里可查的事实：这是缺陷，要求会话回到 S 对应的"事实来源"文档自行核对。
- 想质询非 DSH 插件主题（比如发布流程、纯产品问题）：用通用 `grill-me`。
